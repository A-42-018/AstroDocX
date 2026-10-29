import { useLayoutEffect, type RefObject } from 'react'

/** Compaction steps in layout.css (`.fit-1` … `.fit-N`), each one dropping more labels than the last. */
export const FIT_STEPS = 5

/**
 * Keeps the desktop top bar on one line whatever is in it (crew count, demo button, the link time, the window
 * width): starting from the full bar it adds `.fit-1`, `.fit-2`, … until nothing overflows. Measured rather than
 * set by breakpoints, so a new tab or button can't push the bell and `⋯` off the edge again. Phones have their
 * own two-row bar and are left alone.
 */
export function useFit(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const phone = window.matchMedia('(max-width: 767px)')
    let busy = false
    const fit = () => {
      if (busy) return
      busy = true
      const set = (level: number) => { for (let i = 1; i <= FIT_STEPS; i++) el.classList.toggle(`fit-${i}`, i <= level) }
      let level = 0
      set(0)
      if (!phone.matches) while (el.scrollWidth > el.clientWidth + 1 && level < FIT_STEPS) set(++level)
      busy = false
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    // Things that come and go inside the bar (crew data arriving, the demo button), not the ticking clock text
    const mo = new MutationObserver(fit)
    mo.observe(el, { childList: true, subtree: true })
    phone.addEventListener('change', fit)
    return () => { ro.disconnect(); mo.disconnect(); phone.removeEventListener('change', fit) }
  }, [ref])
}
