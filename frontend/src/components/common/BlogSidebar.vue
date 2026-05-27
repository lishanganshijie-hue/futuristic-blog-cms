<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useBlogStore, useAuthStore, useUserProfileStore, useInitStore } from '@/stores'
import { dashboardApi } from '@/api'
import { isCancelError } from '@/utils/error'

const props = defineProps<{
  hideUserCard?: boolean
}>()

const blogStore = useBlogStore()
const authStore = useAuthStore()
const userProfileStore = useUserProfileStore()
const initStore = useInitStore()

const stats = ref({
  articles: 0,
  views: 0,
  likes: 0,
  comments: 0
})

let statsFetchPromise: Promise<void> | null = null
let statsLastFetchTime = 0
const STATS_CACHE_TTL = 300000

const popularTags = computed(() => {
  return [...blogStore.tags]
    .sort((a, b) => b.article_count - a.article_count)
    .slice(0, 15)
})

const updateStatsFromStore = () => {
  if (blogStore.publicStats) {
    stats.value = {
      articles: blogStore.publicStats.total_articles,
      views: blogStore.publicStats.total_views,
      likes: blogStore.publicStats.total_likes,
      comments: blogStore.publicStats.total_comments
    }
    return true
  }
  return false
}

const fetchStats = async (force = false) => {
  if (!force && updateStatsFromStore()) {
    return
  }
  
  const now = Date.now()
  if (!force && now - statsLastFetchTime < STATS_CACHE_TTL) {
    return
  }
  
  if (statsFetchPromise) {
    return statsFetchPromise
  }
  
  statsFetchPromise = (async () => {
    try {
      const response = await dashboardApi.getPublicStats()
      stats.value = {
        articles: response.data.total_articles,
        views: response.data.total_views,
        likes: response.data.total_likes,
        comments: response.data.total_comments
      }
      statsLastFetchTime = Date.now()
    } catch (error: unknown) {
      if (isCancelError(error)) {
        return
      }
      console.error('Failed to fetch stats:', error)
    } finally {
      statsFetchPromise = null
    }
  })()
  
  return statsFetchPromise
}

watch(() => authStore.isAuthenticated, (isAuthenticated) => {
  if (isAuthenticated) {
    userProfileStore.fetchProfile()
  } else {
    userProfileStore.clearProfile()
  }
})

watch(() => blogStore.publicStats, (newStats) => {
  if (newStats) {
    stats.value = {
      articles: newStats.total_articles,
      views: newStats.total_views,
      likes: newStats.total_likes,
      comments: newStats.total_comments
    }
  }
})

watch(() => initStore.isCoreInitialized, (initialized) => {
  if (initialized && !blogStore.publicStats) {
    fetchStats(true)
  }
})

onMounted(() => {
  if (!updateStatsFromStore()) {
    if (initStore.isCoreInitialized) {
      fetchStats()
    }
  }
  
  if (authStore.isAuthenticated && !userProfileStore.profile) {
    userProfileStore.fetchProfile()
  }
})
</script>

