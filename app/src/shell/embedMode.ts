import { routeFor } from './nav'

/* Whether this page is a screen on the 3D cabin's wall (shell/Embed.tsx). Its own module so any page can ask without importing the screens. */

export type EmbedView = 'board' | 'vitals' | 'alerts' | 'trends'
const VIEWS: EmbedView[] = ['board', 'vitals', 'alerts', 'trends']

/** `?embed=<view>&crew=<id>` from the URL, or null for the normal console. */
export function embedFromUrl(search: string): { view: EmbedView; crew: string | null } | null {
  const q = new URLSearchParams(search), view = q.get('embed') as EmbedView | null
  return view && VIEWS.includes(view) ? { view, crew: q.get('crew') } : null
}

/*
 * A screen on the cabin's wall is the console in a frame, and it stays one: the embed is read once, when the frame loads, and kept
 * while the visitor moves between pages (their links and the rail drop the query string, which would otherwise turn the
 * screen into the whole console, top bar and all).
 */
const FIRST = typeof window !== 'undefined' ? embedFromUrl(window.location.search) : null
export function stickyEmbed(search: string) { return embedFromUrl(search) ?? FIRST }
/** Is this page a screen on the cabin's wall? (The 3D cabin links are hidden there: a cabin does not nest.) */
export const isEmbed = () => FIRST !== null


/** The screen's title for the cabin's bar. */
export const pageLabel = (path: string) => path.startsWith('/vitals') ? 'Live Vitals' : routeFor(path)?.label ?? 'Status Board'
