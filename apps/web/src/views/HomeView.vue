<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'

import type { AlbumListItem } from '@vgm/shared'

import { fetchAlbums, fetchCollections, type CollectionSummary } from '../api/client'
import AlbumCard from '../components/AlbumCard.vue'
import CollectionCard from '../components/CollectionCard.vue'

const loading = ref(true)
const albums = ref<AlbumListItem[]>([])
const collections = ref<CollectionSummary[]>([])
const loadError = ref('')

onMounted(async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [albumData, collectionData] = await Promise.all([
      fetchAlbums(),
      fetchCollections(),
    ])
    albums.value = albumData
    collections.value = collectionData
  } catch (error) {
    loadError.value = 'API 当前不可用，请确认后端开发服务已运行在 127.0.0.1:8787。'
    ElMessage.error(loadError.value)
    console.error(error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <el-skeleton :loading="loading" animated>
    <template #template>
      <div class="card-grid">
        <div v-for="item in 8" :key="item" class="media-card skeleton-card" />
      </div>
    </template>

    <template #default>
      <el-alert
        v-if="loadError"
        type="error"
        :closable="false"
        :title="loadError"
        style="margin-bottom:24px;border-radius:10px"
      />

      <section class="content-section">
        <div class="section-header">
          <div>
            <h2 class="section-title">专辑</h2>
          </div>
          <span class="section-count">共 {{ albums.length }} 张</span>
        </div>
        <div class="card-grid">
          <AlbumCard v-for="album in albums" :key="album.publicId" :album="album" />
        </div>
      </section>

      <section class="content-section">
        <div class="section-header">
          <div>
            <h2 class="section-title">歌单</h2>
          </div>
        </div>
        <div v-if="collections.length" class="card-grid">
          <CollectionCard
            v-for="collection in collections"
            :key="collection.publicId"
            :collection="collection"
          />
        </div>
        <el-empty v-else description="还没有主题歌单，可在管理页创建。" />
      </section>
    </template>
  </el-skeleton>
</template>
