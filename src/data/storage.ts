import type { LogisticsState } from "./types";
import { seedState } from "./seed";

const STORAGE_KEY = "hxwlfront-15-handover";

// 刷新后从 localStorage 恢复，保证订单、款项、返仓和版本一致
export function loadState(): LogisticsState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedState();
  try {
    const parsed = JSON.parse(raw) as Partial<LogisticsState>;
    const intact =
      Array.isArray(parsed.orders) &&
      Array.isArray(parsed.riders) &&
      Array.isArray(parsed.stations) &&
      Array.isArray(parsed.returnPoints) &&
      Array.isArray(parsed.versions) &&
      Array.isArray(parsed.returns) &&
      Array.isArray(parsed.settlements);
    return intact ? (parsed as LogisticsState) : seedState();
  } catch {
    return seedState();
  }
}

export function saveState(state: LogisticsState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): LogisticsState {
  localStorage.removeItem(STORAGE_KEY);
  return seedState();
}
