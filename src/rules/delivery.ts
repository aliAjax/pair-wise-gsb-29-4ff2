import type { Order, ReturnOrder, SignoffVersion } from "../data/types";

export interface Guard {
  ok: boolean;
  reason: string;
}

export const round2 = (value: number): number => Math.round(value * 100) / 100;

// 超温判定：实测温度高于温区上限
export function isOverTemp(order: Pick<Order, "tempNow" | "tempLimit">): boolean {
  return order.tempNow > order.tempLimit;
}

export function paidTotal(payment: Pick<Order, "cash" | "epay">): number {
  return round2(payment.cash + payment.epay);
}

// 款项差额 = 实收（现金+电子）- 应收
export function paymentDiff(order: Pick<Order, "cash" | "epay" | "receivable">): number {
  return round2(paidTotal(order) - order.receivable);
}

// 签收门禁：仅待签收且未超温
export function canSign(order: Order): Guard {
  if (order.status !== "待签收") return { ok: false, reason: "仅待签收订单可签收" };
  if (isOverTemp(order)) return { ok: false, reason: "超温订单只能拒收" };
  return { ok: true, reason: "" };
}

// 拒收门禁：仅待签收且已超温，拒收即生成返仓单
export function canReject(order: Order): Guard {
  if (order.status !== "待签收") return { ok: false, reason: "仅待签收订单可拒收" };
  if (!isOverTemp(order)) return { ok: false, reason: "未超温订单不允许拒收" };
  return { ok: true, reason: "" };
}

// 复签门禁：仅已签收，且必须填写原因
export function canResign(order: Order, reason: string): Guard {
  if (order.status !== "已签收") return { ok: false, reason: "仅已签收订单可复签" };
  if (!reason.trim()) return { ok: false, reason: "复签必须填写原因" };
  return { ok: true, reason: "" };
}

// 付款快照：签收/复签各留一版
export function buildSnapshot(order: Order, version: number, reason: string): SignoffVersion {
  return {
    id: crypto.randomUUID(),
    orderId: order.id,
    version,
    receivable: order.receivable,
    cash: order.cash,
    epay: order.epay,
    reason,
    signedAt: new Date().toISOString()
  };
}

// 返仓单：占用原骑手与站点，关闭前不释放容量
export function buildReturnOrder(order: Order): ReturnOrder {
  return {
    id: crypto.randomUUID(),
    orderId: order.id,
    orderCode: order.code,
    riderId: order.riderId,
    stationId: order.stationId,
    returnPointId: order.returnPointId,
    reason: `超温拒收：实测 ${order.tempNow}℃ 高于上限 ${order.tempLimit}℃`,
    tempNow: order.tempNow,
    tempLimit: order.tempLimit,
    status: "待返仓",
    createdAt: new Date().toISOString(),
    closedAt: null
  };
}
