<script setup lang="ts">
import { useLogisticsStore } from "../store/logistics";

const store = useLogisticsStore();

const riderName = (id: string) => store.riderOf(id)?.name ?? id;
const stationName = (id: string) => store.stationOf(id)?.name ?? id;
const returnPointName = (id: string) => store.returnPointOf(id)?.name ?? id;
</script>

<template>
  <section class="panel">
    <h2>返仓单</h2>
    <p class="hint">超温拒收自动生成；未关闭前持续占用原骑手与站点容量。</p>
    <div v-if="store.state.returns.length === 0" class="empty">暂无返仓单</div>
    <div class="record-grid">
      <article v-for="item in store.state.returns" :key="item.id" class="record">
        <div class="record-head">
          <p class="record-title">{{ item.orderCode }} → {{ returnPointName(item.returnPointId) }}</p>
          <span class="status" :class="{ warn: item.status === '待返仓' }">{{ item.status }}</span>
        </div>
        <div class="details">
          <span>骑手：{{ riderName(item.riderId) }}</span>
          <span>站点：{{ stationName(item.stationId) }}</span>
          <span class="hot">温度：{{ item.tempNow }}℃ / 上限 {{ item.tempLimit }}℃</span>
          <span>{{ item.reason }}</span>
        </div>
        <div class="actions">
          <button v-if="item.status === '待返仓'" type="button" @click="store.closeReturn(item.id)">
            关闭返仓单（释放容量）
          </button>
          <span v-else class="hint">已于 {{ new Date(item.closedAt!).toLocaleString("zh-CN") }} 关闭</span>
        </div>
      </article>
    </div>
  </section>
</template>
