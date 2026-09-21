<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { Order } from "../data/types";
import { useLogisticsStore } from "../store/logistics";
import { canReject, canSign, isOverTemp, paymentDiff } from "../rules/delivery";

const store = useLogisticsStore();

const filter = ref("全部状态");
const filters = ["全部状态", "待签收", "已签收", "已拒收"];

const filteredOrders = computed(() => {
  if (filter.value === "全部状态") return store.state.orders;
  return store.state.orders.filter((order) => order.status === filter.value);
});

// ---------- 签收 / 复签弹窗 ----------
const dialog = reactive({
  visible: false,
  mode: "sign" as "sign" | "resign",
  order: null as Order | null,
  cash: 0,
  epay: 0,
  reason: "",
  error: ""
});

const dialogDiff = computed(() => {
  if (!dialog.order) return 0;
  return Math.round((dialog.cash + dialog.epay - dialog.order.receivable) * 100) / 100;
});

function openDialog(mode: "sign" | "resign", order: Order) {
  dialog.visible = true;
  dialog.mode = mode;
  dialog.order = order;
  dialog.cash = order.cash;
  dialog.epay = order.epay;
  dialog.reason = "";
  dialog.error = "";
}

function closeDialog() {
  dialog.visible = false;
  dialog.order = null;
}

function submitDialog() {
  if (!dialog.order) return;
  const result =
    dialog.mode === "sign"
      ? store.signOrder(dialog.order.id, dialog.cash, dialog.epay)
      : store.resignOrder(dialog.order.id, dialog.cash, dialog.epay, dialog.reason);
  if (!result.ok) {
    dialog.error = result.reason;
    return;
  }
  closeDialog();
}

// ---------- 拒收 ----------
const rejectError = ref("");
function reject(order: Order) {
  const guard = canReject(order);
  if (!guard.ok) {
    rejectError.value = `${order.code}：${guard.reason}`;
    return;
  }
  const result = store.rejectOrder(order.id);
  rejectError.value = result.ok ? "" : `${order.code}：${result.reason}`;
}

// ---------- 版本快照展开 ----------
const expanded = ref<Set<string>>(new Set());
function toggleVersions(orderId: string) {
  const next = new Set(expanded.value);
  if (next.has(orderId)) next.delete(orderId);
  else next.add(orderId);
  expanded.value = next;
}

const riderName = (riderId: string) => store.riderOf(riderId)?.name ?? riderId;
const returnPointName = (id: string) => store.returnPointOf(id)?.name ?? id;
const signGuard = (order: Order) => canSign(order);
const fmt = (value: number) => `¥${value.toFixed(2)}`;
</script>

<template>
  <section class="panel">
    <div class="toolbar">
      <h2>签收台</h2>
      <select v-model="filter">
        <option v-for="item in filters" :key="item">{{ item }}</option>
      </select>
    </div>

    <p v-if="rejectError" class="feedback fail">{{ rejectError }}</p>

    <div class="record-grid">
      <div v-if="filteredOrders.length === 0" class="empty">暂无匹配订单</div>
      <article v-for="order in filteredOrders" :key="order.id" class="record">
        <div class="record-head">
          <p class="record-title">{{ order.code }} · {{ order.address }}</p>
          <span class="status" :class="{ warn: order.status === '已拒收' }">{{ order.status }}</span>
        </div>
        <div class="details">
          <span>骑手：{{ riderName(order.riderId) }}</span>
          <span>返仓点：{{ returnPointName(order.returnPointId) }}</span>
          <span>应收：{{ fmt(order.receivable) }}</span>
          <span>现金/电子：{{ fmt(order.cash) }} / {{ fmt(order.epay) }}</span>
          <span :class="{ hot: isOverTemp(order) }">
            温度：{{ order.tempNow }}℃ / 上限 {{ order.tempLimit }}℃{{ isOverTemp(order) ? "（超温）" : "" }}
          </span>
          <span :class="{ hot: order.status === '已签收' && paymentDiff(order) !== 0 }">
            差额：{{ paymentDiff(order) === 0 ? "对平" : fmt(paymentDiff(order)) }}
          </span>
        </div>
        <div class="actions">
          <button
            type="button"
            :disabled="!signGuard(order).ok"
            :title="signGuard(order).reason"
            @click="openDialog('sign', order)"
          >
            签收
          </button>
          <button
            class="danger"
            type="button"
            :disabled="!canReject(order).ok"
            :title="canReject(order).reason"
            @click="reject(order)"
          >
            拒收返仓
          </button>
          <button
            class="secondary"
            type="button"
            :disabled="order.status !== '已签收'"
            @click="openDialog('resign', order)"
          >
            复签
          </button>
          <button
            v-if="store.versionsOf(order.id).length"
            class="secondary"
            type="button"
            @click="toggleVersions(order.id)"
          >
            版本 ×{{ store.versionsOf(order.id).length }}
          </button>
        </div>
        <ul v-if="expanded.has(order.id)" class="version-list">
          <li v-for="version in store.versionsOf(order.id)" :key="version.id">
            v{{ version.version }} · 现金 {{ fmt(version.cash) }} + 电子 {{ fmt(version.epay) }}
            / 应收 {{ fmt(version.receivable) }} · {{ version.reason }} ·
            {{ new Date(version.signedAt).toLocaleString("zh-CN") }}
          </li>
        </ul>
      </article>
    </div>

    <div v-if="dialog.visible && dialog.order" class="modal-mask" @click.self="closeDialog">
      <div class="modal">
        <h3>{{ dialog.mode === "sign" ? "签收" : "复签" }} · {{ dialog.order.code }}</h3>
        <p class="hint">应收 {{ fmt(dialog.order.receivable) }}，留付款快照存档</p>
        <label>
          现金 ¥
          <input v-model.number="dialog.cash" type="number" min="0" step="0.01" />
        </label>
        <label>
          电子支付 ¥
          <input v-model.number="dialog.epay" type="number" min="0" step="0.01" />
        </label>
        <label v-if="dialog.mode === 'resign'">
          复签原因（必填）
          <input v-model.trim="dialog.reason" placeholder="如：客户补付差额" />
        </label>
        <p class="hint" :class="{ hot: dialogDiff !== 0 }">
          差额：{{ dialogDiff === 0 ? "对平" : fmt(dialogDiff) }}（差额将计入交班对账）
        </p>
        <p v-if="dialog.error" class="feedback fail">{{ dialog.error }}</p>
        <div class="actions">
          <button type="button" @click="submitDialog">确认</button>
          <button class="secondary" type="button" @click="closeDialog">取消</button>
        </div>
      </div>
    </div>
  </section>
</template>
