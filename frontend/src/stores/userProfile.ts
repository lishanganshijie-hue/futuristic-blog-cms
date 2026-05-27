import { defineStore } from 'pinia'
import { ref } from 'vue'
import { userProfileApi } from '@/api/userProfile'
import { isCancelError } from '@/utils/error'
import type { UserProfile } from '@/api/userProfile'

export const useUserProfileStore = defineStore('userProfile', () => {
  const profile = ref<UserProfile | null>(null)
  const loading = ref(false)
  const avatarUpdatedAt = ref<number>(Date.now())
  let fetchPromise: Promise<void> | null = null

  const fetchProfile = async () => {
    if (profile.value) return
    if (fetchPromise) return fetchPromise
    
    loading.value = true
    fetchPromise = (async () => {
      try {
        profile.value = await userProfileApi.getProfile()
      } catch (error: any) {
        if (isCancelError(error)) {
          fetchPromise = null
          return
        }
        
        // 🚀 核心改动：如果是 401 (未登录)，属于正常前台访客状态，静默退出，不打扰控制台
        if (error?.response?.status === 401) {
          return
        }
        
        // 真正的服务器崩溃或网络断开（比如 500/502/404）依然会老实报错
        console.error('Failed to fetch user profile:', error)
      } finally {
        loading.value = false
        fetchPromise = null
      }
    })()
    
    return fetchPromise
  }

  const refreshProfile = async () => {
    try {
      profile.value = await userProfileApi.getProfile()
      avatarUpdatedAt.value = Date.now()
    } catch (error: any) {
      if (isCancelError(error)) {
        return
      }
      
      // 🚀 核心改动：刷新时如果是 401，同样静默处理
      if (error?.response?.status === 401) {
        return
      }
      
      console.error('Failed to refresh user profile:', error)
    }
  }

  const clearProfile = () => {
    profile.value = null
    fetchPromise = null
  }

  const notifyAvatarUpdated = () => {
    avatarUpdatedAt.value = Date.now()
  }

  return {
    profile,
    loading,
    avatarUpdatedAt,
    fetchProfile,
    refreshProfile,
    clearProfile,
    notifyAvatarUpdated
  }
})