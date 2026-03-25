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
  <section class="hero-panel">
    <div>
      <span class="eyebrow">本地优先曲库</span>
      <h1>浏览游戏音乐专辑，直接播放曲目，并随时为 COS 同步做好准备。</h1>
      <p>
        开发环境直接读取本地资源，按专辑自动聚合曲目；
        管理后台则负责人工维护跨专辑主题歌单。
      </p>
    </div>
    <div class="hero-stats">
      <article>
        <strong>{{ albums.length }}</strong>
        <span>专辑</span>
      </article>
      <article>
        <strong>{{ collections.length }}</strong>
        <span>主题歌单</span>
      </article>
    </div>
  </section>

  <el-skeleton :loading="loading" animated>
    <template #template>
      <div class="card-grid">
        <div v-for="item in 6" :key="item" class="media-card skeleton-card" />
      </div>
    </template>

    <template #default>
      <el-alert
        v-if="loadError"
        class="section-block"
        type="error"
        :closable="false"
        :title="loadError"
      />

      <section class="section-block">
        <div class="section-head">
          <div>
            <span class="eyebrow">系统生成</span>
            <h2>专辑集合</h2>
          </div>
          <small>共 {{ albums.length }} 张</small>
        </div>
        <div class="card-grid">
          <AlbumCard v-for="album in albums" :key="album.publicId" :album="album" />
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div>
            <span class="eyebrow">人工整理</span>
            <h2>主题歌单</h2>
          </div>
        </div>
        <div v-if="collections.length" class="card-grid card-grid--narrow">
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
