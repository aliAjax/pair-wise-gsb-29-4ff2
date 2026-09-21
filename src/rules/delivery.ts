// 规则层：全部为纯函数，输入状态输出结果，不做任何持久化与界面行为。
import type {
  ConflictRow,
  DeliveryState,
  HandoverRecord,
  Order,
  ReturnOrder,
  SignInput
} from "../data/types";

export const EPS = 0.009;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** 实付合计 */
export function paidTotal(input: Pick<SignInput, "cash" | "ePay">): number {
  return round2(Number(input.cash || 0) + Number(input.ePay || 0));
}

/** 款项差额：实付 - 应收 */
export function paymentDiff(input: SignInput, order: Order): number {
  return round2(paidTotal(input) - order.receivable);
}

/** 是否超温：实测温度高于温区上限即超温 */
export function isOverTemp(actualTemp: number, order: Pick<Order, "tempLimit">): boolean {
  return actualTemp > order.tempLimit + EPS;
}

/** 订单是否占用容量：未关闭的拒收返仓单 + 未完成（已登记）订单均占原骑手与站点 */
export function openReturnIds(state: DeliveryState): Set<string> {
  return new Set(state.returns.filter((r) => r.status === "待返仓").map((r) => r.id));
}

/** 骑手当前占用（在手订单 + 未关闭返仓单） */
export function riderLoad(state: DeliveryState, riderId: string): number {
  const activeOrders = state.orders.filter(
    (o) => o.riderId === riderId && o.status === "已登记"
  ).length;
  const openReturns = state.returns.filter(
    (r) => r.riderId === riderId && r.status === "待返仓"
  ).length;
  return activeOrders + openReturns;
}

/** 站点当前占用 */
export function stationLoad(state: DeliveryState, stationId: string): number {
  const activeOrders = state.orders.filter(
    (o) => o.stationId === stationId && o.status === "已登记"
  ).length;
  const openReturns = state.returns.filter(
    (r) => r.stationId === stationId && r.status === "待返仓"
  ).length;
  return activeOrders + openReturns;
}

export interface SignCheck {
  ok: boolean;
  overTemp: boolean;
  diff: number;
  errors: string[];
}

/**
 * 签收前置校验：
 * 1. 超温订单只能拒收，不得签收；
 * 2. 款项必须对平，差额未挂账不得签收（挂账由交班台处理，见 canSubmitHandover）。
 */
export function checkSign(state: DeliveryState, order: Order, input: SignInput): SignCheck {
  const errors: string[] = [];
  const overTemp = isOverTemp(input.actualTemp, order);
  const diff = paymentDiff(input, order);

  if (order.status === "拒收返仓") {
    errors.push("该订单已拒收并生成返仓单，不能直接签收，请先处理返仓单");
  }
  if (overTemp) {
    errors.push(`实测 ${input.actualTemp}℃ 超过温区上限 ${order.tempLimit}℃，只能拒收生成返仓单`);
  }
  if (!overTemp && Math.abs(diff) > EPS) {
    errors.push(`款项未对平：应收 ${order.receivable}，实付 ${paidTotal(input)}，差额 ${diff}；差额未挂账不得签收`);
  }
  if (!input.operator.trim()) errors.push("请填写签收人");
  // 复签必须带原因，且生成新版本
  if (order.versions.length > 0 && !input.reason.trim()) {
    errors.push("复签必须填写原因，将保存为新版本");
  }
  return { ok: errors.length === 0, overTemp, diff, errors };
}

export interface RejectResult {
  order: Order;
  returnOrder: ReturnOrder;
}

/** 拒收：订单转为拒收返仓并生成返仓单（占用原骑手与站点） */
export function buildReject(state: DeliveryState, order: Order, actualTemp: number, reason: string): RejectResult {
  const time = new Date().toISOString();
  const updated: Order = {
    ...order,
    status: "拒收返仓",
    rejectedAt: time,
    versions: order.versions
  };
  const seq = state.seq + 1;
  const returnOrder: ReturnOrder = {
    id: `rt${seq}`,
    code: `RC${new Date().toISOString().slice(0, 10).replace(/-/g, "")}${String(seq).padStart(3, "0")}`,
    orderId: order.id,
    riderId: order.riderId,
    stationId: order.stationId,
    returnPointId: order.returnPointId,
    actualTemp,
    tempLimit: order.tempLimit,
    reason: reason || `超温拒收（${actualTemp}℃ > ${order.tempLimit}℃）`,
    createdAt: time,
    status: "待返仓"
  };
  return { order: updated, returnOrder };
}

/** 关闭返仓单：释放骑手与站点容量（订单标记为已登记可重新派送） */
export function buildCloseReturn(returnOrder: ReturnOrder): ReturnOrder {
  return { ...returnOrder, status: "已关闭", closedAt: new Date().toISOString() };
}

/** 骑手名下可交班的签收款项（现金/电子应收） */
export function riderReceipts(state: DeliveryState, riderId: string, shiftDate: string) {
  const rows: { order: Order; versionKey: string; cash: number; ePay: number }[] = [];
  for (const order of state.orders.filter((o) => o.riderId === riderId)) {
    order.versions.forEach((v) => {
      if (v.time.slice(0, 10) === shiftDate) {
        rows.push({ order, versionKey: `${order.id}#v${v.version}`, cash: v.payment.cash, ePay: v.payment.ePay });
      }
    });
  }
  return rows;
}

export interface HandoverSummary {
  expectedCash: number;
  expectedEPay: number;
  diff: number;
  balanced: boolean;
  receipts: ReturnType<typeof riderReceipts>;
}

