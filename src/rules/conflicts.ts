import type { LogisticsState, Rider } from "../data/types";
import { isOverTemp, paymentDiff, round2 } from "./delivery";

export type ConflictType = "款项差额" | "超温待拒收" | "返仓未关闭";

export interface Conflict {
  type: ConflictType;
  orderId: string;
  orderCode: string;
  riderName: string;
  diff: number; // 差额（实收 - 应收）
  tempNow: number;
  tempLimit: number;
  detail: string;
}

function riderNameOf(riders: Rider[], riderId: string): string {
  return riders.find((rider) => rider.id === riderId)?.name ?? riderId;
}

// 汇总待处理冲突：每笔都列出订单、骑手、差额、温度
export function collectConflicts(state: LogisticsState): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const order of state.orders) {
    const riderName = riderNameOf(state.riders, order.riderId);

    // 已签收但实收 ≠ 应收：款项差额未清
    if (order.status === "已签收" && !order.settled) {
      const diff = paymentDiff(order);
      if (diff !== 0) {
        conflicts.push({
          type: "款项差额",
          orderId: order.id,
          orderCode: order.code,
          riderName,
          diff,
          tempNow: order.tempNow,
          tempLimit: order.tempLimit,
          detail: diff > 0 ? `多收 ¥${diff.toFixed(2)}，待交班对平` : `少收 ¥${Math.abs(diff).toFixed(2)}，交班须挂账`
        });
      }
    }

    // 待签收但已超温：只能拒收生成返仓单
    if (order.status === "待签收" && isOverTemp(order)) {
      conflicts.push({
        type: "超温待拒收",
        orderId: order.id,
        orderCode: order.code,
        riderName,
        diff: 0,
        tempNow: order.tempNow,
        tempLimit: order.tempLimit,
        detail: `实测 ${order.tempNow}℃ 超上限 ${order.tempLimit}℃，禁止签收`
      });
    }
  }

  // 未关闭返仓单：持续占用原骑手与站点容量
  for (const item of state.returns) {
    if (item.status !== "待返仓") continue;
    conflicts.push({
      type: "返仓未关闭",
      orderId: item.orderId,
      orderCode: item.orderCode,
      riderName: riderNameOf(state.riders, item.riderId),
      diff: 0,
      tempNow: item.tempNow,
      tempLimit: item.tempLimit,
      detail: `占用 ${item.returnPointId} 返仓容量，关闭后才释放`
    });
  }

  return conflicts;
}

// 未挂账差额合计：已签收未结算订单的差额绝对值之和
export function openDiffTotal(state: LogisticsState): number {
  return round2(
    state.orders
      .filter((order) => order.status === "已签收" && !order.settled)
      .reduce((sum, order) => sum + Math.abs(paymentDiff(order)), 0)
  );
}
