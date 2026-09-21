<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useLogisticsStore } from "../store/logistics";
import { checkHandover, riderBook } from "../rules/settlement";

const store = useLogisticsStore();

const riderId = ref(store.state.riders[0]?.id ?? "");
const actual = reactive({ cash: 0, epay: 0, suspense: 0 });
const message = ref<{ ok: boolean; text: string } | null>(null);

// 当前骑手待结算账本：已签收未结算订单的最新快照汇总
const book = computed(() => riderBook(riderId.value, store.state.orders, store.state.versions));

const check = computed(() =>
  checkHandover(book.value.expectedCash, book.value.expectedEpay, actual.cash, actual.epay, actual.suspense)
);

const diffText = computed(() => {
  const cashDiff = Math.round((actual.cash - book.value.expectedCash) * 100) / 100;
  const epayDiff = Math.round((actual.epay - book.value.expectedEpay) * 100) / 100;
  return { cashDiff, epayDiff, total: Math.round((cashDiff + epayDiff) * 100) / 100 };
});

// 切换骑手或账本变化时，实缴默认对齐应收
watch(
  [riderId, book],
  () => {
    actual.cash = book.value.expectedCash;
    actual.epay = book.value.expectedEpay;
    actual.suspense = 0;
    message.value = null;
  },
  { immediate: true }
);

function confirm() {
  const result = store.confirmSettlement(riderId.value, actual.cash, actual.epay, actual.suspense);
  message.value = result.ok
    ? { ok: true, text: "交班已签收，款项结清" }
    : { ok: false, text: result.reason };
}

const fmt = (value: number) => `¥${value.toFixed(2)}`;
const riderName = (id: string) => store.riderOf(id)?.name ?? id;
</script>

<template>
  <section class="panel">
    <h2>交班对账</h2>
    <div class="form-grid">
      <label>
        骑手
        <select v-model="riderId">
          <option v-for="rider in store.state.riders" :key="rider.id" :value="rider.id">
            {{ rider.name }}
          </option>
        </select>
      </label>

      <div class="book">
        <p><strong>待结算签收单：</strong>{{ book.orderIds.length }} 笔</p>
        <p><strong>应收现金：</strong>{{ fmt(book.expectedCash) }}　<strong>应收电子：</strong>{{ fmt(book.expectedEpay) }}</p>
      </div>

      <div class="field-row">
        <label>
          实缴现金 ¥
          <input v-model.number="actual.cash" type="number" min="0" step="0.01" />
        </label>
        <label>
          实缴电子 ¥
          <input v-model.number="actual.epay" type="number" min="0" step="0.01" />
        </label>
      </div>

      <p class="hint" :class="{ hot: diffText.total !== 0 }">
        差额：现金 {{ fmt(diffText.cashDiff) }} + 电子 {{ fmt(diffText.epayDiff) }} = {{ fmt(diffText.total) }}
      </p>

      <label v-if="diffText.total !== 0">
        挂账金额 ¥（差额未挂账不得签收）
        <input v-model.number="actual.suspense" type="number" min="0" step="0.01" />
      </label>
      <p v-if="!check.ok && book.orderIds.length" class="feedback fail">{{ check.reason }}</p>

      <button type="button" :disabled="!check.ok || book.orderIds.length === 0" @click="confirm">
        确认交班
      </button>
      <p v-if="message" class="feedback" :class="message.ok ? 'ok' : 'fail'">{{ message.text }}</p>
    </div>

    <h3 class="subhead">交班记录</h3>
    <div v-if="store.state.settlements.length === 0" class="empty">暂无交班记录</div>
    <ul class="plain-list">
      <li v-for="item in store.state.settlements" :key="item.id">
        <span class="status" :class="{ warn: item.status === '已挂账' }">{{ item.status }}</span>
        {{ riderName(item.riderId) }} · 应收 {{ fmt(item.expectedCash + item.expectedEpay) }} · 实缴
        {{ fmt(item.actualCash + item.actualEpay) }} · 差额 {{ fmt(item.cashDiff + item.epayDiff) }}
        <template v-if="item.suspense > 0"> · 挂账 {{ fmt(item.suspense) }}</template>
        · {{ new Date(item.createdAt).toLocaleString("zh-CN") }}
      </li>
    </ul>
  </section>
</template>
