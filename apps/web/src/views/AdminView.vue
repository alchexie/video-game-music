<script setup lang="ts">
import { onMounted, ref } from 'vue'

import type { TrackListItem } from '@vgm/shared'

import {
  addTracksToCollection,
  commitLibrary,
  createCollection,
  fetchCollections,
  searchCatalog,
  syncCos,
  type CollectionSummary,
} from '../api/client'

const adminToken = ref(window.localStorage.getItem('vgm-admin-token') ?? '')
const collections = ref<CollectionSummary[]>([])
const selectedCollectionId = ref('')
const createForm = ref({
  title: '',
  description: '',
  status: 'draft' as 'draft' | 'published',
})
const jobResult = ref<string>('')
const searchKeyword = ref('')
const searchResults = ref<TrackListItem[]>([])
const loading = ref(false)

function saveToken() {
  window.localStorage.setItem('vgm-admin-token', adminToken.value)
}

async function loadCollections() {
  collections.value = await fetchCollections()
  if (!selectedCollectionId.value && collections.value.length > 0) {
    selectedCollectionId.value = collections.value[0]!.publicId
  }
}

async function runAction(action: 'commit' | 'sync') {
  loading.value = true
  jobResult.value = JSON.stringify({
    status: 'running',
    action,
    message: '任务执行中，请查看 API 终端日志获取实时进度。',
  }, null, 2)
  try {
    const result = action === 'commit'
      ? await commitLibrary()
      : await syncCos()
    jobResult.value = JSON.stringify(result, null, 2)
    await loadCollections()
  } finally {
    loading.value = false
  }
}

async function submitCollection() {
  loading.value = true
  try {
    await createCollection(createForm.value)
    createForm.value = { title: '', description: '', status: 'draft' }
    await loadCollections()
  } finally {
    loading.value = false
  }
}

async function runSearch() {
  if (!searchKeyword.value) {
    searchResults.value = []
    return
  }

  loading.value = true
  try {
    const result = await searchCatalog(searchKeyword.value)
    searchResults.value = result.tracks
  } finally {
    loading.value = false
  }
}

async function addTrack(trackId: string) {
  if (!selectedCollectionId.value) {
    return
  }

  loading.value = true
  try {
    await addTracksToCollection(selectedCollectionId.value, [trackId])
    await loadCollections()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadCollections()
})
</script>

<template>
  <div style="padding:8px 0 28px">
    <div class="section-eyebrow">管理后台</div>
    <h1 style="font-size:1.8rem;font-weight:900;letter-spacing:-0.02em;margin-top:6px">入库、同步与歌单整理</h1>
  </div>

  <div class="admin-grid">
      <el-card shadow="never">
        <template #header>
          <strong>管理令牌</strong>
        </template>
        <el-input v-model="adminToken" placeholder="可选的 x-admin-token" />
        <el-button class="admin-action" type="primary" @click="saveToken">
          保存令牌
        </el-button>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <strong>资源任务</strong>
        </template>
        <div class="admin-actions">
          <el-button :loading="loading" type="primary" @click="runAction('commit')">执行入库</el-button>
          <el-button :loading="loading" type="success" @click="runAction('sync')">同步到 COS</el-button>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <strong>创建歌单</strong>
        </template>
        <el-form label-position="top">
          <el-form-item label="标题">
            <el-input v-model="createForm.title" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="createForm.description" type="textarea" :rows="3" />
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="createForm.status">
              <el-option label="草稿" value="draft" />
              <el-option label="已发布" value="published" />
            </el-select>
          </el-form-item>
          <el-button :loading="loading" type="primary" @click="submitCollection">
            创建
          </el-button>
        </el-form>
      </el-card>
    </div>

  <div class="content-section">
    <div class="section-header">
      <div>
        <div class="section-eyebrow">主题歌单</div>
        <h2 class="section-title">添加曲目</h2>
      </div>
    </div>

    <div class="admin-toolbar" style="margin-bottom:16px">
      <el-select v-model="selectedCollectionId" placeholder="选择歌单">
        <el-option
          v-for="collection in collections"
          :key="collection.publicId"
          :label="collection.title"
          :value="collection.publicId"
        />
      </el-select>

      <el-input
        v-model="searchKeyword"
        placeholder="搜索要加入歌单的曲目"
        @keyup.enter="runSearch"
      />
      <el-button type="primary" @click="runSearch">
        搜索
      </el-button>
    </div>

    <div class="admin-results">
      <button
        v-for="track in searchResults"
        :key="track.publicId"
        class="track-row"
        type="button"
        @click="addTrack(track.publicId)"
      >
        <span class="track-index">{{ track.trackNumber || '·' }}</span>
        <span class="track-info">
          <span class="track-name">{{ track.title }}</span>
          <span class="track-artist">{{ track.artist }}</span>
        </span>
        <span class="track-duration" style="color:var(--accent)">加入歌单 +</span>
      </button>
    </div>

    <el-empty v-if="!searchResults.length" description="搜索曲目后可直接加入当前歌单。" />
  </div>

  <div class="content-section">
    <div class="section-header">
      <div>
        <div class="section-eyebrow">最近结果</div>
        <h2 class="section-title">任务输出</h2>
      </div>
    </div>
    <pre class="admin-output">{{ jobResult || '尚未执行任何任务。' }}</pre>
  </div>
</template>
