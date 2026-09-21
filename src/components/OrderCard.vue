<script setup lang="ts">
// 界面层：单个订单的到货签收 / 超温拒收操作卡
import { computed, reactive } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useDeliveryStore } from "../store";
import { isOverTemp, paidTotal, EPS } from "../rules/delivery";
import type { Order } from "../data/types";

const props = defineProps<{ order: Order }>();
const store = useDeliveryStore();

const form = reactive({
  actualTemp: props.order.tempLimit,
  cash: props.order.receivable,
  ePay: 0,
  operator: "",
  reason: ""
});

const overTemp = computed(() => isOverTemp(form.actualTemp, props.order));
const paid = computed(() => paidTotal(form));
const diff = computed(() => Math.round((paid.value - props.order.receivable) * 100) / 100);
const balanced = computed(() => Math.abs(diff.value) <= EPS);
const isRejectStatus = computed(() => props.order.status === "拒收返仓");

function applyTemp() {
  store.setTemp(props.order.id, Number(form.actualTemp));
}

async function sign() {
  const result = store.signOrder(props.order.id, {
    operator: form.operator,
    reason: form.reason,
    actualTemp: Number(form.actualTemp),
    cash: Number(form.cash),
    ePay: Number(form.ePay)
  });
  if (result.ok) {
    ElMessage.success(result.message);
    form.operator = "";
    form.reason = "";
  } else {
    ElMessage.error(result.message);
  }
}

async function reject() {
  let reason = `超温拒收（${form.actualTemp}℃ > ${props.order.tempLimit}℃）`;
  if (!overTemp.value) {
    try {
      const { value } = await ElMessageBox.prompt("非超温拒收请填写拒收原因", "拒收返仓", {
        confirmButtonText: "生成返仓单",
        cancelButtonText: "取消",
        inputPattern: /\S+/,
        inputErrorMessage: "原因不能为空"
      });
      reason = value;
    } catch {
      return;
    }
  }
  const result = store.rejectOrder(props.order.id, Number(form.actualTemp), reason);
  if (result.ok) ElMessage.warning(result.message);
  else ElMessage.error(result.message);
}
</script>

<template>
  <article class="record" :class="{ 'is-reject': isRejectStatus }">
    <div class="record-head">
      <div>
        <p class="record-title">{{ order.code }}</p>
        <p class="record-sub">{{ order.address }} · {{ store.riderName(order.riderId) }} · {{ store.stationName(order.stationId) }}</p>
      </div>
      <span class="status" :class="`st-${order.status}`">{{ order.status }}</span>
    </div>

    <div class="details">
      <span>温区：{{ order.tempZone }}</span>
      <span>上限：{{ order.tempLimit }}℃</span>
      <span>应收：¥{{ order.receivable.toFixed(2) }}</span>
      <span>返仓点：{{ store.returnPointName(order.returnPointId) }}</span>
    </div>

    <div v-if="!isRejectStatus" class="op-grid">
      <label>
        实测温度 ℃
        <input v-model.number="form.actualTemp" type="number" step="0.1" @input="applyTemp" />
      </label>
      <label>
        现金（元）
        <input v-model.number="form.cash" type="number" min="0" step="0.01" :disabled="overTemp" />
      </label>
      <label>
        电子支付（元）
        <input v-model.number="form.ePay" type="number" min="0" step="0.01" :disabled="overTemp" />
      </label>
      <div class="paycheck" :class="{ bad: !balanced && !overTemp, ok: balanced }">
        <template v-if="overTemp">
          <strong class="hot">超温 {{ (form.actualTemp - order.tempLimit).toFixed(1) }}℃</strong>
          <span>只能拒收生成返仓单</span>
        </template>
        <template v-else>
          <strong>实付 ¥{{ paid.toFixed(2) }}</strong>
          <span :class="balanced ? 'ok' : 'bad'">{{ balanced ? "款项对平" : `差额 ${diff.toFixed(2)}，未挂账不得签收` }}</span>
        </template>
      </div>
      <label>
        签收人
        <input v-model="form.operator" placeholder="交接签收人" :disabled="overTemp" />
      </label>
      <label class="span2">
        {{ order.versions.length > 0 ? "复签原因（必填，生成新版本）" : "备注 / 复签原因" }}
        <input v-model="form.reason" :placeholder="order.versions.length > 0 ? '如：客户补验无误' : '选填；复签时必填'" :disabled="overTemp" />
      </label>
    </div>

    <div v-if="!isRejectStatus" class="actions">
      <button type="button" :disabled="overTemp" @click="sign">
        {{ order.versions.length > 0 ? "复签（新版本）" : "到货签收" }}
      </button>
      <button class="danger" type="button" @click="reject">拒收并生成返仓单</button>
    </div>

    <div v-if="order.versions.length" class="versions">
      <p class="versions-title">付款快照（{{ order.versions.length }} 个版本，旧版本不可改）</p>
      <div v-for="v in order.versions" :key="v.version" class="version">
        <header>
          <strong>v{{ v.version }} · {{ v.type }}</strong>
          <span>{{ new Date(v.time).toLocaleString("zh-CN", { hour12: false }) }} · {{ v.operator }}</span>
        </header>
        <p>
          温度 {{ v.actualTemp }}℃ ｜ 应收 ¥{{ v.payment.receivable.toFixed(2) }}
          ｜ 现金 ¥{{ v.payment.cash.toFixed(2) }} ｜ 电子 ¥{{ v.payment.ePay.toFixed(2) }}
        </p>
        <p class="reason">原因：{{ v.reason }}</p>
      </div>
    </div>
  </article>
</template>
