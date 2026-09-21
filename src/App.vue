<script setup lang="ts">
import { useLogisticsStore } from "./store/logistics";
import OrderForm from "./components/OrderForm.vue";
import OrderBoard from "./components/OrderBoard.vue";
import SettlementDesk from "./components/SettlementDesk.vue";
import ReturnDesk from "./components/ReturnDesk.vue";
import ConflictTable from "./components/ConflictTable.vue";

const store = useLogisticsStore();

const metrics = [
  { label: "待签收订单", value: () => store.pendingOrders.length },
  { label: "未挂账差额", value: () => `¥${store.openDiff.toFixed(2)}` },
  { label: "未关闭返仓单", value: () => store.openReturns.length },
  { label: "骑手剩余容量", value: () => store.capacityLeftTotal }
];
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">物流行业 · 城市末端配送模拟</p>
          <h1>到货签收与代收款项交接台</h1>
          <p class="subtitle">
            订单登记应收款、现金与电子支付、温区上限和返仓点；超温订单只能拒收生成返仓单，
            返仓单未关闭前占用原骑手与站点容量；交班时支付必须对平，差额未挂账不得签收。
          </p>
        </div>
        <div class="stack">
          <span class="tag">数据 / 规则 / 界面分离</span>
          <button class="secondary" type="button" @click="store.resetAll()">重置演示数据</button>
        </div>
      </header>

      <section class="metrics">
        <article v-for="metric in metrics" :key="metric.label" class="metric">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value() }}</strong>
        </article>
      </section>

      <section class="workspace">
        <div class="column">
          <OrderForm />
          <SettlementDesk />
        </div>
        <div class="column">
          <OrderBoard />
          <ReturnDesk />
          <ConflictTable />
        </div>
      </section>
    </div>
  </main>
</template>
