<script setup lang="ts">
import type { CollectionSummary } from '../api/client'

defineProps<{
  collection: CollectionSummary
}>()
</script>

<template>
  <RouterLink :to="`/collections/${collection.publicId}`" class="card-link">
    <article class="media-card media-card--compact">
      <div class="media-card-cover">
        <img
          v-if="collection.coverAssetId"
          :src="`/api/assets/${collection.coverAssetId}/cover`"
          :alt="collection.title"
        />
        <div v-else class="cover-fallback">
          歌单
        </div>
      </div>
      <div class="media-card-body">
        <strong>{{ collection.title }}</strong>
        <span>{{ collection.description || '人工主题歌单' }}</span>
        <small>{{ collection.trackCount }} 首 · {{ collection.status === 'published' ? '已发布' : '草稿' }}</small>
      </div>
    </article>
  </RouterLink>
</template>
