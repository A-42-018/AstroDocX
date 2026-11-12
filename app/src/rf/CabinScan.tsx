import { useEffect, useMemo, useRef, useState } from 'react'
import { CREW } from '../data/synthetic'
import { useHidden, useReducedMotion } from '../live/usePaused'
import { KpiCell, KpiGrid, Switch } from '../ui'
import { CABIN_H, CABIN_W, CabinScanner, CabinSim, GH, GW, LINKS, NODES, ZONES, type Activity, type TruePerson, type Track } from './cabin'

const FPS = 30
const STEP = 0.1 // seconds of simulation per scan
const COLOR: Record<Activity, string> = { Sleeping: '#8b9cff', Working: '#36e2f5', Eating: '#ffc53d', Exercising: '#ff4d6a', Moving: '#3ddc97' }
const ACTIVITIES = Object.keys(COLOR) as Activity[]

interface View { tracks: Track[]; truth: TruePerson[] }

/** One simulated cabin: the crew, and a scanner that only sees the disturbance on the Wi-Fi links. */
function makeWorld() {
  const sim = new CabinSim(CREW)
  const scanner = new CabinScanner()
  let links: number[] = LINKS.map(() => 0)
  const tick = () => { links = sim.step(STEP); scanner.update(links, STEP) }
  for (let i = 0; i < 250; i++) tick() // open with the scan already settled
  return { sim, scanner, tick, links: () => links }
}

