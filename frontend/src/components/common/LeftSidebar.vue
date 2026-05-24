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

const getLogoUrl = (url: string) => {
  if (!url) return ''
  if (url.startsWith('http')) return url
  if (url.startsWith('/')) return url
  return `/${url}`
}

watch(() => siteConfigStore.showGithubStats, (show) => {
  if (show && siteConfigStore.githubRepoUrl) {
    if (!siteConfigStore.githubStats || siteConfigStore.githubStats.stars === 0) {
      siteConfigStore.fetchGithubStats()
    }
  }
}, { immediate: true })

watch(() => siteConfigStore.githubRepoUrl, (url) => {
  if (url && siteConfigStore.showGithubStats) {
    siteConfigStore.fetchGithubStats(true)
  }
})

onMounted(() => {
  socialLinksStore.fetchProfile()
})
</script>

<template>
  <aside class="blog-sidebar">
    <div class="sidebar-widget sidebar-widget-compact">
      <div class="p-4 bg-gray-50/50 dark:bg-white/[0.02] rounded-xl flex flex-col items-center text-center">
        <div
          v-if="siteConfigStore.siteLogoUrl"
          class="w-16 h-16 rounded-full overflow-hidden bg-gray-100 dark:bg-dark-200 mb-3 ring-2 ring-primary/10"
        >
          <img
            :src="getLogoUrl(siteConfigStore.siteLogoUrl)"
            :alt="siteConfigStore.siteName"
            class="w-full h-full object-contain"
          >
        </div>
        <div
          v-else
          class="w-16 h-16 rounded-full bg-black flex items-center justify-center relative overflow-hidden mb-3"
        >
          <svg viewBox="0 0 100 100" class="w-10 h-10">
            <defs>
              <linearGradient id="sidebar-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
              </linearGradient>
            </defs>
            <text x="50" y="68" font-family="monospace" font-size="55" font-weight="bold" fill="url(#sidebar-logo-grad)" text-anchor="middle">F</text>
          </svg>
        </div>

        <h3 class="text-base font-bold text-gray-900 dark:text-white mb-2">
          {{ siteConfigStore.siteName }}
        </h3>

        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed max-w-[220px]">
          {{ siteConfigStore.siteDescription || 'Code for Future, Share for Growth.' }}
        </p>

        <div v-if="socialLinksStore.hasSocialLinks" class="flex gap-2 justify-center">
          <a
            v-for="link in socialLinksStore.socialLinks"
            :key="link.id"
            :href="link.url"
            :target="link.type === 'link' ? '_blank' : undefined"
            :rel="link.type === 'link' ? 'noopener noreferrer' : undefined"
            class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-dark-300 border border-gray-200 dark:border-white/5 flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary/30 transition-all relative"
            @mouseenter="showTooltip(link.id)"
            @mouseleave="hideTooltip"
          >
            <svg v-if="link.icon === 'github'" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <svg v-else-if="link.icon === 'email'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <svg v-else-if="link.icon === 'blog'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span v-if="activeTooltip === link.id" class="action-tooltip">{{ link.name }}</span>
          </a>
        </div>
      </div>
    </div>

    <div v-if="showGithubSection" class="sidebar-widget sidebar-widget-compact">
      <h3 class="sidebar-widget-title sidebar-widget-title-compact flex items-center gap-2">
        <svg class="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        GitHub
      </h3>
      <a :href="siteConfigStore.githubRepoUrl" target="_blank" rel="noopener noreferrer" class="block group">
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-white/[0.02] rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span class="text-xs text-gray-600 dark:text-gray-400">Stars</span>
            </div>
            <span class="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
              {{ formatCount(siteConfigStore.githubStats?.stars || 0) }}
            </span>
          </div>
          <div class="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-white/[0.02] rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span class="text-xs text-gray-600 dark:text-gray-400">Forks</span>
            </div>
            <span class="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
              {{ formatCount(siteConfigStore.githubStats?.forks || 0) }}
            </span>
          </div>
        </div>
      </a>
    </div>
  </aside>
</template>

<style scoped>
.action-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  background: #ffffff;
  color: #1a1a2e;
  font-size: 12px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 9999;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  animation: tooltip-fade-in 0.15s ease;
}

.dark .action-tooltip {
  background: #0f0f1a;
  color: #f1f5f9;
}

@keyframes tooltip-fade-in {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>