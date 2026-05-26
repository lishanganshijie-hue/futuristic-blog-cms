<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { profileApi } from '@/api'
import type { Profile, TechStackItem, JourneyItem, Education } from '@/types'
import { useDialogStore } from '@/stores'
import { useAdminCheck } from '@/composables/useAdminCheck'

const dialog = useDialogStore()
const { requirePermission, hasPermission } = useAdminCheck()
const canEdit = computed(() => hasPermission('profile.edit'))
const profile = ref<Profile | null>(null)
const isLoading = ref(false)
const isSubmitting = ref(false)
const activeTab = ref('basic')

const tabs = [
  { key: 'basic', label: '基本信息' },
  { key: 'tech', label: '技术栈' },
  { key: 'journey', label: '职业经历' },
  { key: 'education', label: '教育背景' },
  { key: 'exploration', label: '探索方向' },
  { key: 'social', label: '社交链接' },
  { key: 'display', label: '模块显示与排序' } // 新增：全局排序与开关管理面板
]

// 扩展响应式表单，注入展示开关与模块级排序字段
const form = ref({
  name: '',
  alias: '',
  slogan: '',
  tags: [] as string[],
  avatar: '',
  bio: '',
  tech_stack: [] as (TechStackItem & { sort_order?: number })[],
  journey: [] as (JourneyItem & { sort_order?: number })[],
  education: undefined as (Education & { sort_order?: number }) | undefined,
  exploration_areas: [] as string[],
  social_github: '',
  social_blog: '',
  social_email: '',
  
  // 新增：模块级别显示开关
  show_journey: true,
  show_education: true,
  show_tech_stack: true,
  show_exploration: true,

  // 新增：全局模块排序字段 (数字越小越靠前)
  order_basic: 0,
  order_banner: 1,
  order_tech_stack: 2,
  order_journey: 3,
  order_education: 4,
  order_exploration: 5,
  order_social: 6
})

const newTag = ref('')
const newExplorationArea = ref('')
const newTechCategory = ref('')
const newTechItems = ref('')

const fetchProfile = async () => {
  isLoading.value = true
  try {
    profile.value = await profileApi.getProfile()
    form.value = {
      name: profile.value.name,
      alias: profile.value.alias || '',
      slogan: profile.value.slogan || '',
      tags: profile.value.tags || [],
      avatar: profile.value.avatar || '',
      bio: profile.value.bio || '',
      // 初始化内部条目的可选排序
      tech_stack: (profile.value.tech_stack || []).map(item => ({ sort_order: 0, ...item })),
      journey: (profile.value.journey || []).map(item => ({ sort_order: 0, ...item })),
      education: profile.value.education ? { sort_order: 0, ...profile.value.education } : undefined,
      exploration_areas: profile.value.exploration_areas || [],
      social_github: profile.value.social_github || '',
      social_blog: profile.value.social_blog || '',
      social_email: profile.value.social_email || '',
      
      // 后端如有对应字段则映射，若无则使用默认值值
      show_journey: profile.value.show_journey !== false,
      show_education: profile.value.show_education !== false,
      show_tech_stack: profile.value.show_tech_stack !== false,
      show_exploration: profile.value.show_exploration !== false,

      order_basic: profile.value.order_basic ?? 0,
      order_banner: profile.value.order_banner ?? 1,
      order_tech_stack: profile.value.order_tech_stack ?? 2,
      order_journey: profile.value.order_journey ?? 3,
      order_education: profile.value.order_education ?? 4,
      order_exploration: profile.value.order_exploration ?? 5,
      order_social: profile.value.order_social ?? 6
    }
  } catch (error) {
    console.error('Failed to fetch profile:', error)
  } finally {
    isLoading.value = false
  }
}

