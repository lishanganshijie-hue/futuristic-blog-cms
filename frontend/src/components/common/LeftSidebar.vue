<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useSiteConfigStore, useSocialLinksStore, useBlogStore, useUserProfileStore } from '@/stores'

const siteConfigStore = useSiteConfigStore()
const socialLinksStore = useSocialLinksStore()
const blogStore = useBlogStore()
const userProfileStore = useUserProfileStore() // 🚀 实例化后台用户资料 Store

const activeTooltip = ref<string | null>(null)

const showTooltip = (id: string) => {
  activeTooltip.value = id
}

const hideTooltip = () => {
  activeTooltip.value = null
}

const showGithubSection = computed(() => {
  return siteConfigStore.showGithubStats && siteConfigStore.githubRepoUrl
})

const formatCount = (count: number) => {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k'
  }
  return count.toString()
}

const getLogoUrl = (url: string) => {
  if (!url) return ''
  if (url.startsWith('http')) return url
  if (url.startsWith('/')) return url
  return `/${url}`
}

// 🚀 【完美修复】精简逻辑，直接拥抱固定头像，放行 TypeScript 编译
const adminAvatar = computed(() => {
  // 1. 如果管理员登录了，展现后端数据库里最新的动态头像路径
  if (userProfileStore.profile?.avatar_url) {
    return userProfileStore.profile.avatar_url
  }
  
  // 2. 如果是未登录的普通访客，直接雷打不动地展示你的 R2 头像
  const guestAvatarLink = 'https://ipooo.ccwu.cc/avatars/avatar_2.webp'
  
  // 3. 如果有值就直接返回，没有就用站点 Logo 兜底
  return guestAvatarLink || siteConfigStore.siteLogoUrl || ''
})

const handleEmailClick = (e: MouseEvent, rawUrl: string) => {
  if (!rawUrl.startsWith('mailto:')) return
  e.preventDefault()
  const email = rawUrl.replace('mailto:', '')
  const tempLink = document.createElement('a')
  tempLink.href = `mailto:${email}`
  tempLink.click()
}

const announcements = computed(() => blogStore.announcements)

const popularArticles = computed(() => {
  return [...blogStore.articles]
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 5)
})

const getTypeIcon = (type: string) => {
  const icons = {
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
  }
  return icons[type as keyof typeof icons] || icons.info
}

const getTypeColor = (type: string) => {
  const colors = {
    info: 'text-blue-500',
    warning: 'text-amber-500',
    success: 'text-emerald-500',
    error: 'text-red-500'
  }
  return colors[type as keyof typeof colors] || colors.info
}

const getIsoDate = (date: string) => {
  if (!date) return ''
  return new Date(date).toISOString()
}

