<script setup lang="ts">
// 界面层：返仓单台（占用原骑手/站点容量，关闭前不得释放）
import { computed, ref } from "vue";
import { ElMessageBox, ElMessage } from "element-plus";
import { useDeliveryStore } from "../store";

const store = useDeliveryStore();
const showClosed = ref(false);

const list = computed(() =>
  store.returns.filter((r) => (showClosed.value ? true : r.status === "待返仓"))
);

async function closeReturn(id: string, code: string) {
  try {
    await ElMessageBox.confirm(
      `确认关闭返仓单 ${code}？关闭后释放其占用的原骑手与站点容量。重新派送请另行登记订单。`,
      "关闭返仓单",
      { confirmButtonText: "关闭并释放容量", cancelButtonText: "取消", type: "warning" }
    );
  } catch {
    return;
  }
  const result = store.closeReturn(id);
  if (result.ok) ElMessage.success(result.message);
  else ElMessage.error(result.message);
}
</script>

<template>
  <section class="list-panel">
    <div class="toolbar">
      <h2>返仓单台</h2>
      <label class="checkline inline">
        <input v-model="showClosed" type="checkbox" />
        显示已关闭
      </label>
    </div>
    <div class="record-grid">
      <div v-if="list.length === 0" class="empty">暂无返仓单（仅超温拒收可生成）</div>
      <article v-for="r in list" :key="r.id" class="record return-card" :class="r.status === '已关闭' ? 'is-closed' : 'is-open'">
        <div class="record-head">
          <div>
            <p class="record-title">{{ r.code }}</p>
            <p class="record-sub">订单 {{ store.orderCode(r.orderId) }}</p>
          </div>
          <span class="status" :class="r.status === '已关闭' ? 'st-已签收' : 'st-拒收返仓'">{{ r.status }}</span>
        </div>
        <div class="details">
          <span>原骑手：{{ store.riderName(r.riderId) }}</span>
          <span>原站点：{{ store.stationName(r.stationId) }}</span>
          <span>返仓点：{{ store.returnPointName(r.returnPointId) }}</span>
          <span class="hot">实测 {{ r.actualTemp }}℃ / 上限 {{ r.tempLimit }}℃</span>
        </div>
        <p class="note">{{ r.reason }}</p>
        <p class="cap-tip">
          {{ r.status === "待返仓"
            ? `未关闭：持续占用骑手与站点容量（骑手占用 ${store.loadOfRider(r.riderId)}，站点占用 ${store.loadOfStation(r.stationId)}）`
            : `已关闭于 ${r.closedAt ? new Date(r.closedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}，容量已释放` }}
        </p>
        <div v-if="r.status === '待返仓'" class="actions">
          <button type="button" @click="closeReturn(r.id, r.code)">关闭返仓单并释放容量</button>
        </div>
      </article>
    </div>
  </section>
</template>
