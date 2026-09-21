<script setup lang="ts">
// 界面层：订单登记台（应收款、温区上限、返仓点）
import { reactive, watch } from "vue";
import { ElMessage } from "element-plus";
import { useDeliveryStore } from "../store";
import { TEMP_ZONES, ZONE_DEFAULT_LIMIT, type TempZone } from "../data/types";

const store = useDeliveryStore();

const form = reactive({
  code: "",
  address: "",
  riderId: store.riders[0]?.id ?? "",
  stationId: store.stations[0]?.id ?? "",
  returnPointId: store.returnPoints[0]?.id ?? "",
  tempZone: "常温" as TempZone,
  tempLimit: ZONE_DEFAULT_LIMIT["常温"],
  receivable: 0
});

watch(
  () => form.tempZone,
  (zone) => {
    form.tempLimit = ZONE_DEFAULT_LIMIT[zone];
  }
);

function submit() {
  const result = store.registerOrder({ ...form });
  if (result.ok) {
    ElMessage.success(result.message);
    form.code = "";
    form.address = "";
    form.receivable = 0;
  } else {
    ElMessage.error(result.message);
  }
}
</script>

<template>
  <form class="panel" @submit.prevent="submit">
    <h2>订单登记</h2>
    <p class="panel-hint">登记应收款、温区上限与返仓点；现金/电子支付在签收时录入并留快照。</p>
    <div class="form-grid">
      <label>
        订单编号
        <input v-model="form.code" required placeholder="如 DD20260921005" />
      </label>
      <label>
        收货地址
        <input v-model="form.address" placeholder="楼栋/门牌" />
      </label>
      <label>
        配送骑手
        <select v-model="form.riderId" required>
          <option v-for="r in store.riders" :key="r.id" :value="r.id">
            {{ r.name }}（占用 {{ store.loadOfRider(r.id) }}/{{ r.capacity }}）
          </option>
        </select>
      </label>
      <label>
        所属站点
        <select v-model="form.stationId" required>
          <option v-for="s in store.stations" :key="s.id" :value="s.id">
            {{ s.name }}（占用 {{ store.loadOfStation(s.id) }}/{{ s.capacity }}）
          </option>
        </select>
      </label>
      <label>
        返仓点
        <select v-model="form.returnPointId" required>
          <option v-for="p in store.returnPoints" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <label>
        温区
        <select v-model="form.tempZone">
          <option v-for="z in TEMP_ZONES" :key="z" :value="z">{{ z }}</option>
        </select>
      </label>
      <label>
        温度上限 ℃
        <input v-model.number="form.tempLimit" type="number" step="0.1" required />
      </label>
      <label>
        应收金额（元）
        <input v-model.number="form.receivable" type="number" min="0" step="0.01" required />
      </label>
      <button type="submit">登记订单</button>
    </div>
  </form>
</template>