function draw(cv: HTMLCanvasElement, off: HTMLCanvasElement, w: ReturnType<typeof makeWorld>, showTruth: boolean, t: number, animate: boolean) {
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = Math.max(1, cv.getBoundingClientRect().width), H = W * (CABIN_H / CABIN_W)
  if (cv.width !== Math.floor(W * dpr)) { cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr) }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const s = W / CABIN_W
  ctx.fillStyle = '#03090f'; ctx.fillRect(0, 0, W, H)

  // heat map from the back-projection of the link disturbances
  const octx = off.getContext('2d')!
  const img = octx.createImageData(GW, GH)
  const heat = w.scanner.heat
  for (let n = 0; n < heat.length; n++) {
    const v = Math.max(0, Math.min(1, heat[n] / 2.2))
    const a = Math.pow(v, 1.4)
    img.data[n * 4] = 255 * Math.min(1, v * 1.6); img.data[n * 4 + 1] = 170 * (1 - 0.5 * v) + 60 * v; img.data[n * 4 + 2] = 230 * (1 - v); img.data[n * 4 + 3] = 210 * a
  }
  octx.putImageData(img, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(off, 0, 0, W, H)

  // zones
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(70,225,245,0.28)'; ctx.fillStyle = 'rgba(190,230,245,0.55)'; ctx.font = '600 10px ui-monospace, monospace'
  for (const z of ZONES) { ctx.strokeRect(z.x * s + 0.5, z.y * s + 0.5, z.w * s - 1, z.h * s - 1); ctx.fillText(z.label.toUpperCase(), z.x * s + 8, z.y * s + 15) }

  // links brighten with the disturbance they carry
  const links = w.links()
  LINKS.forEach(([i, j], k) => {
    const a = Math.min(0.9, 0.06 + links[k] * 0.45)
    ctx.strokeStyle = `rgba(54,226,245,${a})`; ctx.lineWidth = 0.5 + links[k] * 1.2
    ctx.beginPath(); ctx.moveTo(NODES[i].x * s, NODES[i].y * s); ctx.lineTo(NODES[j].x * s, NODES[j].y * s); ctx.stroke()
  })
  // nodes, with a slow ripple while live
  NODES.forEach((n, i) => {
    ctx.strokeStyle = '#9ff4ff'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(n.x * s, n.y * s, 5, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = i === 0 ? '#ffc53d' : '#36e2f5'; ctx.beginPath(); ctx.arc(n.x * s, n.y * s, 2.4, 0, Math.PI * 2); ctx.fill()
    if (animate) {
      const p = ((t * 0.6 + i * 0.37) % 1)
      ctx.strokeStyle = `rgba(54,226,245,${0.5 * (1 - p)})`; ctx.beginPath(); ctx.arc(n.x * s, n.y * s, 5 + p * 22, 0, Math.PI * 2); ctx.stroke()
    }
  })

  // what the scan found
  ctx.font = '600 11px ui-monospace, monospace'
  for (const tr of w.scanner.tracks) {
    if (tr.hits <= 8) continue
    const c = COLOR[tr.activity]
    const x = tr.p.x * s, y = tr.p.y * s
    ctx.strokeStyle = c; ctx.fillStyle = c + '33'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(x, y, 0.42 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    const label = `${tr.activity}`
    const tw = ctx.measureText(label).width
    const lx = Math.min(Math.max(x - tw / 2, 4), W - tw - 4)
    ctx.fillStyle = 'rgba(2,8,12,0.85)'; ctx.fillRect(lx - 3, y + 0.46 * s, tw + 6, 15)
    ctx.fillStyle = c; ctx.fillText(label, lx, y + 0.46 * s + 11)
  }
  // the simulation's true positions, for checking the scan against
  if (showTruth) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2
    for (const p of w.sim.people()) {
      const x = p.p.x * s, y = p.p.y * s
      ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.stroke()
    }
  }
}

/**
 * Cabin sweep: a top-down plan of the cabin with its Wi-Fi nodes. The crew (simulated) disturb the links; the scanner paints a
 * heat map from those disturbances, finds the people in it, follows them and names what each is doing.
 */
export function CabinScan() {
  const world = useMemo(makeWorld, [])
  const cv = useRef<HTMLCanvasElement>(null)
  const [showTruth, setShowTruth] = useState(false)
  const truthRef = useRef(showTruth)
  const reduced = useReducedMotion()
  const hidden = useHidden()
  const [view, setView] = useState<View>(() => ({ tracks: [], truth: [] }))

  const snapshot = (): View => ({
    tracks: world.scanner.tracks.filter((t) => t.hits > 8).map((t) => ({ ...t, trail: [], votes: [] })),
    truth: world.sim.people(),
  })

  useEffect(() => { truthRef.current = showTruth })
  useEffect(() => {
    const el = cv.current
    if (!el) return
    const off = document.createElement('canvas'); off.width = GW; off.height = GH
    const paint = (t: number, animate: boolean) => draw(el, off, world, truthRef.current, t, animate)
    paint(0, false); setView(snapshot())
    if (reduced || hidden) return
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => paint(0, false)) : null
    ro?.observe(el)
    let raf = 0, last = performance.now(), acc = 0, t = 0, lastView = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - last < 1000 / FPS - 1) return
      const dt = Math.min((now - last) / 1000, 0.25)
      last = now; acc += dt; t += dt
      while (acc >= STEP) { acc -= STEP; world.tick() }
      paint(t, true)
      if (now - lastView > 400) { lastView = now; setView(snapshot()) }
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro?.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, reduced, hidden])

  // a still page repaints when the overlay is toggled
  useEffect(() => {
    if (!reduced || !cv.current) return
    draw(cv.current, Object.assign(document.createElement('canvas'), { width: GW, height: GH }), world, showTruth, 0, false)
  }, [showTruth, reduced, world])

  const count = (a: Activity) => view.tracks.filter((t) => t.activity === a).length
  return (
    <div className="rf-cabin">
      <canvas ref={cv} className="rf-cabin-cv" aria-hidden="true" />
      <div className="rf-cabin-side">
        <KpiGrid>
          <KpiCell label="Wi-Fi sees" value={`${view.tracks.length} of ${CREW.length}`} sub="crew" />
          <KpiCell label="Moving" value={count('Moving')} />
          <KpiCell label="Exercising" value={count('Exercising')} />
          <KpiCell label="Asleep" value={count('Sleeping')} />
        </KpiGrid>
        <ul className="rf-legend" aria-label="Activity colours">
          {ACTIVITIES.map((a) => <li key={a}><i style={{ background: COLOR[a] }} aria-hidden="true" />{a}</li>)}
        </ul>
        <Switch checked={showTruth} onChange={setShowTruth}>Show true positions (simulation only)</Switch>
        <ol className="rf-found" aria-label="People the scan found">
          {view.tracks.length === 0 && <li className="rf-found-empty">Nobody found yet.</li>}
          {view.tracks.map((t) => (
            <li key={t.id}><b style={{ color: COLOR[t.activity] }}>{t.activity}</b><span>{t.zone.label}</span></li>
          ))}
        </ol>
      </div>
    </div>
  )
}