const handleSave = async () => {
  if (!await requirePermission('profile.edit', '保存网站资料')) return
  
  isSubmitting.value = true
  try {
    // 1. 提交前自动根据用户的数字排序对内部数组进行一次升序预整理
    form.value.tech_stack.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    form.value.journey.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

    // ==========================================
    // 🚀 【核心修复】强制将包裹了新字段的全新 form 数据直接塞给 API
    // ==========================================
    // 如果原先的 profileApi.updateProfile 内部挑拣字段导致丢失新字段，
    // 我们在这里直接把最新的 form.value 作为唯一入参硬塞过去。
    await profileApi.updateProfile({
      ...form.value,
      // 强行双重保险确保布尔值和数字原样发送，不被任何地方拦截
      show_journey: form.value.show_journey,
      show_education: form.value.show_education,
      show_tech_stack: form.value.show_tech_stack,
      show_exploration: form.value.show_exploration,
      order_basic: Number(form.value.order_basic),
      order_banner: Number(form.value.order_banner),
      order_tech_stack: Number(form.value.order_tech_stack),
      order_journey: Number(form.value.order_journey),
      order_education: Number(form.value.order_education),
      order_exploration: Number(form.value.order_exploration),
      order_social: Number(form.value.order_social),
    })

    await fetchProfile()
    await dialog.showSuccess('保存成功', '成功')
  } catch (error: any) {
    await dialog.showError(error.response?.data?.detail || '保存失败', '错误')
  } finally {
    isSubmitting.value = false
  }
}

const warnReadonly = (action: string) => {
  dialog.showWarning(`无${action}权限，请联系管理员`, '权限不足')
}

const addTag = async () => {
  if (!await requirePermission('profile.edit', '添加网站资料标签')) return
  if (newTag.value.trim()) {
    form.value.tags.push(newTag.value.trim())
    newTag.value = ''
  }
}

const removeTag = async (index: number) => {
  if (!await requirePermission('profile.edit', '删除网站资料标签')) return
  const confirmed = await dialog.showConfirm({
    title: '删除标签',
    message: `确定要删除标签「${form.value.tags[index]}」吗？删除后无法恢复。`,
    confirmText: '删除',
    cancelText: '取消'
  })
  if (!confirmed) return
  form.value.tags.splice(index, 1)
}

const addExplorationArea = async () => {
  if (!await requirePermission('profile.edit', '添加网站资料探索方向')) return
  if (newExplorationArea.value.trim()) {
    form.value.exploration_areas.push(newExplorationArea.value.trim())
    newExplorationArea.value = ''
  }
}

const removeExplorationArea = async (index: number) => {
  if (!await requirePermission('profile.edit', '删除网站资料探索方向')) return
  const confirmed = await dialog.showConfirm({
    title: '删除探索方向',
    message: `确定要删除探索方向「${form.value.exploration_areas[index]}」吗？删除后无法恢复。`,
    confirmText: '删除',
    cancelText: '取消'
  })
  if (!confirmed) return
  form.value.exploration_areas.splice(index, 1)
}

const addTechCategory = async () => {
  if (!await requirePermission('profile.edit', '添加网站资料技术分类')) return
  if (newTechCategory.value.trim() && newTechItems.value.trim()) {
    form.value.tech_stack.push({
      category: newTechCategory.value.trim(),
      items: newTechItems.value.split(',').map(s => s.trim()).filter(s => s),
      sort_order: 0
    })
    newTechCategory.value = ''
    newTechItems.value = ''
  }
}

const removeTechCategory = async (index: number) => {
  if (!await requirePermission('profile.edit', '删除网站资料技术分类')) return
  const confirmed = await dialog.showConfirm({
    title: '删除技术分类',
    message: `确定要删除技术分类「${form.value.tech_stack[index].category}」吗？删除后无法恢复。`,
    confirmText: '删除',
    cancelText: '取消'
  })
  if (!confirmed) return
  form.value.tech_stack.splice(index, 1)
}

const addJourney = async () => {
  if (!await requirePermission('profile.edit', '添加网站资料职业经历')) return
  form.value.journey.push({
    period: '',
    company: '',
    position: '',
    achievements: '',
    sort_order: 0
  })
}

const removeJourney = async (index: number) => {
  if (!await requirePermission('profile.edit', '删除网站资料职业经历')) return
  const item = form.value.journey[index]
  const label = item.company || item.period || `经历 ${index + 1}`
  const confirmed = await dialog.showConfirm({
    title: '删除职业经历',
    message: `确定要删除「${label}」吗？删除后无法恢复。`,
    confirmText: '删除',
    cancelText: '取消'
  })
  if (!confirmed) return
  form.value.journey.splice(index, 1)
}

