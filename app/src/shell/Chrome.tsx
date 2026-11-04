import { SoundToggle } from '../audio/SoundToggle'
import { Bell, Box, Plus, RotateCcw, Square } from 'lucide-react'
import { Fragment, useId, useRef } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { demoStart } from '../audio/sfx'
import { announce } from '../audio/voice'
import { useBoard } from '../board/store'
import { CabinPage } from '../cabin/lazy'
import { CabinHint } from './CabinHint'
import { markCabinSeen } from './cabinSeen'
import { met } from '../engine/actions'
import { DEMO_MAX_STEPS, resetDemo, runDemo, useDemo } from '../sim/demoRun'
import { linkAt, type LinkInfo } from '../sync/link'
import { useSync } from '../sync/store'
import { CrewSwitcher } from './CrewSwitcher'
import { duration, greetingFor, linkSummary } from './format'
import { MORE_ICON, ROUTES, routeFor } from './nav'
import { Overflow } from './Overflow'
import { useFit } from './useFit'
import { usePopover } from './usePopover'
import type { ShellData } from './useShellData'

const clock = (now: number) => met(now).replace(/ MET$/, '')

/** "LINK · 1H 00M" in the strip: the lamp says open or closed, the time is when that changes. */
function linkShort(link: LinkInfo, now: number): string {
  if (link.state === 'blackout') return 'Blackout'
  return `Link · ${duration((link.state === 'open' ? link.closesAt ?? now : link.nextOpen) - now)}`
}

/** Desktop and tablet: one tab per screen, crew screens then mission screens. At md the labels collapse to icons. */
export function TopTabs({ alerts = 0 }: { alerts?: number }) {
  return (
    <nav className="toptabs" aria-label="Crew Console">
      <ul>
        {ROUTES.map(({ path, label, tab, icon: Icon, group }, i) => (
          <Fragment key={path}>
            {i > 0 && group !== ROUTES[i - 1].group && <li className="tt-sep" aria-hidden="true" />}
            <li className={`tt-${group}`}>
              <NavLink to={path} aria-label={label} title={label}>
                <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
                <span className="tt-label" aria-hidden="true">{tab}</span>
                {path === '/alerts' && alerts > 0 && <b className="tt-n" aria-hidden="true">{alerts}</b>}
              </NavLink>
            </li>
          </Fragment>
        ))}
      </ul>
    </nav>
  )
}

/** Phones: four tabs plus a More sheet for the rest, pinned to the bottom edge where the thumb is. */
export function BottomTabs({ alerts = 0 }: { alerts?: number }) {
  const { pathname } = useLocation()
  const btn = useRef<HTMLButtonElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const [open, setOpen] = usePopover(btn, sheet)
  const id = useId()
  const secondary = ROUTES.filter((r) => !r.primary)
  const inMore = secondary.some((r) => pathname.startsWith(r.path))

  const More = MORE_ICON
  return (
    <nav className="tabs" aria-label="Crew Console">
      {open && (
        <div ref={sheet} id={id} className="more-sheet" role="dialog" aria-label="More screens">
          {secondary.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path}><Icon size={20} strokeWidth={1.9} aria-hidden="true" />{label}</NavLink>
          ))}
        </div>
      )}
      <ul>
        {ROUTES.filter((r) => r.primary).map(({ path, label, tab, mini, icon: Icon }) => (
          <li key={path}>
            <NavLink to={path} aria-label={label}>
              <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
              <span aria-hidden="true">{mini ?? tab}</span>
              {path === '/alerts' && alerts > 0 && <b className="tab-n" aria-hidden="true">{alerts}</b>}
            </NavLink>
          </li>
        ))}
        <li>
          <button ref={btn} type="button" className={inMore ? 'active' : ''} aria-expanded={open} aria-controls={open ? id : undefined} aria-label="More screens" onClick={() => setOpen(!open)}>
            <More size={20} strokeWidth={1.9} aria-hidden="true" />
            <span aria-hidden="true">More</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}

/**
 * Top bar (plan §4.1). Desktop: brand, tabs, mission strip (MET │ link │ queue), crew switcher, bell and the `⋯` menu.
 * Phones: two rows, the page name with a greeting and MET, then the crew switcher, the link chip and `⋯`.
 */