export function summarizeHandover(state: DeliveryState, riderId: string, shiftDate: string, actualCash: number, actualEPay: number): HandoverSummary {
  const receipts = riderReceipts(state, riderId, shiftDate);
  const expectedCash = round2(receipts.reduce((s, r) => s + r.cash, 0));
  const expectedEPay = round2(receipts.reduce((s, r) => s + r.ePay, 0));
  const diff = round2(Number(actualEPay || 0) + Number(actualCash || 0) - expectedCash - expectedEPay);
  return { expectedCash, expectedEPay, diff, balanced: Math.abs(diff) <= EPS, receipts };
}

export interface HandoverCheck {
  ok: boolean;
  errors: string[];
}

/** 交班规则：支付必须对平；存在差额时必须挂账，否则不得交班 */
export function checkHandover(summary: HandoverSummary, posted: boolean, note: string): HandoverCheck {
  const errors: string[] = [];
  if (summary.receipts.length === 0) errors.push("本班次没有可交接的签收款项");
  if (!summary.balanced && !posted) errors.push(`支付未对平，差额 ${summary.diff} 元；差额未挂账不得交班签收`);
  if (!summary.balanced && posted && !note.trim()) errors.push("挂账必须填写挂账说明");
  return { ok: errors.length === 0, errors };
}

/** 生成交班记录 */
export function buildHandover(
  state: DeliveryState,
  riderId: string,
  shiftDate: string,
  actualCash: number,
  actualEPay: number,
  posted: boolean,
  note: string
): HandoverRecord {
  const seq = state.seq + 1;
  const summary = summarizeHandover(state, riderId, shiftDate, actualCash, actualEPay);
  return {
    id: `h${seq}`,
    code: `JB${shiftDate.replace(/-/g, "")}${String(seq).padStart(3, "0")}`,
    riderId,
    shiftDate,
    time: new Date().toISOString(),
    expectedCash: summary.expectedCash,
    expectedEPay: summary.expectedEPay,
    actualCash: round2(Number(actualCash || 0)),
    actualEPay: round2(Number(actualEPay || 0)),
    diff: summary.diff,
    posted,
    note,
    coveredVersionKeys: posted ? summary.receipts.map((r) => r.versionKey) : []
  };
}

/** 追加签收版本（复签带原因，版本号递增，旧版本保留） */
export function appendSignVersion(order: Order, input: SignInput): Order {
  const version = order.versions.length + 1;
  return {
    ...order,
    status: "已签收",
    versions: [
      ...order.versions,
      {
        version,
        type: version === 1 ? "签收" : "复签",
        time: new Date().toISOString(),
        operator: input.operator.trim(),
        reason: input.reason.trim() || (version === 1 ? "正常签收" : "复签更正"),
        actualTemp: input.actualTemp,
        payment: {
          receivable: order.receivable,
          cash: round2(Number(input.cash || 0)),
          ePay: round2(Number(input.ePay || 0))
        }
      }
    ]
  };
}

/**
 * 冲突台：列出订单、骑手、差额、温度。
 * - 超温未处理：超温但仍为已登记的订单（演示数据可手工触发提示）
 * - 款项差额：交班记录中挂账或未对平
 * - 容量超限：骑手/站点占用 ≥ 容量
 * - 返仓待关闭：未关闭返仓单持续占用容量
 */
export function detectConflicts(state: DeliveryState, actualTempMap: Record<string, number>): ConflictRow[] {
  const rows: ConflictRow[] = [];

  for (const r of state.returns.filter((x) => x.status === "待返仓")) {
    rows.push({
      type: "返仓待关闭",
      level: "danger",
      orderId: r.orderId,
      returnId: r.id,
      riderId: r.riderId,
      stationId: r.stationId,
      actualTemp: r.actualTemp,
      tempLimit: r.tempLimit,
      detail: `返仓单 ${r.code} 未关闭，实测 ${r.actualTemp}℃ / 上限 ${r.tempLimit}℃，持续占用骑手与站点容量`
    });
  }

  for (const order of state.orders) {
    const t = actualTempMap[order.id];
    if (order.status === "已登记" && typeof t === "number" && isOverTemp(t, order)) {
      rows.push({
        type: "超温未处理",
        level: "danger",
        orderId: order.id,
        riderId: order.riderId,
        stationId: order.stationId,
        actualTemp: t,
        tempLimit: order.tempLimit,
        detail: `订单 ${order.code} 实测 ${t}℃ 超过上限 ${order.tempLimit}℃，只能拒收返仓`
      });
    }
  }

  for (const h of state.handovers) {
    if (Math.abs(h.diff) > EPS) {
      rows.push({
        type: "款项差额",
        level: h.posted ? "warning" : "danger",
        riderId: h.riderId,
        diff: h.diff,
        detail: `交班单 ${h.code} 差额 ${h.diff} 元${h.posted ? `（已挂账：${h.note}）` : "（未挂账，不得交班签收）"}`
      });
    }
  }

  for (const rider of state.riders) {
    const load = riderLoad(state, rider.id);
    if (load > rider.capacity) {
      rows.push({
        type: "容量超限",
        level: "danger",
        riderId: rider.id,
        detail: `骑手 ${rider.name} 占用 ${load}/${rider.capacity}，未关闭返仓单不得释放容量`
      });
    }
  }
  for (const station of state.stations) {
    const load = stationLoad(state, station.id);
    if (load > station.capacity) {
      rows.push({
        type: "容量超限",
        level: "danger",
        stationId: station.id,
        detail: `站点 ${station.name} 占用 ${load}/${station.capacity}，未关闭返仓单不得释放容量`
      });
    }
  }

  return rows;
}
