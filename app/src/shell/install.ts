import { useEffect, useState } from 'react'

/** Chrome, Edge and Android fire this when the PWA can be installed; Safari never does (Share → Add to Home Screen). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Returns an install function while the browser offers installation, otherwise null. */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null)
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault() // keep it for our own button instead of the browser's mini-infobar
      setEvt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setEvt(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])
  if (!evt) return null
  return async () => {
    await evt.prompt()
    await evt.userChoice
    setEvt(null) // the event can be used once
  }
}

/**
 * Ask the browser to keep this origin's storage: the on-board log lives in IndexedDB and could otherwise be
 * evicted under storage pressure. Called after a crew action, not on load, because Firefox shows a prompt.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
