import type { Order, ReturnOrder, Rider, Station } from "../data/types";
import type { Guard } from "./delivery";

// 骑手占用 = 在途待签收订单 + 未关闭返仓单
export function riderLoad(riderId: string, orders: Order[], returns: ReturnOrder[]): number {
  const active = orders.filter((order) => order.riderId === riderId && order.status === "待签收").length;
  const openReturns = returns.filter((item) => item.riderId === riderId && item.status === "待返仓").length;
  return active + openReturns;
}

// 站点占用 = 在途待签收订单 + 未关闭返仓单
export function stationLoad(stationId: string, orders: Order[], returns: ReturnOrder[]): number {
  const active = orders.filter((order) => order.stationId === stationId && order.status === "待签收").length;
  const openReturns = returns.filter((item) => item.stationId === stationId && item.status === "待返仓").length;
  return active + openReturns;
}

export function riderCapacityLeft(rider: Rider, orders: Order[], returns: ReturnOrder[]): number {
  return rider.capacity - riderLoad(rider.id, orders, returns);
}

export function stationCapacityLeft(station: Station, orders: Order[], returns: ReturnOrder[]): number {
  return station.capacity - stationLoad(station.id, orders, returns);
}

// 派单门禁：返仓单未关闭前占用容量，容量不足不得登记新订单
export function canDispatch(rider: Rider, station: Station, orders: Order[], returns: ReturnOrder[]): Guard {
  if (riderCapacityLeft(rider, orders, returns) <= 0) {
    return { ok: false, reason: `${rider.name} 容量已满（含未关闭返仓单占用）` };
  }
  if (stationCapacityLeft(station, orders, returns) <= 0) {
    return { ok: false, reason: `${station.name} 容量已满（含未关闭返仓单占用）` };
  }
  return { ok: true, reason: "" };
}