const initEducation = async () => {
  if (!await requirePermission('profile.edit', '添加网站资料教育背景')) return
  if (!form.value.education) {
    form.value.education = {
      period: '',
      school: '',
      major: '',
      degree: '',
      sort_order: 0
    }
  }
}

onMounted(() => {
  fetchProfile()
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-5 gap-2">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
          <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 class="text-base sm:text-xl font-bold text-gray-900 dark:text-white">网站资料</h1>
      </div>
      <button
        :class="['text-xs sm:text-sm px-3 sm:px-4 py-1.5 whitespace-nowrap rounded-lg transition-colors', canEdit && !isSubmitting ? 'bg-primary text-white hover:bg-primary/90' : 'bg-primary/50 text-white/70 cursor-not-allowed']"
        :disabled="isSubmitting"
        @click="canEdit ? handleSave() : warnReadonly('保存网站资料')"
      >
        <span v-if="isSubmitting" class="flex items-center gap-2">
          <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          保存中...
        </span>
        <span v-else>保存更改</span>
      </button>
    </div>

    <div v-if="isLoading" class="flex justify-center py-16">
      <div class="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>

    <div v-else class="glass-card overflow-hidden">
      <div class="flex flex-wrap border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-dark-200/50">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="[
            'px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap',
            activeTab === tab.key
              ? 'text-primary border-b-2 border-primary bg-white dark:bg-dark-300'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          ]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="p-6">
        <form v-if="activeTab === 'basic'" class="space-y-4" @submit.prevent="handleSave">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="profile-name" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">姓名</label>
              <input id="profile-name" v-model="form.name" type="text" :disabled="!canEdit" class="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none disabled:opacity-50" />
            </div>
            <div>
              <label for="profile-alias" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">别名</label>
              <input id="profile-alias" v-model="form.alias" type="text" :disabled="!canEdit" class="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none disabled:opacity-50" />
            </div>
          </div>
          <div>
            <label for="profile-slogan" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">标语</label>
            <input id="profile-slogan" v-model="form.slogan" type="text" :disabled="!canEdit" class="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none disabled:opacity-50" />
          </div>
          <div>
            <label for="profile-avatar" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">自定义 Banner 图 URL（原头像位）</label>
            <input id="profile-avatar" v-model="form.avatar" type="text" :disabled="!canEdit" class="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none disabled:opacity-50" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">个人核心小标签</label>
            <div class="flex flex-wrap gap-2 mb-2">
              <span v-for="(tag, index) in form.tags" :key="index" class="px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full flex items-center gap-1">
                {{ tag }}
                <button type="button" :class="['hover:text-red-400 font-bold ml-0.5', !canEdit && 'opacity-50']" @click="canEdit ? removeTag(index) : warnReadonly('删除标签')">×</button>
              </span>
            </div>
            <div class="flex gap-2">
              <input id="profile-new-tag" v-model="newTag" type="text" :disabled="!canEdit" class="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none" placeholder="回车或点击按钮添加" @keyup.enter="addTag" />
              <button type="button" :class="['px-4 py-2 text-white text-sm rounded-lg', canEdit ? 'bg-primary' : 'bg-primary/50']" @click="canEdit ? addTag() : warnReadonly('添加标签')">添加</button>
            </div>
          </div>
          <div>
            <label for="profile-bio" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">个人简介</label>
            <textarea id="profile-bio" v-model="form.bio" rows="4" :disabled="!canEdit" class="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none resize-none disabled:opacity-50" />
          </div>
        </form>

        <form v-if="activeTab === 'tech'" class="space-y-4" @submit.prevent="handleSave">
          <div v-for="(tech, index) in form.tech_stack" :key="index" class="p-4 bg-gray-50 dark:bg-dark-100 rounded-xl border border-gray-100 dark:border-white/5 space-y-3">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-2 flex-1">
                <input v-model="tech.category" type="text" :disabled="!canEdit" class="px-3 py-1.5 text-sm bg-white dark:bg-dark-200 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none" placeholder="分类名称" />
                <div class="flex items-center gap-1.5 pl-2">
                  <span class="text-xs text-gray-400 whitespace-nowrap">排序：</span>
                  <input v-model.number="tech.sort_order" type="number" :disabled="!canEdit" class="w-16 px-2 py-1 text-center text-xs bg-white dark:bg-dark-200 border border-gray-200 dark:border-white/10 rounded focus:border-primary focus:outline-none" />
                </div>
              </div>
              <button type="button" class="text-red-400 hover:text-red-500 text-sm font-medium" @click="canEdit ? removeTechCategory(index) : warnReadonly('删除技术分类')">删除</button>
            </div>
            <input v-model="tech.items" type="text" :disabled="!canEdit" class="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-200 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none" placeholder="技术子项（英文逗号分隔）" />
          </div>
          <div class="p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/30">
            <div class="grid grid-cols-2 gap-3 mb-3">
              <input v-model="newTechCategory" type="text" :disabled="!canEdit" class="px-3 py-2 text-sm bg-white dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none" placeholder="新分类：如 前端开发" />
              <input v-model="newTechItems" type="text" :disabled="!canEdit" class="px-3 py-2 text-sm bg-white dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none" placeholder="技术项：Vue3, TS, Tailwind" />
            </div>
            <button type="button" :class="['w-full py-2.5 text-sm text-primary border border-primary/30 rounded-lg font-medium transition-colors', canEdit ? 'hover:bg-primary/10 bg-white dark:bg-dark-100' : 'opacity-50']" @click="canEdit ? addTechCategory() : warnReadonly('添加技术分类')">+ 添加新技术分类</button>
          </div>
        </form>

        <form v-if="activeTab === 'journey'" class="space-y-4" @submit.prevent="handleSave">
          <div v-for="(item, index) in form.journey" :key="index" class="p-4 bg-gray-50 dark:bg-dark-100 rounded-xl border border-gray-100 dark:border-white/5 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">历程明细 #{{ index + 1 }}</span>
                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-gray-400">内部排序值：</span>
                  <input v-model.number="item.sort_order" type="number" :disabled="!canEdit" class="w-16 px-2 py-0.5 text-center text-xs bg-white dark:bg-dark-200 border border-gray-200 dark:border-white/10 rounded" />
                </div>
              </div>
              <button type="button" class="text-red-400 hover:text-red-500 text-sm font-medium" @click="canEdit ? removeJourney(index) : warnReadonly('删除职业经历')">删除</button>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <input v-model="item.period" type="text" :disabled="!canEdit" class="px-3 py-1.5 text-sm bg-white dark:bg-dark-200 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary" placeholder="时间段（如：2023 - 至今）" />
              <input v-model="item.company" type="text" :disabled="!canEdit" class="px-3 py-1.5 text-sm bg-white dark:bg-dark-200 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary" placeholder="公司/组织团队" />
            </div>
            <input v-model="item.position" type="text" :disabled="!canEdit" class="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-200 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary" placeholder="核心岗/角色" />
            <textarea v-model="item.achievements" rows="2" :disabled="!canEdit" class="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-200 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary resize-none" placeholder="项目或业务核心输出成果描述..." />
          </div>
          <button type="button" :class="['w-full py-2.5 text-sm text-primary border border-primary/30 rounded-lg font-medium bg-gray-50/50 transition-colors', canEdit ? 'hover:bg-primary/10' : 'opacity-50']" @click="canEdit ? addJourney() : warnReadonly('添加职业经历')">+ 增添一条职业历程</button>
        </form>

        <form v-if="activeTab === 'education'" class="space-y-4" @submit.prevent="handleSave">
          <div v-if="form.education" class="p-4 bg-gray-50 dark:bg-dark-100 rounded-xl border border-gray-100 dark:border-white/5 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="edu-period" class="block text-xs font-medium text-gray-500 mb-1.5">在校时间跨度</label>
                <input id="edu-period" v-model="form.education.period" type="text" :disabled="!canEdit" class="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-200 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary" />
              </div>
              <div>
                <label for="edu-school" class="block text-xs font-medium text-gray-500 mb-1.5">毕业/就读院校</label>
                <input id="edu-school" v-model="form.education.school" type="text" :disabled="!canEdit" class="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-200 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="edu-major" class="block text-xs font-medium text-gray-500 mb-1.5">主修专业</label>
                <input id="edu-major" v-model="form.education.major" type="text" :disabled="!canEdit" class="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-200 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary" />
              </div>
              <div>
                <label for="edu-degree" class="block text-xs font-medium text-gray-500 mb-1.5">获得学历/学位</label>
                <input id="edu-degree" v-model="form.education.degree" type="text" :disabled="!canEdit" class="w-full px-3 py-1.5 text-sm bg-white dark:bg-dark-200 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary" />
              </div>
            </div>
          </div>
          <button v-else type="button" :class="['w-full py-2.5 text-sm text-primary border border-primary/30 rounded-lg font-medium bg-gray-50/50', canEdit ? 'hover:bg-primary/10' : 'opacity-50']" @click="canEdit ? initEducation() : warnReadonly('添加教育背景')">+ 初始化建立教育背景数据</button>
        </form>

        <form v-if="activeTab === 'exploration'" class="space-y-4" @submit.prevent="handleSave">
          <div class="flex flex-wrap gap-2">
            <span v-for="(area, index) in form.exploration_areas" :key="index" class="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full flex items-center gap-2 font-medium">
              {{ area }}
              <button type="button" :class="['hover:text-red-400 font-bold', !canEdit && 'opacity-50']" @click="canEdit ? removeExplorationArea(index) : warnReadonly('删除探索方向')">×</button>
            </span>
          </div>
          <div class="flex gap-2">
            <input id="profile-new-exploration" v-model="newExplorationArea" type="text" :disabled="!canEdit" class="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary" placeholder="输入新的研发或关注方向" @keyup.enter="addExplorationArea" />
            <button type="button" :class="['px-4 py-2 text-white text-sm rounded-lg', canEdit ? 'bg-primary' : 'bg-primary/50']" @click="canEdit ? addExplorationArea() : warnReadonly('添加探索方向')">追加</button>
          </div>
        </form>

        <form v-if="activeTab === 'social'" class="space-y-4" @submit.prevent="handleSave">
          <div>
            <label for="profile-github" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">GitHub 个人主页</label>
            <input id="profile-github" v-model="form.social_github" type="text" :disabled="!canEdit" class="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary" placeholder="https://github.com/username" />
          </div>
          <div>
            <label for="profile-blog" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">独立博客/三方站点</label>
            <input id="profile-blog" v-model="form.social_blog" type="text" :disabled="!canEdit" class="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary" placeholder="https://your-blog.com" />
          </div>
          <div>
            <label for="profile-email" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">公开联系邮箱</label>
            <input id="profile-email" v-model="form.social_email" type="email" :disabled="!canEdit" class="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary" placeholder="your@email.com" />
          </div>
        </form>

        <form v-if="activeTab === 'display'" class="space-y-6" @submit.prevent="handleSave">
          <div class="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 rounded-xl">
            <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">💡 模块层级调配指南</h3>
            <p class="text-xs text-blue-700/80 dark:text-blue-400/80 leading-relaxed">
              1. <b>可见控制：</b> 关闭开关后，前台用户将无法看到该对应模块数据。<br/>
              2. <b>全动态流排序：</b> 各模块次序通过数字权重调配，权重数值越小（如：0、1），在前台布局中越靠上方渲染展示。
            </p>
          </div>

          <div class="divide-y divide-gray-100 dark:divide-white/5 border border-gray-200/60 dark:border-white/10 rounded-xl bg-white dark:bg-dark-200 overflow-hidden">
            
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 bg-gray-50/40 dark:bg-dark-100/20">
              <div>
                <h4 class="text-sm font-bold text-gray-900 dark:text-white">基本信息名片 (个人简介)</h4>
                <p class="text-xs text-gray-400 mt-0.5">基础骨架项，默认常驻前台公开显示</p>
              </div>
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">排序权重</span>
                  <input v-model.number="form.order_basic" type="number" :disabled="!canEdit" class="w-20 px-2 py-1 text-center text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none" />
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div>
                <h4 class="text-sm font-bold text-gray-900 dark:text-white">自定义展示图 / Banner 框</h4>
                <p class="text-xs text-gray-400 mt-0.5">置顶的大宽幅独立自定义展示区</p>
              </div>
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">排序权重</span>
                  <input v-model.number="form.order_banner" type="number" :disabled="!canEdit" class="w-20 px-2 py-1 text-center text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none" />
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <h4 class="text-sm font-bold text-gray-900 dark:text-white">技术栈图谱</h4>
                  <label class="relative inline-flex items-center cursor-pointer ml-1">
                    <input type="checkbox" v-model="form.show_tech_stack" :disabled="!canEdit" class="sr-only peer">
                    <div class="w-8 h-4 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <p class="text-xs text-gray-400 mt-0.5">当前前台：<span :class="form.show_tech_stack ? 'text-green-500 font-medium' : 'text-red-400'">{{ form.show_tech_stack ? '展示中' : '已隐藏' }}</span></p>
              </div>
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">排序权重</span>
                  <input v-model.number="form.order_tech_stack" type="number" :disabled="!canEdit" class="w-20 px-2 py-1 text-center text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none" />
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <h4 class="text-sm font-bold text-gray-900 dark:text-white">职业经历（专业旅程）</h4>
                  <label class="relative inline-flex items-center cursor-pointer ml-1">
                    <input type="checkbox" v-model="form.show_journey" :disabled="!canEdit" class="sr-only peer">
                    <div class="w-8 h-4 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <p class="text-xs text-gray-400 mt-0.5">当前前台：<span :class="form.show_journey ? 'text-green-500 font-medium' : 'text-red-400'">{{ form.show_journey ? '展示中' : '已隐藏' }}</span></p>
              </div>
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">排序权重</span>
                  <input v-model.number="form.order_journey" type="number" :disabled="!canEdit" class="w-20 px-2 py-1 text-center text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none" />
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <h4 class="text-sm font-bold text-gray-900 dark:text-white">教育背景</h4>
                  <label class="relative inline-flex items-center cursor-pointer ml-1">
                    <input type="checkbox" v-model="form.show_education" :disabled="!canEdit" class="sr-only peer">
                    <div class="w-8 h-4 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <p class="text-xs text-gray-400 mt-0.5">当前前台：<span :class="form.show_education ? 'text-green-500 font-medium' : 'text-red-400'">{{ form.show_education ? '展示中' : '已隐藏' }}</span></p>
              </div>
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">排序权重</span>
                  <input v-model.number="form.order_education" type="number" :disabled="!canEdit" class="w-20 px-2 py-1 text-center text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none" />
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <h4 class="text-sm font-bold text-gray-900 dark:text-white">技术探索方向</h4>
                  <label class="relative inline-flex items-center cursor-pointer ml-1">
                    <input type="checkbox" v-model="form.show_exploration" :disabled="!canEdit" class="sr-only peer">
                    <div class="w-8 h-4 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <p class="text-xs text-gray-400 mt-0.5">当前前台：<span :class="form.show_exploration ? 'text-green-500 font-medium' : 'text-red-400'">{{ form.show_exploration ? '展示中' : '已隐藏' }}</span></p>
              </div>
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">排序权重</span>
                  <input v-model.number="form.order_exploration" type="number" :disabled="!canEdit" class="w-20 px-2 py-1 text-center text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none" />
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div>
                <h4 class="text-sm font-bold text-gray-900 dark:text-white">社交矩阵链接区</h4>
                <p class="text-xs text-gray-400 mt-0.5">展示各路三方社交账号图标块</p>
              </div>
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500">排序权重</span>
                  <input v-model.number="form.order_social" type="number" :disabled="!canEdit" class="w-20 px-2 py-1 text-center text-sm bg-gray-100 dark:bg-dark-100 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:border-primary focus:outline-none" />
                </div>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  </div>
</template>