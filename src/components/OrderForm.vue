<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useLogisticsStore } from "../store/logistics";
import { riderCapacityLeft } from "../rules/capacity";

const store = useLogisticsStore();

const form = reactive({
  address: "",
  riderId: "",
  returnPointId: "",
  receivable: 0,
  cash: 0,
  epay: 0,
  tempLimit: 8,
  tempNow: 4
});

const message = ref<{ ok: boolean; text: string } | null>(null);

// 返仓点跟随骑手所属站点
const availableReturnPoints = computed(() => {
  const rider = store.riderOf(form.riderId);
  if (!rider) return [];
  return store.state.returnPoints.filter((point) => point.stationId === rider.stationId);
});

const capacityHint = computed(() => {
  const rider = store.riderOf(form.riderId);
  if (!rider) return "";
  const left = riderCapacityLeft(rider, store.state.orders, store.state.returns);
  return `${rider.name} 剩余容量 ${left}/${rider.capacity}（含未关闭返仓单占用）`;
});

function onRiderChange() {
  form.returnPointId = availableReturnPoints.value[0]?.id ?? "";
}

function submit() {
  const result = store.registerOrder({ ...form });
  message.value = { ok: result.ok, text: result.ok ? `订单已登记，等待签收` : result.reason };
  if (result.ok) {
    form.address = "";
    form.receivable = 0;
    form.cash = 0;
    form.epay = 0;
  }
}
</script>

<template>
  <form class="panel" @submit.prevent="submit">
    <h2>订单登记</h2>
    <div class="form-grid">
      <label>
        地址
        <input v-model.trim="form.address" required placeholder="收货地址" />
      </label>
      <label>
        骑手
        <select v-model="form.riderId" required @change="onRiderChange">
          <option value="">请选择</option>
          <option v-for="rider in store.state.riders" :key="rider.id" :value="rider.id">
            {{ rider.name }}
          </option>
        </select>
      </label>
      <p v-if="capacityHint" class="hint">{{ capacityHint }}</p>
      <label>
        返仓点
        <select v-model="form.returnPointId" required :disabled="!form.riderId">
          <option value="">请选择</option>
          <option v-for="point in availableReturnPoints" :key="point.id" :value="point.id">
            {{ point.name }}
          </option>
        </select>
      </label>
      <div class="field-row">
        <label>
          应收款 ¥
          <input v-model.number="form.receivable" type="number" min="0" step="0.01" required />
        </label>
        <label>
          现金 ¥
          <input v-model.number="form.cash" type="number" min="0" step="0.01" required />
        </label>
        <label>
          电子支付 ¥
          <input v-model.number="form.epay" type="number" min="0" step="0.01" required />
        </label>
      </div>
      <div class="field-row">
        <label>
          温区上限 ℃
          <input v-model.number="form.tempLimit" type="number" step="0.5" required />
        </label>
        <label>
          实测温度 ℃
          <input v-model.number="form.tempNow" type="number" step="0.5" required />
        </label>
      </div>
      <button type="submit">登记订单</button>
      <p v-if="message" class="feedback" :class="message.ok ? 'ok' : 'fail'">{{ message.text }}</p>
    </div>
  </form>
</template>
