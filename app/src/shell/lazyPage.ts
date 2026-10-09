import { lazy, type ComponentType } from 'react'

const KEY = 'astrodocx.chunk-reload'

/**
 * `React.lazy` that survives a redeploy. A page still running the previous version asks for chunk files
 * the new service worker has already replaced; the import then fails. Reload once into the new version
 * (guarded so a genuinely broken chunk cannot cause a reload loop), and clear the guard after a success.
 * `preload()` warms the chunk in the background so switching to the screen is instant.
 */
export function lazyPage<T extends ComponentType<object>>(load: () => Promise<{ default: T }>, reload: () => void = () => location.reload()) {
  // A preload in flight (or done) is reused; a failed one is forgotten so the real load retries and handles the error.
  let warm: Promise<{ default: T }> | undefined
  const preload = () => {
    if (!warm) { warm = load(); warm.catch(() => { warm = undefined }) }
  }
  const page = lazy(async () => {
    try {
      const mod = await (warm ?? load())
      try { sessionStorage.removeItem(KEY) } catch { /* storage unavailable */ }
      return mod
    } catch (err) {
      let reloaded = false
      try { reloaded = sessionStorage.getItem(KEY) === '1' } catch { /* storage unavailable */ }
      if (!reloaded) {
        try { sessionStorage.setItem(KEY, '1') } catch { /* storage unavailable */ }
        reload()
        return new Promise<{ default: T }>(() => {}) // the page is reloading; never resolve
      }
      throw err // already retried: let the error boundary show it
    }
  })
  /** Fetch the chunk ahead of time, so opening the screen does not wait on it. */
  return Object.assign(page, { preload })
}
