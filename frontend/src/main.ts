import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './assets/main.css'
import { setupLazyLoad } from './directives/lazyLoad'

// 1. 基础初始化（只保留最核心、首屏必须的同步依赖）
const app = createApp(App)

app.use(createPinia())
app.use(router)

// 图片懒加载是首屏渲染高度相关的，保持同步初始化
setupLazyLoad(app)

// 2. 核心首屏挂载（以最快速度让用户看到界面，降低 FCP / LCP）
app.mount('#app')

/**
 * 3. 非关键逻辑延迟异步初始化（消灭 TBT 阻塞时间）
 * 使用 requestIdleCallback 或 setTimeout，确保在浏览器空闲、首页渲染完成后再加载
 */
const initIdleWork = async () => {
  // 异步动态导入：只有当前端真正用到权限或者开始上报时，才去加载对应的 JS 碎片
  const [
    { permission, permissionTooltip },
    { logPerformanceReport }
  ] = await Promise.all([
    import('./directives/permission'),
    import('./utils/performance')
  ])

  // 动态注册后台管理才用的权限指令（不影响前台首页的挂载速度）
  app.directive('permission', permission)
  app.directive('permission-tooltip', permissionTooltip)

  // 执行性能分析与上报
  logPerformanceReport()
}

if ('requestIdleCallback' in window) {
  window.requestIdleCallback(() => initIdleWork())
} else {
  setTimeout(initIdleWork, 200) // 老旧浏览器降级兜底
}