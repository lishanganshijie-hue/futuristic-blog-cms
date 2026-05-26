import apiClient, { clearCacheByPattern } from './client'
import type { Profile as OriginalProfile } from '@/types'

// 一劳永逸：在这里把 avatar_url、show_* 开关和 order_* 排序字段全部注入到 Profile 类型中
export type Profile = OriginalProfile & {
  avatar_url?: string;
  
  show_tech_stack?: boolean;
  show_journey?: boolean;
  show_education?: boolean;
  show_exploration?: boolean;

  order_basic?: number;
  order_banner?: number;
  order_tech_stack?: number;
  order_journey?: number;
  order_education?: number;
  order_exploration?: number;
  order_social?: number;
}

export const profileApi = {
  getProfile: async (): Promise<Profile> => {
    const response = await apiClient.get('/profile')
    return response.data
  },

  updateProfile: async (data: Partial<Profile>): Promise<Profile> => {
    const response = await apiClient.put('/profile', data)
    clearCacheByPattern('/profile')
    return response.data
  }
}