const formatDate = (date: string) => {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const hasFetchedGithub = ref(false)
watch(() => siteConfigStore.showGithubStats, (show) => {
  if (show && siteConfigStore.githubRepoUrl && !hasFetchedGithub.value) {
    hasFetchedGithub.value = true
    siteConfigStore.fetchGithubStats().catch(() => {
      hasFetchedGithub.value = false
    })
  }
}, { immediate: true })

onMounted(() => {
  socialLinksStore.fetchProfile()
  // 🚀 【核心优化】配合已经重构的 userProfile Store，401已被静默吞掉，此处不加冗余的 console.error 污染控制台
  userProfileStore.fetchProfile().catch(() => {})
})
</script>

<template>
  <aside aria-label="作者名片与博客导航" class="w-full flex flex-col gap-4 select-none animate-fade-in">
    
    <section class="w-full rounded-2xl bg-white dark:bg-[#1a1a2e]/60 border border-gray-100 dark:border-white/[0.05] p-3 shadow-sm backdrop-blur-md transition-all duration-300 min-h-[340px] flex flex-col justify-between">
      <router-link
        to="/about"
        :aria-label="`关于作者 ${siteConfigStore.siteName}`"
        class="group block relative mx-auto mt-1 lg:mx-0 lg:mt-0 mb-3 max-w-48 lg:max-w-none w-full aspect-square overflow-hidden rounded-xl active:scale-95 transition-all duration-300 ease-out cursor-pointer"
      >
        <div class="absolute inset-0 transition-all duration-300 pointer-events-none bg-black/0 group-hover:bg-black/30 group-active:bg-black/50 w-full h-full z-20 flex items-center justify-center">
          <svg class="transition-all duration-300 transform scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 text-white w-12 h-12" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 7.5-7.5z" />
          </svg>
        </div>
        
        <img
          v-if="adminAvatar"
          :src="getLogoUrl(adminAvatar)"
          :alt="`${siteConfigStore.siteName} 的个人头像`"
          class="mx-auto lg:w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="eager"
          fetchpriority="high"
        >
        
        <div v-else class="w-full h-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
          <svg viewBox="0 0 100 100" class="w-16 h-16" aria-hidden="true">
            <defs>
              <linearGradient id="sidebar-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
              </linearGradient>
            </defs>
            <text x="50" y="68" font-family="monospace" font-size="55" font-weight="bold" fill="url(#sidebar-logo-grad)" text-anchor="middle">F</text>
          </svg>
        </div>
      </router-link>

      <div class="px-2">
        <h2 class="font-bold text-xl text-center mb-1 text-gray-800 dark:text-neutral-50 transition-colors duration-300">
          {{ siteConfigStore.siteName }}
        </h2>
        
        <div class="h-1 w-5 bg-primary mx-auto rounded-full mb-2 opacity-80 transition-all" aria-hidden="true"></div>
        
        <p class="text-center text-sm text-neutral-400 mb-2.5 font-normal leading-relaxed max-w-[240px] mx-auto">
          {{ siteConfigStore.siteDescription || 'Code for Future, Share for Growth.' }}
        </p>

        <nav v-if="socialLinksStore.hasSocialLinks" aria-label="社交链接" class="flex flex-wrap gap-2 justify-center mb-1">
          <a
            v-for="link in socialLinksStore.socialLinks"
            :key="link.id"
            :href="link.icon === 'email' ? '#' : link.url"
            :target="link.icon === 'email' ? undefined : '_blank'"
            :rel="link.icon === 'email' ? undefined : 'noopener noreferrer external'"
            :aria-label="`访问我的 ${link.name}`"
            :title="link.name"
            class="w-10 h-10 rounded-lg bg-gray-50 hover:bg-primary/10 dark:bg-white/[0.03] dark:hover:bg-primary/20 flex items-center justify-center text-gray-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary border border-gray-100 dark:border-white/[0.05] hover:border-primary/20 active:scale-90 transition-all duration-200 relative"
            @click="link.icon === 'email' && handleEmailClick($event, link.url)"
            @mouseenter="showTooltip(link.id)"
            @mouseleave="hideTooltip"
          >
            <svg v-if="link.icon === 'github'" aria-hidden="true" class="w-[1.5rem] h-[1.5rem]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
            <svg v-if="link.icon === 'email'" aria-hidden="true" class="w-[1.5rem] h-[1.5rem]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <svg v-if="link.icon === 'blog'" aria-hidden="true" class="w-[1.5rem] h-[1.5rem]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
            
            <span v-if="activeTooltip === link.id" class="action-tooltip" aria-hidden="true">{{ link.name }}</span>
          </a>
        </nav>
      </div>
    </section>

    <section 
      v-if="announcements.length > 0" 
      class="w-full rounded-2xl bg-white dark:bg-[#1a1a2e]/60 border border-gray-100 dark:border-white/[0.05] p-4 shadow-sm backdrop-blur-md transition-all duration-300 min-h-[115px]"
    >
      <h3 class="text-sm font-bold text-gray-800 dark:text-neutral-200 mb-3 flex items-center gap-2 px-1">
        <svg aria-hidden="true" class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
        最新公告
      </h3>
  
      <div class="space-y-3">
        <article v-for="announcement in announcements" :key="announcement.id" class="group animate-subtle-fade">
          <div class="flex items-start gap-2">
            <svg aria-hidden="true" :class="['w-4 h-4 mt-0.5 flex-shrink-0', getTypeColor(announcement.type)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getTypeIcon(announcement.type)" />
            </svg>
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-semibold text-gray-800 dark:text-neutral-200 group-hover:text-primary transition-colors mb-1">
                {{ announcement.title }}
              </h4>
              <p class="text-xs text-gray-500 dark:text-neutral-400 leading-relaxed">
                {{ announcement.content }}
              </p>
              <time :datetime="getIsoDate(announcement.updated_at || announcement.created_at)" class="block text-[10px] text-gray-400 dark:text-neutral-500 mt-1">
                {{ formatDate(announcement.updated_at || announcement.created_at) }}
              </time>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section v-if="showGithubSection" class="w-full rounded-2xl bg-white dark:bg-[#1a1a2e]/60 border border-gray-100 dark:border-white/[0.05] p-4 shadow-sm backdrop-blur-md transition-all duration-300">
      <h3 class="text-sm font-bold text-gray-800 dark:text-neutral-200 mb-3 flex items-center gap-2 px-1">
        <svg aria-hidden="true" class="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        开源动态
      </h3>
      <a :href="siteConfigStore.githubRepoUrl" target="_blank" rel="noopener noreferrer external" :title="`访问 ${siteConfigStore.siteName} 的 GitHub 仓库`" class="block group">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between p-2.5 bg-gray-50/50 dark:bg-white/[0.01] rounded-xl border border-gray-50 dark:border-transparent group-hover:border-primary/10 transition-all duration-300">
            <div class="flex items-center gap-2">
              <svg aria-hidden="true" class="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span class="text-xs text-gray-500 dark:text-neutral-400">Stars</span>
            </div>
            <span class="text-sm font-bold text-gray-800 dark:text-neutral-200 group-hover:text-primary transition-colors">
              {{ formatCount(siteConfigStore.githubStats?.stars || 0) }}
            </span>
          </div>
          <div class="flex items-center justify-between p-2.5 bg-gray-50/50 dark:bg-white/[0.01] rounded-xl border border-gray-50 dark:border-transparent group-hover:border-primary/10 transition-all duration-300">
            <div class="flex items-center gap-2">
              <svg aria-hidden="true" class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              <span class="text-xs text-gray-500 dark:text-neutral-400">Forks</span>
            </div>
            <span class="text-sm font-bold text-gray-800 dark:text-neutral-200 group-hover:text-primary transition-colors">
              {{ formatCount(siteConfigStore.githubStats?.forks || 0) }}
            </span>
          </div>
        </div>
      </a>
    </section>

    <section v-if="popularArticles.length > 0" class="w-full rounded-2xl bg-white dark:bg-[#1a1a2e]/60 border border-gray-100 dark:border-white/[0.05] p-4 shadow-sm backdrop-blur-md transition-all duration-300">
      <h3 class="text-sm font-bold text-gray-800 dark:text-neutral-200 mb-3 flex items-center gap-2 px-1">
        <svg aria-hidden="true" class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
        热门文章推荐
      </h3>
      <div class="space-y-2">
        <router-link
          v-for="(article, index) in popularArticles"
          :key="article.id"
          :to="`/article/${article.slug}`"
          :title="article.title"
          class="flex gap-2 group p-1.5 hover:bg-gray-50 dark:hover:bg-white/[0.02] rounded-lg transition-colors"
        >
          <span
            aria-hidden="true"
            class="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold mt-0.5"
            :class="index < 3 ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-dark-300 text-gray-400'"
          >
            {{ index + 1 }}
          </span>
          <div class="flex-1 min-w-0">
            <h4 class="text-xs text-gray-700 dark:text-gray-300 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
              {{ article.title }}
            </h4>
            <div class="mt-1 flex items-center text-[10px] text-gray-500" :aria-label="`阅读量：${article.view_count}`">
              <svg aria-hidden="true" class="w-2.5 h-2.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {{ article.view_count }}
            </div>
          </div>
        </router-link>
      </div>
    </section>

  </aside>
</template>

<style scoped>
.animate-fade-in {
  animation: sidebarFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes sidebarFadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-subtle-fade {
  animation: subtleFadeIn 0.3s ease-out forwards;
}

@keyframes subtleFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.action-tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  padding: 5px 10px;
  background: #ffffff;
  color: #1a1a2e;
  font-size: 11px;
  font-weight: 600;
  border-radius: 8px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 50;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid #f3f4f6;
  animation: tooltip-fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.dark .action-tooltip {
  background: #181825;
  color: #f1f5f9;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

@keyframes tooltip-fade-in {
  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>