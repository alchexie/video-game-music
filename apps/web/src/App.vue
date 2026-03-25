<script setup lang="ts">
import { HomeFilled, Search, SetUp } from '@element-plus/icons-vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import PlayerBar from './components/PlayerBar.vue'

const route = useRoute()
const router = useRouter()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')

watch(
  () => route.query.q,
  (value) => {
    search.value = typeof value === 'string' ? value : ''
  },
)

const isAdminRoute = computed(() => route.path.startsWith('/admin'))
const isSearchRoute = computed(() => route.path.startsWith('/search'))

function submitSearch() {
  router.push({
    name: 'search',
    query: search.value ? { q: search.value } : {},
  })
}
</script>

<template>
  <aside class="sidebar">
    <RouterLink class="sidebar-brand" to="/">
      <div class="sidebar-logo">🎮</div>
      <div class="sidebar-name">
        <small>电子游戏音乐</small>
        <strong>VGM 曲库</strong>
      </div>
    </RouterLink>

    <div class="sidebar-nav">
      <span class="sidebar-section-label">浏览</span>
      <RouterLink class="nav-item" :class="{ active: route.path === '/' }" to="/">
        <el-icon><HomeFilled /></el-icon>
        <span>首页</span>
      </RouterLink>
      <RouterLink class="nav-item" :class="{ active: isSearchRoute }" to="/search">
        <el-icon><Search /></el-icon>
        <span>搜索</span>
      </RouterLink>
      <span class="sidebar-section-label">系统</span>
      <RouterLink class="nav-item" :class="{ active: isAdminRoute }" to="/admin">
        <el-icon><SetUp /></el-icon>
        <span>管理后台</span>
      </RouterLink>
    </div>
  </aside>

  <div class="main-content">
    <div class="main-topbar">
      <el-input
        v-model="search"
        class="topbar-search"
        placeholder="搜索专辑或曲目…"
        @keyup.enter="submitSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <div class="page-container">
      <RouterView />
    </div>
  </div>

  <PlayerBar />
</template>
