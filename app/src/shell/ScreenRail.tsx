import { Activity } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { ROUTES } from './nav'

/**
 * The page tabs down the side of a screen in the 3D cabin, like a console's own: icons while the screen is across the hall,
 * with their names and bigger targets once it is being used (the cabin sets html.adx-engaged).
 */
export function ScreenRail() {
  const tabs = [
    ROUTES[0], { path: '/vitals', label: 'Live Vitals', tab: 'Vitals', icon: Activity },
    ...ROUTES.slice(1),
  ]
  return (
    <nav className="screen-rail" aria-label="Screens">
      {tabs.map((r) => (
        <NavLink key={r.path} to={r.path} className="sr-tab" title={r.label} aria-label={r.label}>
          <r.icon size={20} strokeWidth={1.9} aria-hidden="true" />
          <span>{r.tab}</span>
        </NavLink>
      ))}
    </nav>
  )
}