export function TopBar({ data, install }: { data: ShellData | null; install: (() => Promise<void>) | null }) {
  const select = useBoard((s) => s.selectCrew)
  const blackout = useSync((s) => s.blackout)
  const { pathname } = useLocation()
  const who = data?.crew.find((c) => c.id === data.crewId)
  const link = data ? linkAt(data.now, blackout) : null
  const summary = data && link ? linkSummary(link, data.now, data.pendingSync, data.sinceSyncH) : null
  const open = who?.alerts ?? 0
  const navigate = useNavigate()
  const demo = useDemo()
  const startDemo = () => { navigate('/board'); demoStart(); window.setTimeout(() => announce('Demo started. Carbon dioxide scrubber fault detected.'), 600); void runDemo(select) }
  const bar = useRef<HTMLElement>(null)
  useFit(bar)

  return (
    <header ref={bar} className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden="true"><Plus size={20} strokeWidth={3.2} /></span>
        <span className="brand-text"><b>AstroDocX</b><small>Crew Console</small></span>
      </div>
      <div className="greet">
        <small>{routeFor(pathname)?.label ?? 'Crew Console'}</small>
        <p>{data && who ? <>{greetingFor(data.now)}, <b>{who.name}</b></> : 'Starting up…'}</p>
      </div>
      <TopTabs alerts={open} />
      {data && who && summary && link && (
        <>
          <span className="tb-met" title="Mission elapsed time"><span className="sr-only">Mission elapsed time </span>{clock(data.now)}</span>
          <span className="tb-break" aria-hidden="true" />
          <div className="strip">
            <span className="strip-met" title="Mission elapsed time"><span className="strip-eb" aria-hidden="true">MET</span><span className="sr-only">Mission elapsed time </span><b>{clock(data.now)}</b></span>
            <Link to="/sync" className={`strip-link ${link.state}`} aria-label={`Ground link: ${summary.long}`} title="Open Ground Sync">
              <span className="lamp" aria-hidden="true" />
              <span aria-hidden="true">{linkShort(link, data.now)}</span>
              {data.pendingSync > 0 && <span className="strip-q" aria-hidden="true">{data.pendingSync}<span className="strip-ql">queued</span></span>}
            </Link>
          </div>
          <CrewSwitcher crew={data.crew} crewId={data.crewId} onSelect={select} />
          {demo.phase !== 'idle' && (
            <button type="button" className="hbtn ghost sm demo-btn" onClick={() => void resetDemo()} title="Restore the demo mission data">
              {demo.phase === 'running' ? <Square size={13} aria-hidden="true" /> : <RotateCcw size={13} aria-hidden="true" />}
              {demo.phase === 'running' ? `Demo ${demo.step}/${DEMO_MAX_STEPS}` : 'Reset demo'}
            </button>
          )}
          <span className="tb-3d">
            <Link to="/cabin" className="tb-cabin" aria-label="3D Cabin: walk through the crew module" title="Walk through the crew module in 3D"
              onPointerEnter={() => CabinPage.preload()} onFocus={() => CabinPage.preload()} onClick={markCabinSeen}>
              <Box size={16} strokeWidth={2} aria-hidden="true" /><span className="tb-cabin-l">3D Cabin</span>
            </Link>
            <CabinHint />
          </span>
          <Link to="/alerts" className={`tb-icon bell st-${who.status}`} aria-label={open ? `${open} open alert${open > 1 ? 's' : ''} for ${who.name}` : `No open alerts for ${who.name}`}>
            <Bell size={20} strokeWidth={1.9} aria-hidden="true" />
            {open > 0 && <b aria-hidden="true">{open}</b>}
          </Link>
          <SoundToggle className="tb-icon snd" compact />
          <Overflow crewId={who.id} crewName={who.name} install={install} onDemo={startDemo} />
        </>
      )}
    </header>
  )
}

/** 28 px footer on every screen: the ground link on the left, mission time and the disclaimer on the right. */
export function StatusBar({ data }: { data: ShellData | null }) {
  const blackout = useSync((s) => s.blackout)
  const link = data ? linkAt(data.now, blackout) : null
  const state = !link ? null : link.state === 'blackout' ? 'Ground link blackout' : link.state === 'open' ? `Ground link open · closes in ${duration((link.closesAt ?? data!.now) - data!.now)}` : 'Ground link closed'
  const synced = !data ? '' : data.sinceSyncH === null ? ' · no sync yet' : ` · synced ${data.sinceSyncH.toFixed(1)} h ago`
  return (
    <footer className="statusbar">
      {link && <span className={`sb-link ${link.state}`}><span className="lamp" aria-hidden="true" />{state}{synced}</span>}
      <span className="sb-right">{data && <span className="sb-met">{met(data.now)} · </span>}Prototype, not a medical device.</span>
    </footer>
  )
}
