import { Suspense, useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { setMusicAlert, setMusicArea, type MusicArea } from './audio/music'
import { alertChime, cabinHum, navTick, uiClick, uiHover } from './audio/sfx'
import { announce, startChatter, stopChatter } from './audio/voice'
import { CabinPage } from './cabin/lazy'
import { CabinLoader } from './cabin/CabinLoader'
import { seedDemo } from './data/demo'
import { Backdrop } from './shell/Backdrop'
import { Embed, EmbedBridge } from './shell/Embed'
import { stickyEmbed } from './shell/embedMode'
import { LAZY_PAGES, pageRoutes } from './shell/pages'
import { ErrorBoundary } from './shell/ErrorBoundary'
import { useInstallPrompt } from './shell/install'
import { BottomTabs, StatusBar, TopBar } from './shell/Chrome'
import { routeFor } from './shell/nav'
import { ShellDataContext, useShellData, type ShellData } from './shell/useShellData'
import { useSplashHandoff } from './shell/splash'
import { StateView } from './ui/StateView'
import { Tour } from './tour/Tour'
import { VitaDock } from './vita/VitaDock'
import { XrayPage } from './xray/lazy' // XRAY: the X-Ray Mirror (remove with src/xray)

// The board is the landing screen and loads eagerly; every other screen (Trends carries the chart
// library) is its own chunk. The service worker precaches all chunks, so they still work offline;
// lazyPage reloads once if a chunk is gone after a redeploy.
import { useBootDemo } from './board/hooks'
import { useBoard } from './board/store'

/** Once the board is showing and the browser is idle, fetch the other screens so the first visit to each one is instant. */
function usePreloadPages() {
  const ready = useBoard((s) => s.boot.state === 'ready')
  useEffect(() => {
    if (!ready) return
    const warm = () => LAZY_PAGES.forEach((p) => p.preload())
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(warm, { timeout: 3000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(warm, 1500)
    return () => clearTimeout(id)
  }, [ready])
}

/** On navigation: name the page in the tab title and move focus to the new content, so screen-reader and keyboard users land on it. */
function useRouteAnnounce(main: React.RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    const label = pathname.startsWith('/cabin') ? '3D Cabin' : pathname.startsWith('/xray') ? 'X-Ray Mirror' /* XRAY */ : routeFor(pathname)?.label
    document.title = label ? `${label} · AstroDocX Crew Console` : 'AstroDocX Crew Console'
    if (first.current) { first.current = false; return }
    main.current?.focus()
  }, [pathname, main])
}

/** Which score bed a screen gets (the Alerts screen plays the red one only while an Act-level alert is open: see setMusicAlert). */
const areaFor = (pathname: string): MusicArea =>
  pathname.startsWith('/cabin') ? 'cabin' : pathname.startsWith('/checkin') ? 'checkin' : pathname.startsWith('/trends') ? 'trends'
    : pathname.startsWith('/alerts') ? 'alert' : pathname.startsWith('/ground') || pathname.startsWith('/sync') ? 'ground' : 'dashboard'

/** The score follows the screen, and the red bed follows an open Act-level alert on the selected crew member. */
function useMusicArea(shell: ShellData | null, embedded: boolean) {
  const { pathname } = useLocation()
  useEffect(() => { if (!embedded) setMusicArea(areaFor(pathname)) }, [pathname, embedded])
  const me = shell?.crew.find((c) => c.id === shell.crewId)
  const act = !!me && me.status === 'act' && me.alerts > 0
  useEffect(() => { if (!embedded) setMusicAlert(act) }, [act, embedded])
}

/** A tick on moving between screens, and a chime when the crew's open alerts go up (more urgent if anyone is at Act). */
function useShellSounds(shell: ShellData | null, quiet: boolean) {
  const { pathname } = useLocation()
  const page = useRef(pathname)
  useEffect(() => {
    if (pathname === page.current) return
    page.current = pathname
    if (!quiet) navTick()
  }, [pathname, quiet])
  // the console's own ambience: a low hum, console chirps and radio calls with Ground; the cabin has its own
  useEffect(() => {
    if (quiet) return
    cabinHum(true); startChatter('console')
    return () => { cabinHum(false); stopChatter() }
  }, [quiet])
  // a soft tick under the pointer and a click on every control
  useEffect(() => {
    if (quiet) return
    const hit = (e: Event) => (e.target as Element | null)?.closest('button, a, [role="tab"], summary, select, input[type="checkbox"], input[type="radio"]')
    const over = (e: PointerEvent) => { if (e.pointerType === 'mouse' && hit(e)) uiHover() }
    const down = (e: PointerEvent) => { const t = hit(e); if (t && !t.matches('a')) uiClick() }
    document.addEventListener('pointerover', over); document.addEventListener('pointerdown', down)
    return () => { document.removeEventListener('pointerover', over); document.removeEventListener('pointerdown', down) }
  }, [quiet])
  const total = shell ? shell.crew.reduce((n, c) => n + c.alerts, 0) : null
  const act = !!shell?.crew.some((c) => c.status === 'act')
  const was = useRef<number | null>(null)
  useEffect(() => {
    if (total === null) return
    if (was.current !== null && total > was.current && !quiet) {
      alertChime(act)
      const who = shell?.crew.filter((c) => c.alerts > 0).sort((a, b) => (b.status === 'act' ? 1 : 0) - (a.status === 'act' ? 1 : 0))[0]
      window.setTimeout(() => announce(who ? `${act ? 'Warning' : 'Attention'}. New alert for the ${who.name}${who.worstHazard ? `. ${who.worstHazard}` : ''}.` : 'Attention. New alert.'), 900)
    }
    was.current = total
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, act, quiet])
}

export default function App() {
  useBootDemo()
  useSplashHandoff()
  usePreloadPages()
  const main = useRef<HTMLElement>(null)
  useRouteAnnounce(main)
  const install = useInstallPrompt()
  const shell = useShellData()
  const { pathname, search } = useLocation()
  // A single screen without the frame, for the 3D cabin's wall screens.
  const embed = stickyEmbed(search)
  useShellSounds(shell, !!embed || pathname.startsWith('/cabin') || pathname.startsWith('/xray') /* XRAY */)
  useMusicArea(shell, !!embed)
  if (embed) return (
    <ShellDataContext.Provider value={shell}>
      <EmbedBridge />
      <ErrorBoundary key={pathname} onReset={() => seedDemo().then(() => undefined)}><Embed {...embed} /></ErrorBoundary>
    </ShellDataContext.Provider>
  )
  // XRAY: the X-Ray Mirror is full screen too (remove this block with src/xray)
  if (pathname.startsWith('/xray')) return (
    <ErrorBoundary key={pathname}>
      <Suspense fallback={<StateView kind="loading" label="Loading the X-ray mirror" />}><XrayPage /></Suspense>
    </ErrorBoundary>
  )
  // 3D mode is full screen: no console frame or animated backdrop drawing behind it.
  if (pathname.startsWith('/cabin')) return (
    <ShellDataContext.Provider value={shell}>
      <ErrorBoundary key={pathname} onReset={() => seedDemo().then(() => undefined)}>
        <Suspense fallback={<CabinLoader />}><CabinPage /></Suspense>
      </ErrorBoundary>
      <Tour />
      <VitaDock />
    </ShellDataContext.Provider>
  )
  return (
    <ShellDataContext.Provider value={shell}>
    <div className="shell">
      <Backdrop />
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="frame">
        <TopBar data={shell} install={install} />
      <main id="main" ref={main} tabIndex={-1}>
        {/* key: a crash on one screen clears when the crew moves to another */}
        <ErrorBoundary key={pathname} onReset={() => seedDemo().then(() => undefined)}>
        <Suspense fallback={<StateView kind="loading" label="Loading screen" />}>
        <Routes>
          <Route path="/" element={<Navigate to="/board" replace />} />
          {pageRoutes()}
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      <StatusBar data={shell} />
      </div>
      <BottomTabs alerts={shell?.crew.find((c) => c.id === shell.crewId)?.alerts ?? 0} />
      <Tour />
      <VitaDock />
    </div>
    </ShellDataContext.Provider>
  )
}
