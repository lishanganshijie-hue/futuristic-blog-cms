import axios, { AxiosError } from 'axios'
import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { cacheManager } from './cacheManager'

const getBaseURL = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL
  if (apiUrl) {
    return apiUrl.replace(/\/$/, '')
  }
  return '/api/v1'
}

const config: AxiosRequestConfig = {
  baseURL: getBaseURL(),
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json'
  }
}

const apiClient: AxiosInstance = axios.create(config)

let isRefreshing = false
let refreshSubscribers: ((token: string) => void)[] = []

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb)
}

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(cb => cb(token))
  refreshSubscribers = []
}

const pendingRequests = new Map<string, { controller: AbortController; timestamp: number }>()

const generateRequestKey = (config: InternalAxiosRequestConfig): string => {
  const { method, url, params } = config
  return [method, url, JSON.stringify(params)].join('&')
}

const PENDING_REQUEST_TTL = 500

const removePendingRequest = (config: InternalAxiosRequestConfig) => {
  const key = generateRequestKey(config)
  const pending = pendingRequests.get(key)
  if (pending) {
    if (Date.now() - pending.timestamp > PENDING_REQUEST_TTL) {
      pendingRequests.delete(key)
    }
  }
}

const addPendingRequest = (config: InternalAxiosRequestConfig) => {
  const key = generateRequestKey(config)
  const pending = pendingRequests.get(key)
  
  if (pending && Date.now() - pending.timestamp < PENDING_REQUEST_TTL) {
    if (config.headers['X-Allow-Duplicate'] !== 'true') {
      pending.controller.abort()
      pendingRequests.delete(key)
    }
  } else if (pending) {
    pendingRequests.delete(key)
  }
  
  const controller = new AbortController()
  config.signal = controller.signal
  pendingRequests.set(key, { controller, timestamp: Date.now() })
}

// 采用安全的纯字符串过滤，规避打包编译隐形字符坑
const nonCacheableStrings = [
  '/auth/',
  '/comments/',
  '/likes/',
  '/logs/',
  '/notifications/',
  '/upload',
  '/delete',
  '/create',
  '/update'
]

const isNonCacheable = (url: string | undefined): boolean => {
  if (!url) return true
  return nonCacheableStrings.some(pattern => url.includes(pattern))
}

const refreshToken = async (): Promise<string | null> => {
  const storedRefreshToken = localStorage.getItem('refresh_token')
  if (!storedRefreshToken) return null
  
  try {
    const response = await axios.post('/api/v1/auth/refresh', {
      refresh_token: storedRefreshToken
    })
    
    const { access_token, refresh_token: newRefreshToken, expires_in } = response.data
    
    localStorage.setItem('token', access_token)
    if (newRefreshToken) {
      localStorage.setItem('refresh_token', newRefreshToken)
    }
    if (expires_in) {
      const expiry = Date.now() + expires_in * 1000
      localStorage.setItem('token_expiry', expiry.toString())
    }
    
    return access_token
  } catch (error) {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('token_expiry')
    return null
  }
}

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    if (config.method?.toLowerCase() === 'get' && cacheManager.shouldCache(config.url) && !isNonCacheable(config.url)) {
      const cacheKey = cacheManager.getCacheKey(config.method!, config.url!, config.params)
      const cached = cacheManager.get(cacheKey)
      
      if (cached) {
        config.adapter = () => Promise.resolve({
          data: cached,
          status: 200,
          statusText: 'OK (from cache)',
          headers: {},
          config
        } as AxiosResponse)
        return config
      }
    }
    
    if (config.method?.toLowerCase() === 'get') {
      removePendingRequest(config)
      addPendingRequest(config)
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

apiClient.interceptors.response.use(
  (response) => {
    if (response.config) {
      removePendingRequest(response.config)
    }
    
    if (response.config.method?.toLowerCase() === 'get' && cacheManager.shouldCache(response.config.url) && !isNonCacheable(response.config.url)) {
      const cacheKey = cacheManager.getCacheKey(response.config.method!, response.config.url!, response.config.params)
      cacheManager.set(cacheKey, response.data)
    }
    
    return response
  },
  async (error: AxiosError) => {
    const originalConfig = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    if (error.config) {
      removePendingRequest(error.config)
    }
    
    if (axios.isCancel(error)) {
      const cancelError = new Error('请求已取消')
      ;(cancelError as unknown as Record<string, unknown>).isCancel = true
      return Promise.reject(cancelError)
    }
    
    if (error.response?.status === 401 && originalConfig && !originalConfig._retry) {
      
      // 温和的响应策略：不搞自动刷新，不搞循环重试
      const handleAuthFailureAndRedirect = () => {
        const currentPath = window.location.pathname
        
        // 🔒 只有当你处于后台管理系统页面或者个人中心时，Token失效才需要去登录页
        if (currentPath.startsWith('/admin') || currentPath === '/profile') {
          localStorage.removeItem('token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('token_expiry')
          cacheManager.clear()
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
        } else {
          // 🌸 如果在前台看博客，Token 失效就让它失效，安安静静的，绝对不干扰用户浏览
          console.warn('Guest mode active due to inactive session.')
        }
      }

      if (originalConfig.url === '/auth/refresh') {
        handleAuthFailureAndRedirect()
        return Promise.reject(error)
      }
      
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalConfig.headers.Authorization = `Bearer ${token}`
            resolve(apiClient(originalConfig))
          })
        })
      }
      
      originalConfig._retry = true
      isRefreshing = true
      
      try {
        const newToken = await refreshToken()
        
        if (newToken) {
          onTokenRefreshed(newToken)
          originalConfig.headers.Authorization = `Bearer ${newToken}`
          return apiClient(originalConfig)
        } else {
          handleAuthFailureAndRedirect()
          return Promise.reject(error)
        }
      } catch (refreshError) {
        handleAuthFailureAndRedirect()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    
    return Promise.reject(error)
  }
)

export const clearCache = () => {
  cacheManager.clear()
}

export const clearCacheByPattern = (pattern: string) => {
  cacheManager.clearByPattern(pattern)
}

export const clearCacheByEndpoint = (endpoint: string) => {
  cacheManager.clearByEndpoint(endpoint)
}

export const clearCacheByRegex = (regex: RegExp) => {
  cacheManager.clearByRegex(regex)
}

export const cancelAllRequests = () => {
  pendingRequests.forEach(({ controller }) => controller.abort())
  pendingRequests.clear()
}

export const getCacheStats = () => {
  return cacheManager.getStats()
}

export const checkServerHealth = async (maxRetries = 2): Promise<boolean> => {
  const baseURL = getBaseURL()
  const healthUrl = baseURL.startsWith('http') 
    ? baseURL.replace('/api/v1', '/health/full')
    : '/health/full'
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(healthUrl, { timeout: 5000 })
      if (response.data?.status === 'healthy' && response.data?.database === 'connected') {
        return true
      }
      if (response.data?.status === 'degraded') {
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }
      }
    } catch (error) {
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
  return false
}

export default apiClient