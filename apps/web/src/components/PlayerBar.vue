<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { usePlayerStore } from '../stores/player'
import { formatDuration } from '../utils/format'

const player = usePlayerStore()
const audioRef = ref<HTMLAudioElement>()

onMounted(() => {
  if (audioRef.value) {
    player.bindAudio(audioRef.value)
  }
})

const progress = computed(() => (
  player.duration > 0 ? player.currentTime / player.duration : 0
))
</script>

<template>
  <footer class="player-bar">
    <audio ref="audioRef" preload="none" />

    <!-- Left: cover + track info -->
    <div class="player-track">
      <div class="player-cover">
        <img
          v-if="player.coverAssetId"
          :src="`/api/assets/${player.coverAssetId}/cover`"
          alt=""
        />
        <div v-else class="player-cover-fallback">🎵</div>
      </div>
      <div class="player-meta">
        <span class="player-title">{{ player.currentTrack?.title ?? '选择曲目开始播放' }}</span>
        <span class="player-artist">{{ player.currentTrack?.artist ?? player.queueLabel }}</span>
      </div>
    </div>

    <!-- Center: controls + progress -->
    <div class="player-center">
      <div class="player-controls">
        <button class="ctrl-btn" title="上一首" @click="player.previous">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
          </svg>
        </button>
        <button class="ctrl-btn ctrl-btn--play" :title="player.isPlaying ? '暂停' : '播放'" @click="player.toggle">
          <svg v-if="player.isPlaying" width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
          <svg v-else width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <button class="ctrl-btn" title="下一首" @click="player.next">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z" />
          </svg>
        </button>
      </div>

      <div class="player-progress-row">
        <span class="time-label">{{ formatDuration(Math.round(player.currentTime)) }}</span>
        <el-slider
          :model-value="progress"
          :max="1"
          :step="0.001"
          :show-tooltip="false"
          @input="player.seek"
        />
        <span class="time-label">{{ formatDuration(Math.round(player.duration)) }}</span>
      </div>
    </div>

    <!-- Right: volume -->
    <div class="player-right">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" class="volume-icon">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </svg>
      <el-slider
        :model-value="1"
        :max="1"
        :step="0.01"
        :show-tooltip="false"
        class="volume-slider"
        @input="() => {}"
      />
    </div>
  </footer>
</template>
