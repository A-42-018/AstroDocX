import { Bell, Download, House, Play, Radio, RadioTower, RotateCcw, WifiOff } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useBoard } from '../board/store'
import { met } from '../engine/actions'
import { DEMO_MAX_STEPS, resetDemo, runDemo, useDemo } from '../sim/demoRun'
import { linkAt } from '../sync/link'
import { useSync } from '../sync/store'
import { CrewSwitcher } from './CrewSwitcher'
import { greetingFor, linkSummary } from './format'
import { MORE_ICON, ROUTES } from './nav'
import type { ShellData } from './useShellData'

/** Desktop and tablet: a slim icon rail on the left (labels under the icons, names as link names). */
export function Rail() {
  return (
    <nav className="rail" aria-label="Crew Console">
      <span className="brand-mark" aria-hidden="true" />
      <ul>
        <li className="rail-home">
          <a href="/" aria-label="Back to the AstroDocX landing page" title="Back to the landing page">
            <House size={20} strokeWidth={1.9} aria-hidden="true" />
            <span aria-hidden="true">Landing</span>
          </a>
        </li>
        {ROUTES.map(({ path, label, tab, icon: Icon }) => (
          <li key={path}>
            <NavLink to={path} aria-label={label} title={label}>
              <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
              <span aria-hidden="true">{tab}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Phones: four tabs plus a More sheet for the rest, pinned to the bottom edge where the thumb is. */
export function BottomTabs() {
  const { pathname } = useLocation()
  // The sheet is tied to the page it was opened on, so navigating closes it without an effect.
  const [openPath, setOpenPath] = useState<string | null>(null)
  const open = openPath === pathname
  const setOpen = (v: boolean) => setOpenPath(v ? pathname : null)
  const id = useId()
  const btn = useRef<HTMLButtonElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const secondary = ROUTES.filter((r) => !r.primary)
  const inMore = secondary.some((r) => pathname.startsWith(r.path))

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpenPath(null); btn.current?.focus() } }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!sheet.current?.contains(t) && !btn.current?.contains(t)) setOpenPath(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [open])

  const More = MORE_ICON
  return (
    <nav className="tabs" aria-label="Crew Console">
      {open && (
        <div ref={sheet} id={id} className="more-sheet">
          {secondary.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path}><Icon size={20} strokeWidth={1.9} aria-hidden="true" />{label}</NavLink>
          ))}
        </div>
      )}
      <ul>
        {ROUTES.filter((r) => r.primary).map(({ path, label, tab, icon: Icon }) => (
          <li key={path}>
            <NavLink to={path} aria-label={label}>
              <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
              <span aria-hidden="true">{tab}</span>
            </NavLink>
          </li>
        ))}
        <li>
          <button ref={btn} type="button" className={inMore ? 'active' : ''} aria-expanded={open} aria-controls={open ? id : undefined} aria-label="More screens" onClick={() => setOpen(!open)}>
            <More size={22} strokeWidth={1.9} aria-hidden="true" />
            <span aria-hidden="true">More</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}

/** Greeting, crew switcher, mission clock, ground-link widget and alert bell: what the crew needs to see on every screen. */
export function TopBar({ data, install }: { data: ShellData | null; install: (() => Promise<void>) | null }) {
  const select = useBoard((s) => s.selectCrew)
  const blackout = useSync((s) => s.blackout)
  const who = data?.crew.find((c) => c.id === data.crewId)
  const link = data ? linkAt(data.now, blackout) : null
  const summary = data && link ? linkSummary(link, data.now, data.pendingSync, data.sinceSyncH) : null
  const LinkIcon = link?.state === 'open' ? RadioTower : link?.state === 'blackout' ? WifiOff : Radio
  const open = who?.alerts ?? 0
  const navigate = useNavigate()
  const demo = useDemo()
  const startDemo = () => { navigate('/board'); void runDemo(select) }

  return (
    <header className="topbar">
      <div className="greet">
        <small>AstroDocX · Crew Console</small>
        <p>{data && who ? <>{greetingFor(data.now)}, <b>{who.name}</b></> : 'Starting up…'}</p>
      </div>
      {data && who && (
        <div className="tb-right">
          <a href="/" className="btn ghost home-btn" aria-label="Back to the AstroDocX landing page" title="Back to the landing page">
            <House size={16} aria-hidden="true" /><span>Landing</span>
          </a>
          <span className="tb-break" aria-hidden="true" />
          <CrewSwitcher crew={data.crew} crewId={data.crewId} onSelect={select} />
          <span className="chip met mono" title="Mission elapsed time"><span className="sr-only">Mission elapsed time </span>{met(data.now)}</span>
          {summary && link && (
            <Link to="/sync" className={`chip link-chip ${link.state}`} aria-label={`Ground link: ${summary.long}`} title="Open Ground Sync">
              <LinkIcon size={15} strokeWidth={2} aria-hidden="true" />
              <span className="lc-long" aria-hidden="true">{summary.long}</span>
              <span className="lc-short" aria-hidden="true">{summary.short}</span>
            </Link>
          )}
          {demo.phase === 'idle' ? (
            <button type="button" className="btn ghost demo-btn" onClick={startDemo} title="Inject a CO₂ scrubber fault and watch the board react (about 20 s)">
              <Play size={15} aria-hidden="true" />Run demo
            </button>
          ) : (
            <button type="button" className="btn ghost demo-btn" onClick={() => void resetDemo()} title="Restore the demo mission data">
              <RotateCcw size={15} aria-hidden="true" />{demo.phase === 'running' ? `Demo ${demo.step}/${DEMO_MAX_STEPS} · stop` : 'Reset demo'}
            </button>
          )}
          <Link to="/alerts" className={`bell st-${who.status}`} aria-label={open ? `${open} open alert${open > 1 ? 's' : ''} for ${who.name}` : `No open alerts for ${who.name}`}>
            <Bell size={20} strokeWidth={1.9} aria-hidden="true" />
            {open > 0 && <b aria-hidden="true">{open}</b>}
          </Link>
          {install && (
            <button type="button" className="btn ghost install-btn" onClick={() => void install()}>
              <Download size={16} aria-hidden="true" />Install
            </button>
          )}
        </div>
      )}
    </header>
  )
}
