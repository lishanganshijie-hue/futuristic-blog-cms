import { createLogger } from '@/utils/logger'

const logger = createLogger('CacheManager')

interface CacheEntry {
  data: unknown
  timestamp: number
  ttl: number
  size: number
}

interface CacheStrategy {
  ttl: number
  maxSize: number
  priority: number
  pattern: RegExp
}

interface CacheStats {
  size: number
  maxSize: number
  hits: number
  misses: number
  hitRate: number
  evictions: number
}

const CACHE_STRATEGIES: Record<string, Omit<CacheStrategy, 'pattern'>> = {
  '/categories': { ttl: 1800000, maxSize: 50, priority: 0 },
  '/tags': { ttl: 1800000, maxSize: 50, priority: 0 },
  '/resources': { ttl: 900000, maxSize: 100, priority: 1 },
  '/resource-categories': { ttl: 900000, maxSize: 50, priority: 1 },
  '/site-config': { ttl: 1800000, maxSize: 50, priority: 0 },
  '/profile': { ttl: 1800000, maxSize: 20, priority: 0 },
  '/articles': { ttl: 300000, maxSize: 200, priority: 1 },
  '/dashboard': { ttl: 120000, maxSize: 100, priority: 2 },
  '/announcements': { ttl: 900000, maxSize: 50, priority: 1 },
  '/users': { ttl: 300000, maxSize: 100, priority: 1 },
  '/roles': { ttl: 600000, maxSize: 50, priority: 1 },
  '/permissions': { ttl: 1800000, maxSize: 50, priority: 0 },
  '/logs/stats': { ttl: 60000, maxSize: 20, priority: 2 },
  '/comments': { ttl: 180000, maxSize: 100, priority: 1 }
}

const DEFAULT_TTL = 60000
const DEFAULT_MAX_SIZE = 100
const CLEANUP_INTERVAL = 60000
const MAX_TOTAL_ENTRIES = 1000

