<script setup lang="ts">
import { useSiteConfigStore } from '@/stores'

const siteConfigStore = useSiteConfigStore()
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-gray-200/60 dark:border-white/5 bg-gray-50/50 dark:bg-dark-100/50">
    <div class="blog-container py-6">
      <div class="flex flex-col sm:flex-row justify-between items-center gap-2 text-center sm:text-left">
        <p class="text-xs text-gray-400">
          © {{ currentYear }} {{ siteConfigStore.siteName }}. All rights reserved.
        </p>
        <p class="text-xs text-gray-400">
          Built with <span class="text-primary">♥</span> using Vue 3 + FastAPI
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
/* 移除不需要的样式，保持干净清爽 */
</style>