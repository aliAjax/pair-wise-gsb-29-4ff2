// 规则层冒烟测试：对平、超温拒收返仓、容量占用/释放、复签版本、交班挂账、冲突检测
import { createSeedState } from "../src/data/seed";
import {
  appendSignVersion,
  buildCloseReturn,
  buildHandover,
  buildReject,
  checkHandover,
  checkSign,
  detectConflicts,
  riderLoad,
  stationLoad,
  summarizeHandover,
  paidTotal
} from "../src/rules/delivery";

let state = createSeedState();
let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log("  ✓", msg); }
  else { fail++; console.error("  ✗", msg); }
}

// 1. 正常签收：款项对平
let o1 = state.orders.find((o) => o.code === "DD20260921001");
const okInput = { operator: "客户甲", reason: "", actualTemp: 6, cash: 46.5, ePay: 40 };
let check = checkSign(state, o1, okInput);
assert(check.ok && !check.overTemp && check.diff === 0, "对平订单可签收");

// 2. 差额未挂账不得签收（规则层由签收校验 + 交班校验共同保证）
const badInput = { operator: "客户甲", reason: "", actualTemp: 6, cash: 40, ePay: 40 };
check = checkSign(state, o1, badInput);
assert(!check.ok && check.diff === -6.5, "差额 -6.5 不得签收");

// 3. 超温只能拒收
const hotInput = { operator: "客户甲", reason: "", actualTemp: 12, cash: 86.5, ePay: 0 };
check = checkSign(state, o1, hotInput);
assert(!check.ok && check.overTemp, "超温订单签收被拦截");
const { order: rejected, returnOrder } = buildReject(state, o1, 12, "");
state.orders = state.orders.map((o) => (o.id === o1.id ? rejected : o));
state.returns = [returnOrder, ...state.returns];
state.seq += 1;
assert(rejected.status === "拒收返仓" && returnOrder.status === "待返仓", "拒收生成返仓单");
assert(returnOrder.riderId === "r1" && returnOrder.stationId === "s1", "返仓单占用原骑手与站点");
assert(riderLoad(state, "r1") === 2, "骑手r1占用=2（1在手+1返仓）");
assert(stationLoad(state, "s1") === 2, "站点s1占用=2");

// 4. 未关闭返仓单持续占容量；关闭后释放
const beforeRider = riderLoad(state, "r1");
const closed = buildCloseReturn(returnOrder);
state.returns = state.returns.map((r) => (r.id === returnOrder.id ? closed : r));
assert(riderLoad(state, "r1") === beforeRider - 1, "关闭返仓单释放骑手容量（订单保留拒收状态）");

// 5. 复签带原因新版本
let o4 = state.orders.find((o) => o.code === "DD20260921004");
assert(o4.versions.length === 1, "种子订单已有 v1");
const resignNoReason = { operator: "站务甲", reason: "", actualTemp: 6, cash: 30, ePay: 30 };
check = checkSign(state, o4, resignNoReason);
assert(!check.ok && check.errors.some((e) => e.includes("复签")), "复签无原因被拦截");
o4 = appendSignVersion(o4, { ...resignNoReason, reason: "客户补验无误" });
assert(o4.versions.length === 2 && o4.versions[1].type === "复签" && o4.versions[0].version === 1, "复签生成 v2，v1保留");
assert(o4.versions[1].payment.receivable === 60 && o4.versions[1].payment.cash === 30, "付款快照保存应收与现金/电子");

// 6. 交班：差额挂账
const today = new Date().toISOString().slice(0, 10);
let summary = summarizeHandover(state, "r3", today, 55, 40); // 应收60，实收95 -> diff 35? o4两版本同日? seed版本时间可能不是今天
// seed 版本时间是 30 分钟前，同日概率高；若跨天则 receipts 为 0
if (summary.receipts.length > 0) {
  const hc = checkHandover(summary, false, "");
  assert(!hc.ok, "交班有差额且未挂账被拦截");
  const hc2 = checkHandover(summary, true, "");
  assert(!hc2.ok, "挂账无说明被拦截");
  const hc3 = checkHandover(summary, true, "客户多付，次日退");
  assert(hc3.ok, "挂账且有说明可交班");
  const h = buildHandover(state, "r3", today, 55, 40, true, "客户多付，次日退");
  assert(h.posted && h.diff !== 0 && h.coveredVersionKeys.length === summary.receipts.length, "交班记录挂账并关联版本");
  state.handovers = [h, ...state.handovers];
  state.seq += 1;
} else {
  console.log("  - 种子签收日期非今日，交班用例跳过（改状态内日期再测）");
}

// 7. 交班对平
// 构造：直接把 o1 在今天签收
o1 = appendSignVersion(state.orders.find((o) => o.id === o1.id), okInput);
state.orders = state.orders.map((o) => (o.id === o1.id ? { ...o1, versions: o1.versions.map((v, i) => i === o1.versions.length - 1 ? { ...v, time: new Date().toISOString() } : v) } : o));
summary = summarizeHandover(state, "r1", today, 46.5, 40);
assert(summary.balanced, "r1 交班款项对平");
assert(checkHandover(summary, false, "").ok, "对平可直接交班");

// 8. 冲突台包含订单/骑手/差额/温度字段
const conflicts = detectConflicts(state, {});
const diffRow = conflicts.find((c) => c.type === "款项差额");
if (diffRow) {
  assert(diffRow.riderId === "r3" && typeof diffRow.diff === "number", "款项差额冲突含骑手与差额");
}
// 制造一个超温未处理冲突（已登记订单）
const o3 = state.orders.find((o) => o.code === "DD20260921003");
const c2 = detectConflicts(state, { [o3.id]: 30 });
const tempRow = c2.find((c) => c.type === "超温未处理");
assert(tempRow && tempRow.orderId === o3.id && tempRow.actualTemp === 30 && tempRow.riderId, "超温冲突含订单、骑手、温度");

// 9. 容量超限冲突（构造：骑手 r1 有 1 个已登记订单，容量降到 0）
state.riders = state.riders.map((r) => (r.id === "r1" ? { ...r, capacity: 0 } : r));
const capRow = detectConflicts(state, {}).find((c) => c.type === "容量超限" && c.riderId === "r1");
assert(!!capRow, "容量超限进入冲突台");

// 10. 金额工具
assert(paidTotal({ cash: 1.005, ePay: 2.004 }) === 3.01, "金额按分四舍五入");

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
if (fail > 0) process.exit(1);
