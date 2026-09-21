// 数据层：localStorage 持久化与刷新一致性校验。
import type { DeliveryState } from "./types";
import { createSeedState, STORAGE_KEY } from "./seed";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function num(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function str(value: unknown): value is string {
  return typeof value === "string";
}

/** 结构校验：刷新后订单、款项、返仓单、版本字段完整才采纳，否则回退种子 */
export function validateState(raw: unknown): raw is DeliveryState {
  if (!isObject(raw) || !Array.isArray(raw.orders) || !Array.isArray(raw.returns) || !Array.isArray(raw.handovers)) {
    return false;
  }
  if (!Array.isArray(raw.riders) || !Array.isArray(raw.stations) || !Array.isArray(raw.returnPoints)) return false;

  for (const o of raw.orders as unknown[]) {
    if (!isObject(o)) return false;
    if (!str(o.id) || !str(o.code) || !str(o.riderId) || !str(o.stationId)) return false;
    if (!str(o.returnPointId) || !num(o.tempLimit) || !num(o.receivable)) return false;
    if (!["已登记", "已签收", "拒收返仓"].includes(String(o.status))) return false;
    if (!Array.isArray(o.versions)) return false;
    for (const v of o.versions as unknown[]) {
      if (!isObject(v) || !num(v.version) || !str(v.time) || !str(v.operator)) return false;
      if (!isObject(v.payment) || !num(v.payment.receivable) || !num(v.payment.cash) || !num(v.payment.ePay)) {
        return false;
      }
    }
  }

  for (const r of raw.returns as unknown[]) {
    if (!isObject(r) || !str(r.id) || !str(r.orderId) || !str(r.riderId) || !str(r.stationId)) return false;
    if (!num(r.actualTemp) || !num(r.tempLimit)) return false;
    if (!["待返仓", "已关闭"].includes(String(r.status))) return false;
  }

  for (const h of raw.handovers as unknown[]) {
    if (!isObject(h) || !str(h.id) || !str(h.riderId) || !str(h.shiftDate)) return false;
    if (!num(h.expectedCash) || !num(h.expectedEPay) || !num(h.actualCash) || !num(h.actualEPay) || !num(h.diff)) {
      return false;
    }
    if (typeof h.posted !== "boolean" || !Array.isArray(h.coveredVersionKeys)) return false;
  }
  return true;
}

export function loadState(): DeliveryState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createSeedState();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (validateState(parsed)) return parsed;
    return createSeedState();
  } catch {
    return createSeedState();
  }
}

export function saveState(state: DeliveryState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): DeliveryState {
  const seed = createSeedState();
  saveState(seed);
  return seed;
}
