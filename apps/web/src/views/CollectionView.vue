<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import type { CollectionDetail } from '@vgm/shared'

import { fetchCollection } from '../api/client'
import TrackTable from '../components/TrackTable.vue'

const route = useRoute()
const loading = ref(true)
const collection = ref<CollectionDetail>()
const loadError = ref('')

async function loadCollection() {
  loading.value = true
  loadError.value = ''
  try {
    collection.value = await fetchCollection(route.params.id as string)
  } catch (error) {
    collection.value = undefined
    loadError.value = '歌单数据加载失败。'
    ElMessage.error(loadError.value)
    console.error(error)
  } finally {
    loading.value = false
  }
}

watch(() => route.params.id, () => { void loadCollection() })
onMounted(() => { void loadCollection() })

const coverUrl = computed(() => (
  collection.value?.coverAssetId ? `/api/assets/${collection.value.coverAssetId}/cover` : ''
))
</script>

<template>
  <el-skeleton :loading="loading" animated>
    <template #default>
      <el-alert
        v-if="loadError"
        type="error"
        :closable="false"
        :title="loadError"
        style="margin-bottom:24px;border-radius:10px"
      />

      <template v-if="collection">
        <div class="page-hero">
          <div class="page-hero-cover">
            <img v-if="collection.coverAssetId" :src="coverUrl" :alt="collection.title" />
            <div v-else class="page-hero-cover-fallback">🎵</div>
          </div>
          <div class="page-hero-meta">
            <span class="page-hero-type">主题歌单</span>
            <h1 class="page-hero-title">{{ collection.title }}</h1>
            <p class="page-hero-sub">{{ collection.description || '从不同来源曲目中人工整理的固定歌单。' }}</p>
            <p class="page-hero-sub">{{ collection.tracks.length }} 首曲目 &middot; {{ collection.status === 'published' ? '已发布' : '草稿' }}</p>
          </div>
        </div>

        <section class="content-section">
          <div class="section-header">
            <div>
              <div class="section-eyebrow">歌单内容</div>
              <h2 class="section-title">曲目列表</h2>
            </div>
          </div>
          <TrackTable
            :tracks="collection.tracks"
            :queue-label="collection.title"
            :cover-asset-id="collection.coverAssetId"
          />
        </section>
      </template>

      <el-empty v-else-if="!loading && !loadError" description="未找到该歌单。" />
    </template>
  </el-skeleton>
</template>
