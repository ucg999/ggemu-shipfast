export function createThemeGameCache<T>(ttl = 300_000) {
  const values = new Map<string, { time: number; value: T }>()
  const pending = new Map<string, Promise<T>>()
  return {
    get(key: string): T | undefined {
      let entry = values.get(key)
      if (!entry && typeof window !== 'undefined') {
        try {
          const saved = JSON.parse(window.sessionStorage.getItem(`pro-games:${key}`) || 'null')
          if (saved && typeof saved.time === 'number' && Array.isArray(saved.value)) entry = saved
        } catch { /* Storage is optional. */ }
      }
      if (!entry || Date.now() - entry.time >= ttl) return undefined
      values.set(key, entry)
      return entry.value
    },
    load(key: string, fetcher: () => Promise<T>): Promise<T> {
      const cached = this.get(key)
      if (cached !== undefined) return Promise.resolve(cached)
      const running = pending.get(key)
      if (running) return running
      const request = Promise.resolve().then(fetcher).then(value => {
        const entry = { time: Date.now(), value }
        values.set(key, entry)
        if (typeof window !== 'undefined') {
          try { window.sessionStorage.setItem(`pro-games:${key}`, JSON.stringify(entry)) } catch { /* Storage is optional. */ }
        }
        return value
      }).finally(() => pending.delete(key))
      pending.set(key, request)
      return request
    },
  }
}
