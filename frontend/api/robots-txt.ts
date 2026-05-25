export default async function handler(_req: any, res: any) {
  // 统一设置响应头为纯文本编码，防止浏览器或爬虫误判为 HTML
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  
  // 默认的最安全合法的兜底文本（全网允许抓取）
  const defaultRobots = 'User-agent: *\nAllow: /\n'

  try {
    const apiUrl = process.env.VITE_API_URL || ''
    const baseUrl = apiUrl.replace(/\/api\/v1\/?$/, '')

    if (!baseUrl) {
      res.setHeader('Cache-Control', 'public, max-age=3600') // 异常配置缩短缓存
      return res.status(200).send(defaultRobots)
    }

    // 设置请求超时，防止被后端接口挂死（3秒超时）
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(`${baseUrl}/robots.txt`, { signal: controller.signal })
    clearTimeout(id)

    if (!response.ok) {
      // 如果后端接口返回 404 或 500，不把错误抛给用户，直接降级返回合法兜底
      res.setHeader('Cache-Control', 'public, max-age=3600')
      return res.status(200).send(defaultRobots)
    }

    const content = await response.text()

    // 【核心防错】：检查后端返回的是不是一堆 HTML 标签（比如后端崩了吐出报错网页）
    if (content.trim().startsWith('<') || content.includes('<!DOCTYPE') || content.includes('<html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600')
      return res.status(200).send(defaultRobots)
    }

    // 走到这里说明内容合法
    res.setHeader('Cache-Control', 'public, max-age=86400') // 缓存 24 小时
    return res.status(200).send(content)

  } catch (error) {
    // ❌ 优化前：catch 块返回了 'Error fetching...'，爬虫不认识这行英文，会报错
    // 🚀 优化后：即使网络彻底断开，也顽强地返回 200 和合法规范文本，确保 SEO 绝对不扣分
    res.setHeader('Cache-Control', 'public, max-age=600') // 严重错误时只缓存 10 分钟
    return res.status(200).send(defaultRobots)
  }
}