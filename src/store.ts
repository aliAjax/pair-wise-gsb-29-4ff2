// 数据 × 规则：Pinia store，是界面与纯逻辑之间唯一的桥梁。
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type {
  ConflictRow,
  DeliveryState,
  HandoverRecord,
  Order,
  ReturnOrder,
  SignInput,
  TempZone
} from "./data/types";
import { loadState, resetState, saveState } from "./data/storage";
import { ZONE_DEFAULT_LIMIT } from "./data/types";
import {
  appendSignVersion,
  buildCloseReturn,
  buildHandover,
  buildReject,
  checkHandover,
  checkSign,
  detectConflicts,
  riderLoad,
  round2,
  stationLoad,
  summarizeHandover,
  type SignCheck
} from "./rules/delivery";

export interface OrderDraft {
  code: string;
  address: string;
  riderId: string;
  stationId: string;
  returnPointId: string;
  tempZone: TempZone;
  tempLimit: number;
  receivable: number;
  cash: number;
  ePay: number;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export const useDeliveryStore = defineStore("delivery", () => {
  const state = ref<DeliveryState>(loadState());
  const tempMap = ref<Record<string, number>>({});

  function persist() {
    saveState(state.value);
  }

  const riders = computed(() => state.value.riders);
  const stations = computed(() => state.value.stations);
  const returnPoints = computed(() => state.value.returnPoints);
  const orders = computed(() => state.value.orders);
  const returns = computed(() => state.value.returns);
  const handovers = computed(() => state.value.handovers);

  const riderName = (id: string) => state.value.riders.find((r) => r.id === id)?.name ?? id;
  const stationName = (id: string) => state.value.stations.find((s) => s.id === id)?.name ?? id;
  const returnPointName = (id: string) => state.value.returnPoints.find((p) => p.id === id)?.name ?? id;
  const orderCode = (id: string) => state.value.orders.find((o) => o.id === id)?.code ?? id;

  const conflicts = computed<ConflictRow[]>(() => detectConflicts(state.value, tempMap.value));

  function loadOfRider(riderId: string) {
    return riderLoad(state.value, riderId);
  }
  function loadOfStation(stationId: string) {
    return stationLoad(state.value, stationId);
  }

  function registerOrder(draft: OrderDraft): ActionResult {
    if (!draft.code.trim()) return { ok: false, message: "请填写订单编号" };
    if (state.value.orders.some((o) => o.code === draft.code.trim())) {
      return { ok: false, message: `订单编号 ${draft.code} 已存在` };
    }
    const seq = state.value.seq + 1;
    const order: Order = {
      id: `o${Date.now()}${seq}`,
      code: draft.code.trim(),
      address: draft.address.trim() || "—",
      riderId: draft.riderId,
      stationId: draft.stationId,
      returnPointId: draft.returnPointId,
      tempZone: draft.tempZone,
      tempLimit: round2(draft.tempLimit ?? ZONE_DEFAULT_LIMIT[draft.tempZone]),
      receivable: round2(draft.receivable),
      status: "已登记",
      createdAt: new Date().toISOString(),
      versions: []
    };
    state.value.orders = [order, ...state.value.orders];
    state.value.seq = seq;
    persist();
    return { ok: true, message: `订单 ${order.code} 已登记，应收 ${order.receivable} 元` };
  }

  function inspectSign(orderId: string, input: SignInput): SignCheck {
    const order = state.value.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, overTemp: false, diff: 0, errors: ["订单不存在"] };
    return checkSign(state.value, order, input);
  }

  function signOrder(orderId: string, input: SignInput): ActionResult {
    const order = state.value.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, message: "订单不存在" };
    const check = checkSign(state.value, order, input);
    if (!check.ok) return { ok: false, message: check.errors.join("；") };
    state.value.orders = state.value.orders.map((o) =>
      o.id === orderId ? appendSignVersion(order, input) : o
    );
    delete tempMap.value[orderId];
    persist();
    const isResign = order.versions.length > 0;
    return { ok: true, message: isResign ? `复签成功，已保存 v${order.versions.length + 1} 版本` : "签收成功，已留付款快照" };
  }

  function rejectOrder(orderId: string, actualTemp: number, reason: string): ActionResult {
    const order = state.value.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, message: "订单不存在" };
    if (order.status === "拒收返仓") return { ok: false, message: "该订单已拒收" };
    const { order: updated, returnOrder } = buildReject(state.value, order, actualTemp, reason);
    state.value.orders = state.value.orders.map((o) => (o.id === orderId ? updated : o));
    state.value.returns = [returnOrder, ...state.value.returns];
    state.value.seq += 1;
    delete tempMap.value[orderId];
    persist();
    return { ok: true, message: `已拒收并生成返仓单 ${returnOrder.code}，占用原骑手与站点容量` };
  }

  function closeReturn(returnId: string): ActionResult {
    const target = state.value.returns.find((r) => r.id === returnId);
    if (!target) return { ok: false, message: "返仓单不存在" };
    const closed: ReturnOrder = buildCloseReturn(target);
    state.value.returns = state.value.returns.map((r) => (r.id === returnId ? closed : r));
    // 返仓关闭：释放返仓单占用的骑手与站点容量；订单保留拒收历史状态，重新派送需另登记
    persist();
    return { ok: true, message: `返仓单 ${target.code} 已关闭，骑手与站点容量已释放` };
  }

  function handoverSummary(riderId: string, shiftDate: string, actualCash: number, actualEPay: number) {
    return summarizeHandover(state.value, riderId, shiftDate, actualCash, actualEPay);
  }

  function submitHandover(
    riderId: string,
    shiftDate: string,
    actualCash: number,
    actualEPay: number,
    posted: boolean,
    note: string
  ): ActionResult {
    const summary = summarizeHandover(state.value, riderId, shiftDate, actualCash, actualEPay);
    const check = checkHandover(summary, posted, note);
    if (!check.ok) return { ok: false, message: check.errors.join("；") };
    const record: HandoverRecord = buildHandover(
      state.value,
      riderId,
      shiftDate,
      actualCash,
      actualEPay,
      posted,
      note
    );
    state.value.handovers = [record, ...state.value.handovers];
    state.value.seq += 1;
    persist();
    return {
      ok: true,
      message: summary.balanced
        ? `交班单 ${record.code} 款项对平，交接完成`
        : `交班单 ${record.code} 差额 ${record.diff} 元已挂账`
    };
  }

  function setTemp(orderId: string, value: number | undefined) {
    if (typeof value === "number" && Number.isFinite(value)) tempMap.value[orderId] = value;
    else delete tempMap.value[orderId];
  }

  function resetAll(): ActionResult {
    state.value = resetState();
    tempMap.value = {};
    return { ok: true, message: "已恢复演示数据" };
  }

  return {
    state,
    tempMap,
    riders,
    stations,
    returnPoints,
    orders,
    returns,
    handovers,
    conflicts,
    riderName,
    stationName,
    returnPointName,
    orderCode,
    loadOfRider,
    loadOfStation,
    registerOrder,
    inspectSign,
    signOrder,
    rejectOrder,
    closeReturn,
    handoverSummary,
    submitHandover,
    setTemp,
    resetAll
  };
});
