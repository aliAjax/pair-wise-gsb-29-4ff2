import type { Order, SignoffVersion } from "../data/types";
import { round2 } from "./delivery";

export interface RiderBook {
  expectedCash: number;
  expectedEpay: number;
  orderIds: string[];
}

export interface HandoverCheck {
  ok: boolean;
  balanced: boolean; // 是否无需挂账即对平
  totalDiff: number;
  reason: string;
}

// 取订单最新一版付款快照
export function latestVersionOf(orderId: string, versions: SignoffVersion[]): SignoffVersion | undefined {
  return versions
    .filter((version) => version.orderId === orderId)
    .sort((a, b) => b.version - a.version)[0];
}

// 骑手待交班账本：已签收且未结算订单的最新快照汇总
export function riderBook(riderId: string, orders: Order[], versions: SignoffVersion[]): RiderBook {
  const pending = orders.filter(
    (order) => order.riderId === riderId && order.status === "已签收" && !order.settled
  );
  const book: RiderBook = { expectedCash: 0, expectedEpay: 0, orderIds: [] };
  for (const order of pending) {
    const snapshot = latestVersionOf(order.id, versions);
    book.expectedCash = round2(book.expectedCash + (snapshot?.cash ?? order.cash));
    book.expectedEpay = round2(book.expectedEpay + (snapshot?.epay ?? order.epay));
    book.orderIds.push(order.id);
  }
  return book;
}

// 交班校验：支付必须对平；有差额时挂账必须覆盖差额，否则不得签收交班
export function checkHandover(
  expectedCash: number,
  expectedEpay: number,
  actualCash: number,
  actualEpay: number,
  suspense: number
): HandoverCheck {
  const cashDiff = round2(actualCash - expectedCash);
  const epayDiff = round2(actualEpay - expectedEpay);
  const totalDiff = round2(cashDiff + epayDiff);

  if (totalDiff === 0) {
    return { ok: true, balanced: true, totalDiff, reason: "" };
  }
  if (suspense <= 0) {
    return { ok: false, balanced: false, totalDiff, reason: "存在差额，未挂账不得签收交班" };
  }
  if (suspense < Math.abs(totalDiff)) {
    return { ok: false, balanced: false, totalDiff, reason: "挂账金额未覆盖差额，不得签收交班" };
  }
  return { ok: true, balanced: false, totalDiff, reason: "" };
}
