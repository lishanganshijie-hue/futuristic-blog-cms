<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useSiteConfigStore, useSocialLinksStore } from '@/stores'

const siteConfigStore = useSiteConfigStore()
const socialLinksStore = useSocialLinksStore()

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

// 完美保留：原汁原味的后台图片路径解析
const getLogoUrl = (url: string) => {
  if (!url) return ''
  if (url.startsWith('http')) return url
  if (url.startsWith('/')) return url
  return `/${url}`
}

// 借鉴高分博客：防爬虫动态邮件唤起
const handleEmailClick = (e: MouseEvent, rawUrl: string) => {
  if (!rawUrl.startsWith('mailto:')) return
  e.preventDefault()
  const email = rawUrl.replace('mailto:', '')
  const tempLink = document.createElement('a')
  tempLink.href = `mailto:${email}`
  tempLink.click()
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
})
</script>

<template>
  <aside class="w-full flex flex-col gap-4 select-none animate-fade-in">
    
    <div class="w-full rounded-2xl bg-white dark:bg-[#1a1a2e]/60 border border-gray-100 dark:border-white/[0.05] p-4 shadow-sm backdrop-blur-md transition-all duration-300 min-h-[340px] flex flex-col justify-between">
      
      <router-link
        to="/about"
        aria-label="Go to About Page"
        class="group block relative mx-auto mt-1 mb-4 w-44 h-44 overflow-hidden rounded-2xl shadow-inner active:scale-95 transition-all duration-300 ease-out cursor-pointer"
      >
        <div class="absolute inset-0 transition-all duration-300 pointer-events-none bg-black/0 group-hover:bg-black/30 group-active:bg-black/50 w-full h-full z-20 flex items-center justify-center">
          <svg 
            class="transition-all duration-300 transform scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 text-white w-10 h-10" 
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 7.5-7.5z" />
          </svg>
        </div>
        
        <img
          v-if="siteConfigStore.siteLogoUrl"
          :src="getLogoUrl(siteConfigStore.siteLogoUrl)"
          :alt="siteConfigStore.siteName"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          crossorigin="anonymous"
          loading="eager"
          fetchpriority="high"
        >
        
        <div v-else class="w-full h-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
          <svg viewBox="0 0 100 100" class="w-16 h-16">
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
        <div class="font-bold text-xl text-center mb-1.5 text-gray-800 dark:text-neutral-50 transition-colors duration-300">
          {{ siteConfigStore.siteName }}
        </div>
        
        <div class="h-1 w-5 bg-primary mx-auto rounded-full mb-3 opacity-80 transition-all"></div>
        
        <div class="text-center text-sm text-gray-500 dark:text-neutral-400 mb-4 font-normal leading-relaxed max-w-[240px] mx-auto">
          {{ siteConfigStore.siteDescription || 'Code for Future, Share for Growth.' }}
        </div>

        <div v-if="socialLinksStore.hasSocialLinks" class="flex flex-wrap gap-2 justify-center mb-1">
          <a
            v-for="link in socialLinksStore.socialLinks"
            :key="link.id"
            :href="link.icon === 'email' ? '#' : link.url"
            :target="link.icon === 'email' ? undefined : '_blank'"
            :rel="link.icon === 'email' ? undefined : 'noopener noreferrer'"
            /* 🌟 复刻原代码 btn-regular：自带微动效和高灵敏度 active 按压反馈 */
            class="w-10 h-10 rounded-xl bg-gray-50 hover:bg-primary/10 dark:bg-white/[0.03] dark:hover:bg-primary/20 flex items-center justify-center text-gray-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary border border-gray-100 dark:border-white/[0.05] hover:border-primary/20 active:scale-90 transition-all duration-200 relative"
            @click="link.icon === 'email' && handleEmailClick($event, link.url)"
            @mouseenter="showTooltip(link.id)"
            @mouseleave="hideTooltip"
          >
            <svg v-if="link.icon === 'github'" class="w-[1.25rem] h-[1.25rem]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
            <svg v-else-if="link.icon === 'email'" class="w-[1.25rem] h-[1.25rem]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <svg v-else-if="link.icon === 'blog'" class="w-[1.25rem] h-[1.25rem]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
            
            <span v-if="activeTooltip === link.id" class="action-tooltip">{{ link.name }}</span>
          </a>
        </div>
      </div>
    </div>

    <div v-if="showGithubSection" class="w-full rounded-2xl bg-white dark:bg-[#1a1a2e]/60 border border-gray-100 dark:border-white/[0.05] p-4 shadow-sm backdrop-blur-md transition-all duration-300">
      <h3 class="text-sm font-bold text-gray-800 dark:text-neutral-200 mb-3 flex items-center gap-2 px-1">
        <svg class="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        GitHub 项目状态
      </h3>
      <a :href="siteConfigStore.githubRepoUrl" target="_blank" rel="noopener noreferrer" class="block group">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between p-2.5 bg-gray-50/50 dark:bg-white/[0.01] rounded-xl border border-gray-50 dark:border-transparent group-hover:border-primary/10 transition-all duration-300">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span class="text-xs text-gray-500 dark:text-neutral-400">Stars</span>
            </div>
            <span class="text-sm font-bold text-gray-800 dark:text-neutral-200 group-hover:text-primary transition-colors">
              {{ formatCount(siteConfigStore.githubStats?.stars || 0) }}
            </span>
          </div>
          <div class="flex items-center justify-between p-2.5 bg-gray-50/50 dark:bg-white/[0.01] rounded-xl border border-gray-50 dark:border-transparent group-hover:border-primary/10 transition-all duration-300">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              <span class="text-xs text-gray-500 dark:text-neutral-400">Forks</span>
            </div>
            <span class="text-sm font-bold text-gray-800 dark:text-neutral-200 group-hover:text-primary transition-colors">
              {{ formatCount(siteConfigStore.githubStats?.forks || 0) }}
            </span>
          </div>
        </div>
      </a>
    </div>
  </aside>
</template>

<style scoped>
/* 精美悬浮气泡 */
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
  border: 1px border #f3f4f6;
  animation: tooltip-fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.dark .action-tooltip {
  background: #181825;
  color: #f1f5f9;
  border: 1px solid rgba(255,255,255,0.05);
}

@keyframes tooltip-fade-in {
  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>