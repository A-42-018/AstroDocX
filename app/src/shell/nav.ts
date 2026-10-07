import { ChartLine, ClipboardCheck, Ellipsis, Globe, LayoutDashboard, Radio, Rocket, Siren, type LucideIcon } from 'lucide-react'

export interface NavRoute {
  path: string
  /** Full name: page title, rail tooltip, link name. */
  label: string
  /** Short label under the icon on the phone tab bar. */
  tab: string
  icon: LucideIcon
  /** Phones show four tabs plus "More"; the rest live in the More sheet. */
  primary: boolean
}

export const ROUTES: readonly NavRoute[] = [
  { path: '/board', label: 'Status Board', tab: 'Board', icon: LayoutDashboard, primary: true },
  { path: '/alerts', label: 'Alerts', tab: 'Alerts', icon: Siren, primary: true },
  { path: '/trends', label: 'Trends', tab: 'Trends', icon: ChartLine, primary: true },
  { path: '/checkin', label: 'Check-in', tab: 'Check-in', icon: ClipboardCheck, primary: true },
  { path: '/simulator', label: 'Simulator', tab: 'Simulator', icon: Rocket, primary: false },
  { path: '/sync', label: 'Ground Sync', tab: 'Sync', icon: Radio, primary: false },
  { path: '/ground', label: 'Ground View', tab: 'Ground', icon: Globe, primary: false },
]

export const MORE_ICON = Ellipsis
