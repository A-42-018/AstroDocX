import { ChartLine, ClipboardCheck, Stethoscope, Ellipsis, EllipsisVertical, Globe, LayoutDashboard, Library, Radio, Rocket, Siren, type LucideIcon } from 'lucide-react'

export interface NavRoute {
  path: string
  /** Full name: page title, tab tooltip, link name. */
  label: string
  /** Label on the top tab bar. */
  tab: string
  /** Shortest label, under the icon on the phone tab bar (defaults to `tab`). */
  mini?: string
  icon: LucideIcon
  /** Phones show four tabs plus "More"; the rest live in the More sheet. */
  primary: boolean
  /** Top bar: crew screens, a divider, then mission screens. */
  group: 'crew' | 'mission'
}

export const ROUTES: readonly NavRoute[] = [
  { path: '/board', label: 'Status Board', tab: 'Board', icon: LayoutDashboard, primary: true, group: 'crew' },
  { path: '/doctor', label: 'Crew Doctor', tab: 'Doctor', icon: Stethoscope, primary: true, group: 'crew' },
  { path: '/alerts', label: 'Alerts', tab: 'Alerts', icon: Siren, primary: true, group: 'crew' },
  { path: '/trends', label: 'Trends', tab: 'Trends', icon: ChartLine, primary: false, group: 'crew' },
  { path: '/checkin', label: 'Check-in', tab: 'Check-in', mini: 'Check', icon: ClipboardCheck, primary: true, group: 'crew' },
  { path: '/simulator', label: 'Simulator', tab: 'Simulator', icon: Rocket, primary: false, group: 'mission' },
  { path: '/sync', label: 'Ground Sync', tab: 'Sync', icon: Radio, primary: false, group: 'mission' },
  { path: '/ground', label: 'Ground View', tab: 'Ground', icon: Globe, primary: false, group: 'mission' },
  { path: '/nasa', label: 'NASA Data', tab: 'NASA Data', mini: 'NASA', icon: Library, primary: false, group: 'mission' },
]

export const MORE_ICON = Ellipsis
export const OVERFLOW_ICON = EllipsisVertical

/** The route a path belongs to (nested paths included). */
export const routeFor = (pathname: string) => ROUTES.find((r) => pathname.startsWith(r.path))

