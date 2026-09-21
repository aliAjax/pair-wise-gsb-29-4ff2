<script setup lang="ts">
import { useLogisticsStore } from "../store/logistics";

const store = useLogisticsStore();

const fmt = (value: number) => `¥${value.toFixed(2)}`;
</script>

<template>
  <section class="panel">
    <h2>冲突列表</h2>
    <div v-if="store.conflicts.length === 0" class="empty">暂无冲突</div>
    <table v-else class="conflict-table">
      <thead>
        <tr>
          <th>类型</th>
          <th>订单</th>
          <th>骑手</th>
          <th>差额</th>
          <th>温度（实测/上限）</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="conflict in store.conflicts" :key="`${conflict.type}-${conflict.orderId}`">
          <td><span class="status warn">{{ conflict.type }}</span></td>
          <td>{{ conflict.orderCode }}</td>
          <td>{{ conflict.riderName }}</td>
          <td :class="{ hot: conflict.diff !== 0 }">
            {{ conflict.diff === 0 ? "—" : fmt(conflict.diff) }}
          </td>
          <td :class="{ hot: conflict.tempNow > conflict.tempLimit }">
            {{ conflict.tempNow }}℃ / {{ conflict.tempLimit }}℃
          </td>
          <td>{{ conflict.detail }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
