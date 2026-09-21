import { computed, reactive } from "vue";
import { defineStore } from "pinia";
import type { LogisticsState, Order, Settlement } from "../data/types";
import { loadState, resetState, saveState } from "../data/storage";
import {
  buildReturnOrder,
  buildSnapshot,
  canReject,
  canResign,
  canSign,
  round2,
  type Guard
} from "../rules/delivery";
import { checkHandover, latestVersionOf, riderBook } from "../rules/settlement";
import { canDispatch, riderCapacityLeft, stationCapacityLeft } from "../rules/capacity";
import { collectConflicts, openDiffTotal } from "../rules/conflicts";

export interface RegisterPayload {
  address: string;
  riderId: string;
  returnPointId: string;
  receivable: number;
  cash: number;
  epay: number;
  tempLimit: number;
  tempNow: number;
}

export const useLogisticsStore = defineStore("logistics", () => {
  const state = reactive<LogisticsState>(loadState());

  const persist = () => saveState(state);

  // ---------- 查询 ----------
  const riderOf = (riderId: string) => state.riders.find((rider) => rider.id === riderId);
  const stationOf = (stationId: string) => state.stations.find((station) => station.id === stationId);
  const returnPointOf = (id: string) => state.returnPoints.find((point) => point.id === id);

  const versionsOf = (orderId: string) =>
    state.versions
      .filter((version) => version.orderId === orderId)
      .sort((a, b) => b.version - a.version);

  const conflicts = computed(() => collectConflicts(state));
  const openDiff = computed(() => openDiffTotal(state));
  const pendingOrders = computed(() => state.orders.filter((order) => order.status === "待签收"));
  const openReturns = computed(() => state.returns.filter((item) => item.status === "待返仓"));
  const capacityLeftTotal = computed(() =>
    state.riders.reduce((sum, rider) => sum + Math.max(0, riderCapacityLeft(rider, state.orders, state.returns)), 0)
  );

  // ---------- 订单登记 ----------
  function registerOrder(payload: RegisterPayload): Guard {
    const rider = riderOf(payload.riderId);
    const station = rider && stationOf(rider.stationId);
    const returnPoint = returnPointOf(payload.returnPointId);
    if (!rider || !station) return { ok: false, reason: "请选择骑手" };
    if (!returnPoint) return { ok: false, reason: "请选择返仓点" };
    if (payload.receivable <= 0) return { ok: false, reason: "应收款必须大于 0" };

    const guard = canDispatch(rider, station, state.orders, state.returns);
    if (!guard.ok) return guard;

    const order: Order = {
      id: crypto.randomUUID(),
      code: `DD-${1000 + state.orders.length + 1}`,
      address: payload.address,
      riderId: rider.id,
      stationId: station.id,
      returnPointId: returnPoint.id,
      receivable: round2(payload.receivable),
      cash: round2(payload.cash),
      epay: round2(payload.epay),
      tempLimit: payload.tempLimit,
      tempNow: payload.tempNow,
      status: "待签收",
      settled: false,
      createdAt: new Date().toISOString()
    };
    state.orders.unshift(order);
    persist();
    return { ok: true, reason: "" };
  }

  // ---------- 签收：留付款快照 v1 ----------
  function signOrder(orderId: string, cash: number, epay: number): Guard {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, reason: "订单不存在" };
    const guard = canSign(order);
    if (!guard.ok) return guard;

    order.cash = round2(cash);
    order.epay = round2(epay);
    order.status = "已签收";
    order.settled = false;
    state.versions.push(buildSnapshot(order, 1, "首次签收"));
    persist();
    return { ok: true, reason: "" };
  }

  // ---------- 复签：带原因生成新版本快照 ----------
  function resignOrder(orderId: string, cash: number, epay: number, reason: string): Guard {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, reason: "订单不存在" };
    const guard = canResign(order, reason);
    if (!guard.ok) return guard;

    const latest = latestVersionOf(orderId, state.versions);
    order.cash = round2(cash);
    order.epay = round2(epay);
    order.settled = false; // 复签后重新纳入交班对账
    state.versions.push(buildSnapshot(order, (latest?.version ?? 0) + 1, reason.trim()));
    persist();
    return { ok: true, reason: "" };
  }

  // ---------- 拒收：仅超温，生成返仓单占用容量 ----------
  function rejectOrder(orderId: string): Guard {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, reason: "订单不存在" };
    const guard = canReject(order);
    if (!guard.ok) return guard;

    order.status = "已拒收";
    state.returns.unshift(buildReturnOrder(order));
    persist();
    return { ok: true, reason: "" };
  }

  // ---------- 关闭返仓单：释放骑手与站点容量 ----------
  function closeReturn(returnId: string): Guard {
    const item = state.returns.find((entry) => entry.id === returnId);
    if (!item) return { ok: false, reason: "返仓单不存在" };
    if (item.status === "已关闭") return { ok: false, reason: "返仓单已关闭" };
    item.status = "已关闭";
    item.closedAt = new Date().toISOString();
    persist();
    return { ok: true, reason: "" };
  }

  // ---------- 交班：对平或挂账后方可签收 ----------
  function confirmSettlement(riderId: string, actualCash: number, actualEpay: number, suspense: number): Guard {
    const book = riderBook(riderId, state.orders, state.versions);
    if (book.orderIds.length === 0) return { ok: false, reason: "该骑手无待结算签收单" };

    const check = checkHandover(book.expectedCash, book.expectedEpay, actualCash, actualEpay, suspense);
    if (!check.ok) return { ok: false, reason: check.reason };

    const settlement: Settlement = {
      id: crypto.randomUUID(),
      riderId,
      expectedCash: book.expectedCash,
      expectedEpay: book.expectedEpay,
      actualCash: round2(actualCash),
      actualEpay: round2(actualEpay),
      cashDiff: round2(actualCash - book.expectedCash),
      epayDiff: round2(actualEpay - book.expectedEpay),
      suspense: check.balanced ? 0 : round2(suspense),
      status: check.balanced ? "已对平" : "已挂账",
      orderIds: book.orderIds,
      createdAt: new Date().toISOString()
    };
    state.settlements.unshift(settlement);
    for (const orderId of book.orderIds) {
      const order = state.orders.find((item) => item.id === orderId);
      if (order) order.settled = true;
    }
    persist();
    return { ok: true, reason: "" };
  }

  // ---------- 重置演示数据 ----------
  function resetAll(): void {
    Object.assign(state, resetState());
  }

  return {
    state,
    riderOf,
    stationOf,
    returnPointOf,
    versionsOf,
    conflicts,
    openDiff,
    pendingOrders,
    openReturns,
    capacityLeftTotal,
    registerOrder,
    signOrder,
    resignOrder,
    rejectOrder,
    closeReturn,
    confirmSettlement,
    resetAll
  };
});
