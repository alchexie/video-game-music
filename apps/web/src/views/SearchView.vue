<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { searchCatalog } from '../api/client'
import AlbumCard from '../components/AlbumCard.vue'
import TrackTable from '../components/TrackTable.vue'

const route = useRoute()
const loading = ref(false)
const result = ref<Awaited<ReturnType<typeof searchCatalog>>>({
  albums: [],
  tracks: [],
})

const keyword = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))

async function runSearch() {
  if (!keyword.value) {
    result.value = { albums: [], tracks: [] }
    return
  }

  loading.value = true
  try {
    result.value = await searchCatalog(keyword.value)
  } finally {
    loading.value = false
  }
}

watch(keyword, () => { void runSearch() })
onMounted(() => { void runSearch() })
</script>

<template>
  <div class="search-hero">
    <div class="section-eyebrow">搜索</div>
    <h1>"{{ keyword || '…' }}"</h1>
  </div>

  <el-empty
    v-if="!keyword"
    description="在顶部搜索框输入关键词后开始搜索。"
  >
    <template #image>
      <el-icon :size="48"><Search /></el-icon>
    </template>
  </el-empty>

  <el-skeleton :loading="loading" animated>
    <template #default>
      <section v-if="keyword" class="content-section">
        <div class="section-header">
          <div>
            <div class="section-eyebrow">专辑</div>
            <h2 class="section-title">{{ result.albums.length }} 条结果</h2>
          </div>
        </div>
        <div v-if="result.albums.length" class="card-grid">
          <AlbumCard v-for="album in result.albums" :key="album.publicId" :album="album" />
        </div>
        <el-empty v-else description="没有匹配到专辑。" />
      </section>

      <section v-if="keyword" class="content-section">
        <div class="section-header">
          <div>
            <div class="section-eyebrow">曲目</div>
            <h2 class="section-title">{{ result.tracks.length }} 条结果</h2>
          </div>
        </div>
        <TrackTable :tracks="result.tracks" queue-label="搜索结果" />
      </section>
    </template>
  </el-skeleton>
</template>