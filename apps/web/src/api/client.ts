import axios from 'axios'

import type {
  AlbumDetail,
  AlbumListItem,
  CollectionDetail,
  CollectionSummary,
  SearchResult,
  SeriesDetail,
  SeriesListItem,
  TrackRecord,
} from '@vgm/shared'

export type { CollectionSummary, SeriesListItem, SeriesDetail }

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('vgm-admin-token')
  if (token) {
    config.headers['x-admin-token'] = token
  }
  return config
})

export async function fetchMediaSource(): Promise<'local' | 'cos'> {
  const { data } = await api.get<{ source: 'local' | 'cos' }>('/media-source')
  return data.source
}

export async function fetchAlbums() {
  const { data } = await api.get<AlbumListItem[]>('/albums')
  return data
}

export async function fetchAlbum(id: string) {
  const { data } = await api.get<AlbumDetail>(`/albums/${id}`)
  return data
}

export async function fetchTrack(id: string) {
  const { data } = await api.get<TrackRecord>(`/tracks/${id}`)
  return data
}

export async function fetchCollections() {
  const { data } = await api.get<CollectionSummary[]>('/collections')
  return data
}

export async function fetchCollection(id: string) {
  const { data } = await api.get<CollectionDetail>(`/collections/${id}`)
  return data
}

export async function searchCatalog(query: string) {
  const { data } = await api.get<SearchResult>('/search', {
    params: { q: query },
  })
  return data
}

export async function fetchSeries() {
  const { data } = await api.get<SeriesListItem[]>('/series')
  return data
}

export async function fetchSeriesDetail(id: string) {
  const { data } = await api.get<SeriesDetail>(`/series/${id}`)
  return data
}

export async function commitLibrary() {
  const { data } = await api.post('/admin/import/commit')
  return data
}

export async function syncCos() {
  const { data } = await api.post('/admin/sync/cos')
  return data
}

export async function createCollection(payload: {
  title: string
  description?: string
  status: 'draft' | 'published'
}) {
  const { data } = await api.post('/admin/collections', payload)
  return data
}

export async function addTracksToCollection(collectionId: string, trackIds: string[]) {
  const { data } = await api.post(`/admin/collections/${collectionId}/tracks`, { trackIds })
  return data
}