class UnifiedCacheManager {
  private cache: Map<string, CacheEntry> = new Map()
  private strategies: Map<string, CacheStrategy> = new Map()
  private stats: Map<string, CacheStats> = new Map()
  private urlMatchCache: Map<string, string | null> = new Map()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.initializeStrategies()
    this.startCleanup()
  }

  private initializeStrategies() {
    Object.entries(CACHE_STRATEGIES).forEach(([key, config]) => {
      const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|\\/|$)`)
      this.strategies.set(key, { ...config, pattern })
      this.stats.set(key, {
        size: 0,
        maxSize: config.maxSize,
        hits: 0,
        misses: 0,
        hitRate: 0,
        evictions: 0
      })
    })
  }

  private startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired()
    }, CLEANUP_INTERVAL)
  }

  private cleanupExpired() {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp >= entry.ttl) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key)
    }

    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`)
    }
  }

  private findMatchingStrategy(url: string): string | null {
    const cached = this.urlMatchCache.get(url)
    if (cached !== undefined) {
      return cached
    }

    for (const [name, strategy] of this.strategies) {
      if (strategy.pattern.test(url)) {
        this.urlMatchCache.set(url, name)
        if (this.urlMatchCache.size > 500) {
          const firstKey = this.urlMatchCache.keys().next().value
          if (firstKey) this.urlMatchCache.delete(firstKey)
        }
        return name
      }
    }

    this.urlMatchCache.set(url, null)
    return null
  }

  shouldCache(url: string | undefined): boolean {
    if (!url) return false
    return this.findMatchingStrategy(url) !== null
  }

  getCacheTTL(url: string | undefined): number {
    if (!url) return DEFAULT_TTL
    const strategyName = this.findMatchingStrategy(url)
    if (strategyName) {
      return this.strategies.get(strategyName)!.ttl
    }
    return DEFAULT_TTL
  }

  getCacheKey(method: string, url: string, params: unknown): string {
    return `${method.toUpperCase()}-${url}-${JSON.stringify(params)}`
  }

  get(key: string): unknown | null {
    const cached = this.cache.get(key)
    if (!cached) {
      this.recordMiss(key)
      return null
    }

    if (Date.now() - cached.timestamp >= cached.ttl) {
      this.cache.delete(key)
      this.recordMiss(key)
      return null
    }

    this.recordHit(key)
    return cached.data
  }

  set(key: string, data: unknown) {
    if (data === null || data === undefined) {
      logger.debug('Skip caching null/undefined value')
      return
    }

    const urlMatch = key.match(/^[A-Z]+-(.+?)-\{/)
    const url = urlMatch ? urlMatch[1] : ''
    const strategyName = this.findMatchingStrategy(url)
    const strategy = strategyName ? this.strategies.get(strategyName) : null

    const ttl = strategy ? strategy.ttl : DEFAULT_TTL
    const maxSize = strategy ? strategy.maxSize : DEFAULT_MAX_SIZE

    const strategyEntries = this.getEntriesForStrategy(strategyName)
    if (strategyEntries.length >= maxSize) {
      const oldest = strategyEntries[strategyEntries.length - 1]
      this.cache.delete(oldest.key)
      if (strategyName) {
        const stat = this.stats.get(strategyName)
        if (stat) stat.evictions++
      }
    }

    if (this.cache.size >= MAX_TOTAL_ENTRIES) {
      this.evictLowestPriority()
    }

    const estimatedSize = JSON.stringify(data).length
    this.cache.set(key, { data, timestamp: Date.now(), ttl, size: estimatedSize })
  }

  private getEntriesForStrategy(strategyName: string | null): Array<{ key: string; timestamp: number }> {
    if (!strategyName) return []

    const strategy = this.strategies.get(strategyName)
    if (!strategy) return []

    const entries: Array<{ key: string; timestamp: number }> = []
    for (const [key, entry] of this.cache) {
      const urlMatch = key.match(/^[A-Z]+-(.+?)-\{/)
      if (urlMatch && strategy.pattern.test(urlMatch[1])) {
        entries.push({ key, timestamp: entry.timestamp })
      }
    }

    entries.sort((a, b) => a.timestamp - b.timestamp)
    return entries
  }

  private evictLowestPriority() {
    let lowestPriority = Infinity
    let lowestKey: string | null = null
    let oldestTimestamp = Infinity

    for (const [key, entry] of this.cache) {
      const urlMatch = key.match(/^[A-Z]+-(.+?)-\{/)
      const url = urlMatch ? urlMatch[1] : ''
      const strategyName = this.findMatchingStrategy(url)
      const strategy = strategyName ? this.strategies.get(strategyName) : null
      const priority = strategy ? strategy.priority : 999

      if (priority > lowestPriority) continue
      if (priority === lowestPriority && entry.timestamp >= oldestTimestamp) continue

      lowestPriority = priority
      lowestKey = key
      oldestTimestamp = entry.timestamp
    }

    if (lowestKey) {
      this.cache.delete(lowestKey)
    }
  }

  private recordHit(key: string) {
    const strategyName = this.extractStrategyName(key)
    if (strategyName) {
      const stat = this.stats.get(strategyName)
      if (stat) {
        stat.hits++
        this.updateHitRate(stat)
      }
    }
  }

  private recordMiss(key: string) {
    const strategyName = this.extractStrategyName(key)
    if (strategyName) {
      const stat = this.stats.get(strategyName)
      if (stat) {
        stat.misses++
        this.updateHitRate(stat)
      }
    }
  }

  private extractStrategyName(key: string): string | null {
    const urlMatch = key.match(/^[A-Z]+-(.+?)-\{/)
    if (urlMatch) {
      return this.findMatchingStrategy(urlMatch[1])
    }
    return null
  }

  private updateHitRate(stat: CacheStats) {
    const total = stat.hits + stat.misses
    stat.hitRate = total > 0 ? Math.round((stat.hits / total) * 10000) / 100 : 0
  }

  clear() {
    this.cache.clear()
    this.urlMatchCache.clear()
    this.stats.forEach(stat => {
      stat.size = 0
      stat.hits = 0
      stat.misses = 0
      stat.hitRate = 0
      stat.evictions = 0
    })
  }

  clearByPattern(pattern: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  clearByEndpoint(endpoint: string) {
    const strategy = this.strategies.get(endpoint)
    if (!strategy) return

    for (const key of this.cache.keys()) {
      const urlMatch = key.match(/^[A-Z]+-(.+?)-\{/)
      if (urlMatch && strategy.pattern.test(urlMatch[1])) {
        this.cache.delete(key)
      }
    }
  }

  clearByRegex(regex: RegExp) {
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  getStats() {
    const totalHits = Array.from(this.stats.values()).reduce((sum, s) => sum + s.hits, 0)
    const totalMisses = Array.from(this.stats.values()).reduce((sum, s) => sum + s.misses, 0)
    const totalRequests = totalHits + totalMisses
    const overallHitRate = totalRequests > 0 ? Math.round((totalHits / totalRequests) * 10000) / 100 : 0

    return {
      size: this.cache.size,
      maxTotalEntries: MAX_TOTAL_ENTRIES,
      totalHits,
      totalMisses,
      overallHitRate,
      totalRequests,
      keys: Array.from(this.cache.keys()),
      byEndpoint: Object.fromEntries(this.stats)
    }
  }

  getUsageReport() {
    const stats = this.getStats()
    let totalEstimatedSize = 0
    for (const entry of this.cache.values()) {
      totalEstimatedSize += entry.size
    }

    return {
      ...stats,
      estimatedSizeBytes: totalEstimatedSize,
      estimatedSizeKB: Math.round(totalEstimatedSize / 1024 * 100) / 100,
      strategyCount: this.strategies.size,
      urlMatchCacheSize: this.urlMatchCache.size
    }
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.cache.clear()
    this.urlMatchCache.clear()
  }
}

export const cacheManager = new UnifiedCacheManager()
export type { CacheEntry, CacheStrategy, CacheStats }
