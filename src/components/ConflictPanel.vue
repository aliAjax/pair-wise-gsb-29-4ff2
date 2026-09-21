<script setup lang="ts">
// 界面层：冲突台（订单、骑手、差额、温度）
import { computed } from "vue";
import { useDeliveryStore } from "../store";
import type { ConflictRow } from "../data/types";

const store = useDeliveryStore();

const groups = computed(() => {
  const map = new Map<string, ConflictRow[]>();
  for (const c of store.conflicts) {
    const list = map.get(c.type) ?? [];
    list.push(c);
    map.set(c.type, list);
  }
  return [...map.entries()];
});

const dangerCount = computed(() => store.conflicts.filter((c) => c.level === "danger").length);
</script>

<template>
  <section class="panel conflict-panel">
    <div class="toolbar">
      <h2>冲突台</h2>
      <span class="conflict-count" :class="dangerCount ? 'bad' : 'ok'">
        {{ store.conflicts.length ? `${dangerCount} 紧急 / ${store.conflicts.length} 总计` : "全部一致" }}
      </span>
    </div>

    <div v-if="store.conflicts.length === 0" class="empty">
      刷新后订单、款项、返仓单与版本一致，暂无冲突
    </div>

    <div v-for="[type, rows] in groups" :key="type" class="conflict-group">
      <p class="conflict-type">{{ type }}（{{ rows.length }}）</p>
      <div v-for="(c, i) in rows" :key="type + i" class="conflict-row" :class="c.level">
        <p>{{ c.detail }}</p>
        <div class="conflict-tags">
          <span v-if="c.orderId" class="ctag">订单 {{ store.orderCode(c.orderId) }}</span>
          <span v-if="c.riderId" class="ctag">骑手 {{ store.riderName(c.riderId) }}</span>
          <span v-if="c.stationId" class="ctag">站点 {{ store.stationName(c.stationId) }}</span>
          <span v-if="typeof c.diff === 'number'" class="ctag diff">差额 {{ c.diff.toFixed(2) }}</span>
          <span v-if="typeof c.actualTemp === 'number'" class="ctag hot">
            温度 {{ c.actualTemp }}℃ / {{ c.tempLimit }}℃
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
