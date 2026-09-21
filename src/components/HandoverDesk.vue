<script setup lang="ts">
// 界面层：骑手交班款项交接台（现金/电子支付必须对平，差额挂账）
import { computed, reactive, watch } from "vue";
import { ElMessage } from "element-plus";
import { useDeliveryStore } from "../store";
import { EPS } from "../rules/delivery";

const store = useDeliveryStore();

const today = new Date().toISOString().slice(0, 10);
const form = reactive({
  riderId: store.riders[0]?.id ?? "",
  shiftDate: today,
  actualCash: 0,
  actualEPay: 0,
  posted: false,
  note: ""
});

const summary = computed(() =>
  store.handoverSummary(form.riderId, form.shiftDate, form.actualCash, form.actualEPay)
);

const expectedTotal = computed(() =>
  Math.round((summary.value.expectedCash + summary.value.expectedEPay) * 100) / 100
);
const actualTotal = computed(() =>
  Math.round((form.actualCash + form.actualEPay) * 100) / 100
);
const balanced = computed(() => Math.abs(summary.value.diff) <= EPS);

watch(
  () => [form.riderId, form.shiftDate],
  () => {
    // 自动带出应收，骑手按实收录入
    form.actualCash = summary.value.expectedCash;
    form.actualEPay = summary.value.expectedEPay;
    form.posted = false;
    form.note = "";
  },
  { immediate: true }
);

function submit() {
  const result = store.submitHandover(
    form.riderId,
    form.shiftDate,
    Number(form.actualCash),
    Number(form.actualEPay),
    form.posted,
    form.note
  );
  if (result.ok) {
    ElMessage.success(result.message);
    form.actualCash = 0;
    form.actualEPay = 0;
    form.posted = false;
    form.note = "";
  } else {
    ElMessage.error(result.message);
  }
}
</script>

<template>
  <section class="panel">
    <h2>骑手交班款项交接</h2>
    <p class="panel-hint">支付必须对平；存在差额时须勾选挂账并填写说明，否则不得交班签收。</p>
    <div class="form-grid">
      <label>
        骑手
        <select v-model="form.riderId">
          <option v-for="r in store.riders" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </label>
      <label>
        班次日期
        <input v-model="form.shiftDate" type="date" />
      </label>

      <div class="compare">
        <div class="compare-col">
          <span>应收现金</span>
          <strong>¥{{ summary.expectedCash.toFixed(2) }}</strong>
          <span>应收电子</span>
          <strong>¥{{ summary.expectedEPay.toFixed(2) }}</strong>
          <span>应收合计</span>
          <strong>¥{{ expectedTotal.toFixed(2) }}</strong>
        </div>
        <div class="compare-col">
          <label>实收现金
            <input v-model.number="form.actualCash" type="number" step="0.01" />
          </label>
          <label>实收电子
            <input v-model.number="form.actualEPay" type="number" step="0.01" />
          </label>
          <span>实收合计</span>
          <strong :class="balanced ? 'ok' : 'bad'">¥{{ actualTotal.toFixed(2) }}</strong>
        </div>
      </div>

      <div class="diff-bar" :class="balanced ? 'ok' : 'bad'">
        <template v-if="balanced">款项对平，可交班</template>
        <template v-else>
          差额 <strong>{{ summary.diff.toFixed(2) }}</strong> 元（{{ summary.diff > 0 ? "多收" : "少收" }}），未挂账不得交班签收
        </template>
      </div>

      <label v-if="!balanced" class="checkline">
        <input v-model="form.posted" type="checkbox" />
        差额挂账（挂账后允许交班，后续核销）
      </label>
      <label v-if="!balanced">
        挂账说明
        <textarea v-model="form.note" placeholder="如：客户少付 5 元，次日补收" />
      </label>

      <div v-if="summary.receipts.length" class="receipts">
        <p>本班签收款项明细（{{ summary.receipts.length }} 笔）</p>
        <div v-for="r in summary.receipts" :key="r.versionKey" class="receipt-row">
          <span>{{ r.order.code }}</span>
          <span>现金 ¥{{ r.cash.toFixed(2) }}</span>
          <span>电子 ¥{{ r.ePay.toFixed(2) }}</span>
        </div>
      </div>
      <div v-else class="empty small">本班次暂无签收款项</div>

      <button type="button" :disabled="!balanced && !form.posted" @click="submit">完成交班交接</button>
    </div>

    <div v-if="store.handovers.length" class="history">
      <p class="versions-title">交班记录</p>
      <div v-for="h in store.handovers" :key="h.id" class="version" :class="{ posted: h.posted && Math.abs(h.diff) > EPS }">
        <header>
          <strong>{{ h.code }} · {{ store.riderName(h.riderId) }} · {{ h.shiftDate }}</strong>
          <span :class="Math.abs(h.diff) <= EPS ? 'ok' : 'bad'">
            {{ Math.abs(h.diff) <= EPS ? "对平" : `差额 ${h.diff.toFixed(2)}（${h.posted ? "已挂账" : "未挂账"}）` }}
          </span>
        </header>
        <p>
          现金 应 ¥{{ h.expectedCash.toFixed(2) }} / 实 ¥{{ h.actualCash.toFixed(2) }}
          ｜ 电子 应 ¥{{ h.expectedEPay.toFixed(2) }} / 实 ¥{{ h.actualEPay.toFixed(2) }}
        </p>
        <p v-if="h.note" class="reason">挂账：{{ h.note }}</p>
      </div>
    </div>
  </section>
</template>
