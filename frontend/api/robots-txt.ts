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
      res.setHeader('Cache-Control', 'public, max-age=3600')
      return res.status(200).send(defaultRobots)
    }

    const rawContent = await response.text()
    const content = rawContent.trim()

    // 🚀 【核心防错升级】全方位拦截不规范的文本
    // 1. 拦截 HTML 格式
    if (content.startsWith('<') || content.toLowerCase().includes('<!doctype') || content.toLowerCase().includes('<html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600')
      return res.status(200).send(defaultRobots)
    }

    // 2. ⚡【精准狙击】拦截 JSON 格式（防止后端吐出 {"message": "..."} 导致爬虫报几十个错）
    if (content.startsWith('{') && content.endsWith('}')) {
      res.setHeader('Cache-Control', 'public, max-age=3600')
      return res.status(200).send(defaultRobots)
    }

    // 3. ⚡【严格白名单验证】真正合法的 robots.txt 必须包含 "user-agent:"
    // 如果连这个关键字都没有，说明后端吐出的绝对是奇奇怪怪的非合规文本，直接降级
    if (!content.toLowerCase().includes('user-agent:')) {
      res.setHeader('Cache-Control', 'public, max-age=3600')
      return res.status(200).send(defaultRobots)
    }

    // 走到这里说明内容完美合法
    res.setHeader('Cache-Control', 'public, max-age=86400') // 缓存 24 小时
    return res.status(200).send(rawContent)

  } catch (error) {
    res.setHeader('Cache-Control', 'public, max-age=600') // 严重错误时只缓存 10 分钟
    return res.status(200).send(defaultRobots)
  }
}