<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBlogStore } from '@/stores'

const router = useRouter()
const blogStore = useBlogStore()

const isOpen = ref(false)
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)

// 针对防抖加一个本地定时器引用
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// 安全转义文本，防止 XSS，并做高亮处理
const highlightText = (text: string, keyword: string): string => {
  if (!keyword || !text) {
    // 即使不匹配，也用原生 div 转义，保障基础安全
    const div = document.createElement('div')
    div.innerText = text
    return div.innerHTML
  }
  
  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  
  // 先把原始文本里的 HTML 标签转义成安全文本，防止 v-html 借刀杀人
  const div = document.createElement('div')
  div.innerText = text
  const safeText = div.innerHTML

  const pattern = escapeRegExp(keyword)
  const regex = new RegExp(`(${pattern})`, 'gi')
  
  return safeText.replace(regex, '<mark class="search-highlight">$1</mark>')
}

const filteredResults = computed(() => {
  if (!searchQuery.value) return []
  const query = searchQuery.value.toLowerCase()
  return blogStore.articles.filter(article => 
    article.title.toLowerCase().includes(query) ||
    article.summary?.toLowerCase().includes(query)
  ).slice(0, 5)
})

const openSearch = () => {
  isOpen.value = true
  setTimeout(() => {
    const input = document.querySelector('[data-search-input]') as HTMLInputElement
    if (input) input.focus()
  }, 100)
}

const closeSearch = () => {
  isOpen.value = false
  searchQuery.value = ''
  if (debounceTimer) clearTimeout(debounceTimer) // 关闭时清空未发出的请求
}

const handleKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    openSearch()
  }
  if (e.key === 'Escape' && isOpen.value) {
    closeSearch()
  }
}

const handleEnter = () => {
  if (searchQuery.value.trim()) {
    const keyword = searchQuery.value.trim()
    closeSearch()
    router.push({ path: '/search', query: { q: keyword } })
  }
}

const goToArticle = (slug: string) => {
  const keyword = searchQuery.value.trim()
  closeSearch()
  if (keyword) {
    router.push({ path: `/article/${slug}`, query: { highlight: keyword } })
  } else {
    router.push(`/article/${slug}`)
  }
}

// 🚀 核心改动：加入了 300ms 的防抖过滤层
const performSearch = () => {
  const query = searchQuery.value.trim()
  if (!query) return

  // 如果用户在 300 毫秒内再次敲击键盘，直接掐断上一次的计划，重新计时
  if (debounceTimer) clearTimeout(debounceTimer)

  debounceTimer = setTimeout(async () => {
    isSearching.value = true
    try {
      await blogStore.fetchArticles({ 
        search: query,
        page: 1,
        page_size: 8
      })
      searchResults.value = blogStore.articles
    } catch (error) {
      console.error('搜索请求失败:', error)
    } finally {
      isSearching.value = false
    }
  }, 300) // ⏳ 300ms 是兼顾用户打字流畅感与后端抗压的最完美阈值
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('open-search', openSearch)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('open-search', openSearch)
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <teleport to="body">
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      >
        <div
          class="absolute inset-0 bg-dark/80 backdrop-blur-sm"
          @click="closeSearch"
        />
        
        <div class="relative w-full max-w-2xl glass-card p-4 shadow-2xl">
          <form class="flex items-center gap-4 mb-4" @submit.prevent="handleEnter">
            <svg
              class="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input id="input-global-search"
              v-model="searchQuery"
              data-search-input
              type="text"
              placeholder="搜索文章、标签、分类...（按回车查看全部结果）"
              class="flex-1 bg-transparent text-white text-lg outline-none placeholder-gray-500"
              @input="performSearch"
              @keyup.enter="handleEnter"
            >
            <kbd class="px-2 py-1 bg-dark-200 rounded text-xs text-gray-400">ESC</kbd>
          </form>

          <div
            v-if="searchQuery && filteredResults.length > 0"
            class="border-t border-white/10 pt-4"
          >
            <div class="text-sm text-gray-400 mb-2">
              搜索结果
            </div>
            <div class="space-y-2">
              <button
                v-for="article in filteredResults"
                :key="article.id"
                class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left"
                @click="goToArticle(article.slug)"
              >
                <div class="w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                  <svg
                    class="w-5 h-5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div
                    class="text-white font-medium truncate"
                    v-html="highlightText(article.title, searchQuery)"
                  />
                  <div
                    class="text-sm text-gray-400 truncate"
                    v-html="highlightText(article.summary || '', searchQuery)"
                  />
                </div>
                <svg
                  class="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
            <button
              class="w-full mt-3 py-2 text-center text-primary hover:text-primary/80 transition-colors text-sm font-medium"
              @click="handleEnter"
            >
              查看全部 {{ blogStore.pagination.total }} 个结果 →
            </button>
          </div>

          <div
            v-else-if="searchQuery && !isSearching"
            class="border-t border-white/10 pt-4 text-center text-gray-400"
          >
            未找到相关结果
          </div>

          <div
            v-if="isSearching"
            class="border-t border-white/10 pt-4 text-center text-gray-400"
          >
            <svg
              class="animate-spin w-5 h-5 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>

          <div
            v-if="!searchQuery"
            class="border-t border-white/10 pt-4"
          >
            <div class="text-sm text-gray-400 mb-3">
              热门标签
            </div>
            <div class="flex flex-wrap gap-2">
              <router-link
                v-for="tag in blogStore.tags.slice(0, 8)"
                :key="tag.id"
                :to="`/tags/${tag.slug}`"
                class="tag"
                @click="closeSearch"
              >
                {{ tag.name }}
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
