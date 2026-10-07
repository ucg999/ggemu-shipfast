export async function fetchWithTimeoutRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 8_000,
) {
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const timeoutController = new AbortController()
    const timeout = setTimeout(() => timeoutController.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs)
    const signal = init.signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([init.signal, timeoutController.signal])
      : timeoutController.signal

    try {
      return await fetch(input, { ...init, signal })
    } catch (error) {
      lastError = error
      const timedOut = timeoutController.signal.aborted && !init.signal?.aborted
      if (!timedOut || attempt === 1) throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError
}