<template>
  <aside aria-label="全站导航与统计面板" class="blog-sidebar">
    
    <section class="sidebar-widget sidebar-widget-compact">
      <h3 class="sidebar-widget-title sidebar-widget-title-compact flex items-center gap-2">
        <svg aria-hidden="true" class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        数据看板
      </h3>
      <dl class="grid grid-cols-2 gap-2 m-0">
        <div class="text-center p-2 bg-gray-50 dark:bg-dark-300/50 rounded-lg">
          <svg aria-hidden="true" class="w-4 h-4 mx-auto mb-0.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <dd class="text-lg font-bold text-primary m-0">{{ stats.articles }}</dd>
          <dt class="text-xs text-gray-500">内容数</dt>
        </div>
        <div class="text-center p-2 bg-gray-50 dark:bg-dark-300/50 rounded-lg">
          <svg aria-hidden="true" class="w-4 h-4 mx-auto mb-0.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <dd class="text-lg font-bold text-accent m-0">{{ stats.views }}</dd>
          <dt class="text-xs text-gray-500">阅读量</dt>
        </div>
        <div class="text-center p-2 bg-gray-50 dark:bg-dark-300/50 rounded-lg">
          <svg aria-hidden="true" class="w-4 h-4 mx-auto mb-0.5 text-cyber-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <dd class="text-lg font-bold text-cyber-pink m-0">{{ stats.likes }}</dd>
          <dt class="text-xs text-gray-500">点赞量</dt>
        </div>
        <div class="text-center p-2 bg-gray-50 dark:bg-dark-300/50 rounded-lg">
          <svg aria-hidden="true" class="w-4 h-4 mx-auto mb-0.5 text-cyber-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <dd class="text-lg font-bold text-cyber-green m-0">{{ stats.comments }}</dd>
          <dt class="text-xs text-gray-500">总互动</dt>
        </div>
      </dl>
    </section>

    <nav aria-label="博客分类导航" class="sidebar-widget sidebar-widget-compact" style="min-height: 180px;">
      <h3 class="sidebar-widget-title sidebar-widget-title-compact flex items-center gap-2">
        <svg aria-hidden="true" class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        内容分类
      </h3>
      
      <div v-if="blogStore.categories.length" class="space-y-0.5">
        <router-link
          v-for="category in blogStore.categories"
          :key="category.id"
          :to="`/categories/${category.slug}`"
          :title="`查看分类：${category.name} (共 ${category.article_count} 篇文章)`"
          class="flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-primary hover:bg-primary/5 transition-all group"
        >
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full" aria-hidden="true" :style="{ backgroundColor: category.color }" />
            <span>{{ category.name }}</span>
          </div>
          <span class="text-xs text-gray-400 group-hover:text-primary" :aria-label="`文章数量：${category.article_count}`">
            {{ category.article_count }}
          </span>
        </router-link>
      </div>

      <div v-else class="space-y-3 px-2 py-1.5 animate-pulse">
        <div class="h-4 bg-gray-200 dark:bg-dark-300 rounded w-4/5"></div>
        <div class="h-4 bg-gray-200 dark:bg-dark-300 rounded w-3/4"></div>
        <div class="h-4 bg-gray-200 dark:bg-dark-300 rounded w-5/6"></div>
        <div class="h-4 bg-gray-200 dark:bg-dark-300 rounded w-2/3"></div>
      </div>
    </nav>

    <nav aria-label="热门标签" class="sidebar-widget sidebar-widget-compact" style="min-height: 140px;">
      <h3 class="sidebar-widget-title sidebar-widget-title-compact flex items-center gap-2">
        <svg aria-hidden="true" class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        高频标签
      </h3>
      
      <div v-if="popularTags.length" class="flex flex-wrap gap-1">
        <router-link
          v-for="tag in popularTags"
          :key="tag.id"
          :to="`/tags/${tag.slug}`"
          :title="`浏览标签：${tag.name}`"
          class="tag-badge text-xs text-gray-500 dark:text-gray-400 hover:text-primary hover:border-primary/30"
          :style="{ color: tag.color, backgroundColor: tag.color + '10', borderColor: tag.color + '30' }"
        >
          {{ tag.name }}
        </router-link>
      </div>

      <div v-else class="flex flex-wrap gap-2 px-1 animate-pulse">
        <div class="h-5 bg-gray-200 dark:bg-dark-300 rounded w-12"></div>
        <div class="h-5 bg-gray-200 dark:bg-dark-300 rounded w-16"></div>
        <div class="h-5 bg-gray-200 dark:bg-dark-300 rounded w-14"></div>
        <div class="h-5 bg-gray-200 dark:bg-dark-300 rounded w-20"></div>
        <div class="h-5 bg-gray-200 dark:bg-dark-300 rounded w-10"></div>
        <div class="h-5 bg-gray-200 dark:bg-dark-300 rounded w-16"></div>
        <div class="h-5 bg-gray-200 dark:bg-dark-300 rounded w-12"></div>
      </div>
    </nav>

  </aside>
</template>