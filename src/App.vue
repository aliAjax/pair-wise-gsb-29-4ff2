<script setup lang="ts">
// 界面层：页面组装（数据 / 规则 / 界面三层分离，本文件只做布局）
import { computed, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useDeliveryStore } from "./store";
import OrderRegister from "./components/OrderRegister.vue";
import OrderDesk from "./components/OrderDesk.vue";
import HandoverDesk from "./components/HandoverDesk.vue";
import ReturnDesk from "./components/ReturnDesk.vue";
import ConflictPanel from "./components/ConflictPanel.vue";

const store = useDeliveryStore();
const tab = ref<"desk" | "handover" | "returns">("desk");

const tabs = [
  { key: "desk", label: "到货签收" },
  { key: "handover", label: "交班款项" },
  { key: "returns", label: "返仓处理" }
] as const;

const metrics = computed(() => {
  const registered = store.orders.filter((o) => o.status === "已登记").length;
  const signed = store.orders.filter((o) => o.status === "已签收").length;
  const openReturns = store.returns.filter((r) => r.status === "待返仓").length;
  const riderUsage = store.riders.map((r) => `${store.riderName(r.id)} ${store.loadOfRider(r.id)}/${r.capacity}`).join(" · ");
  return [
    { label: "待签收订单", value: registered },
    { label: "已签收订单", value: signed },
    { label: "待关闭返仓单", value: openReturns, danger: openReturns > 0 },
    { label: "骑手容量占用", value: riderUsage }
  ];
});

async function resetAll() {
  try {
    await ElMessageBox.confirm("将清空当前数据并恢复演示数据，确定继续？", "重置数据", {
      confirmButtonText: "重置",
      cancelButtonText: "取消",
      type: "warning"
    });
  } catch {
    return;
  }
  const result = store.resetAll();
  ElMessage.success(result.message);
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">物流行业前端最小闭环</p>
          <h1>城市末端配送模拟 · 到货签收与代收款交接台</h1>
          <p class="subtitle">
            订单登记应收款与温区上限；到货现金/电子支付对平方可签收，差额须挂账；
            超温只能拒收生成返仓单，未关闭持续占用原骑手与站点容量；签收留付款快照，复签带原因出新版本。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">Pinia</span>
          <span class="tag">TypeScript</span>
          <span class="tag">Element Plus</span>
          <button class="secondary reset-btn" type="button" @click="resetAll">重置演示数据</button>
        </div>
      </header>

      <section class="metrics">
        <article v-for="m in metrics" :key="m.label" class="metric" :class="{ danger: m.danger }">
          <span>{{ m.label }}</span>
          <strong>{{ m.value }}</strong>
        </article>
      </section>

      <nav class="tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="tab"
          :class="{ active: tab === t.key }"
          @click="tab = t.key"
        >
          {{ t.label }}
        </button>
      </nav>

      <section v-if="tab === 'desk'" class="workspace">
        <OrderRegister />
        <OrderDesk />
      </section>
      <section v-else-if="tab === 'handover'" class="workspace wide-left">
        <HandoverDesk />
      </section>
      <section v-else class="workspace wide-left">
        <ReturnDesk />
      </section>

      <ConflictPanel class="conflict-wrap" />

      <footer class="foot">
        数据保存在浏览器 localStorage（刷新后订单、款项、返仓单与版本一致）；业务规则全部集中在 src/rules，界面只负责交互。
      </footer>
    </div>
  </main>
</template>
