const memory = new Map<string, unknown>()

export function readHomeCards<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return (memory.get(key) ?? JSON.parse(sessionStorage.getItem(`home-cards:${key}`) || 'null')) as T | undefined
  } catch { return memory.get(key) as T | undefined }
}

export function saveHomeCards<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  memory.set(key, value)
  try { sessionStorage.setItem(`home-cards:${key}`, JSON.stringify(value)) } catch { /* Memory cache remains available. */ }
}
