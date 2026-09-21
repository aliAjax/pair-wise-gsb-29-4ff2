<script setup lang="ts">
// 界面层：订单工作台（签收 / 拒收 / 复签版本）
import { computed, ref } from "vue";
import { useDeliveryStore } from "../store";
import OrderCard from "./OrderCard.vue";

const store = useDeliveryStore();
const filter = ref("全部骑手");
const statusFilter = ref("全部状态");

const riderOptions = computed(() => ["全部骑手", ...store.riders.map((r) => r.name)]);
const statusOptions = ["全部状态", "已登记", "已签收", "拒收返仓"];

const list = computed(() =>
  store.orders.filter((o) => {
    const riderOk = filter.value === "全部骑手" || store.riderName(o.riderId) === filter.value;
    const statusOk = statusFilter.value === "全部状态" || o.status === statusFilter.value;
    return riderOk && statusOk;
  })
);
</script>

<template>
  <section class="list-panel">
    <div class="toolbar">
      <h2>到货签收台</h2>
      <div class="toolbar-filters">
        <select v-model="statusFilter">
          <option v-for="s in statusOptions" :key="s">{{ s }}</option>
        </select>
        <select v-model="filter">
          <option v-for="r in riderOptions" :key="r">{{ r }}</option>
        </select>
      </div>
    </div>
    <div class="record-grid">
      <div v-if="list.length === 0" class="empty">暂无匹配订单</div>
      <OrderCard v-for="order in list" :key="order.id" :order="order" />
    </div>
  </section>
</template>
