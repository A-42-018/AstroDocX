import { useEffect, useState, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled)'

/**
 * Open state and keyboard behaviour shared by the overflow menu and the phone More sheet: focus moves into the
 * panel when it opens, Escape and an outside click close it (Escape returns focus to the trigger), ArrowUp/Down
 * move between items, and navigating closes it. Radios keep their own arrow keys.
 */
export function usePopover(trigger: RefObject<HTMLElement | null>, panel: RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()
  // Tied to the page it was opened on, so navigating closes it without an effect.
  const [openPath, setOpenPath] = useState<string | null>(null)
  const open = openPath === pathname
  const setOpen = (v: boolean) => setOpenPath(v ? pathname : null)

  useEffect(() => {
    if (!open) return
    // Sorted, because not every DOM returns a selector list in document order
    const items = () => [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    items()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpenPath(null); trigger.current?.focus(); return }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const t = e.target as HTMLElement
      if (!panel.current?.contains(t) || (t instanceof HTMLInputElement && t.type === 'radio')) return
      e.preventDefault()
      const list = items().filter((el) => !(el instanceof HTMLInputElement && el.type === 'radio' && !el.checked))
      const i = list.indexOf(t)
      list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus()
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) setOpenPath(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [open, panel, trigger])

  return [open, setOpen] as const
}
