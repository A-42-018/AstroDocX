import '../styles/pages/scan.css'
import { ArrowRight, Camera, CameraOff, Check, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import type { CrewMember, FaceScan } from '../data/types'
import { confirmChime, faceLock, notAllowed, scanSweep } from '../audio/sfx'
import { met } from '../engine/actions'
import { loadTargets } from '../live/telemetry'
import { requestPersistentStorage } from '../shell/install'
import { Brackets, HudPanel, KpiCell, KpiGrid, PanelHeader, StatusTag, buttonClass } from '../ui'
import { StateView } from '../ui/StateView'
import type { ScanAnalysis } from './rppg'
import { FS, SCAN_SECONDS } from './rppg'
import { saveScan, watchScans, whyNot } from './store'
import { useFaceScan } from './useFaceScan'
import { ScanOverlay } from './ScanOverlay'

/** The live pulse as a line: the band-passed trace, scaled to its own peak. */
function Trace({ data }: { data: Float64Array }) {
  const n = data.length
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]))
  const pts = n > 8 && peak > 0
    ? Array.from(data, (v, i) => `${((i / (n - 1)) * 300).toFixed(1)},${(30 - (v / peak) * 25).toFixed(1)}`).join(' ')
    : ''
  return (
    <svg className="sc-trace" viewBox="0 0 300 60" preserveAspectRatio="none" role="img" aria-label="Live pulse waveform">
      <line x1="0" x2="300" y1="30" y2="30" className="sc-zero" />
      {pts ? <polyline points={pts} className="sc-line" /> : <text x="150" y="34" className="sc-wait" textAnchor="middle">waiting for signal</text>}
    </svg>
  )
}

const fmt = (n: number | null | undefined, dec = 0) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(dec))

/** What the scan can say so far: live estimate while measuring, the full result when done. Nothing unreliable is shown as a number. */
function Reading({ a, wearable }: { a: ScanAnalysis | null; wearable: number | null }) {
  const ok = !!a?.reliable
  return (
    <KpiGrid>
      <KpiCell label="Heart rate" value={ok ? fmt(a!.bpm) : '—'} sub={ok ? 'bpm' : undefined} />
      <KpiCell label="HRV (rough)" value={ok ? fmt(a!.hrv) : '—'} sub={ok && a!.hrv !== null ? 'ms' : undefined} />
      <KpiCell label="Breathing" value={ok ? fmt(a!.resp) : '—'} sub={ok && a!.resp !== null ? '/min' : undefined} />
      <KpiCell label="Signal" value={a ? `${Math.round(a.quality * 100)}%` : '—'} sub={a && !ok ? 'weak' : undefined} />
      <KpiCell label="Wearable HR" value={wearable !== null ? Math.round(wearable) : '—'} sub={wearable !== null ? 'bpm · cross-check' : undefined} />
    </KpiGrid>
  )
}

const PHASE_META: Record<string, string> = { aiming: 'Aim your face', measuring: 'Measuring', done: 'Done' }

/** The scan. Inside the check-in it is the first step: `onContinue` moves on to the questions (skipping is fine). On its own it links back to the check-in. */
export default function FaceScanPage({ onContinue }: { onContinue?: () => void } = {}) {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  if (boot.state === 'error') return <StateView kind="error" title="Could not open the local database"><p>{boot.error}</p></StateView>
  if (boot.state !== 'ready' || snap === undefined) {
    const pct = boot.state === 'seeding' && boot.total > 0 ? (boot.done / boot.total) * 100 : undefined
    return <StateView kind="loading" label="Initializing demo mission data" progress={pct} />
  }
  if (snap === null) return <StateView kind="empty" label="No crew data yet." />
  // key: a fresh scan for each crew member
  return <ScanView key={snap.crewId} crew={snap.crew} crewId={snap.crewId} now={snap.now} onContinue={onContinue} />
}

function ScanView({ crew, crewId, now, onContinue }: { crew: CrewMember[]; crewId: string; now: number; onContinue?: () => void }) {
  const { videoRef, camera, error, notice, view, start, stop } = useFaceScan()
  const [history, setHistory] = useState<FaceScan[]>([])
  const [wearable, setWearable] = useState<number | null>(null)
  const [saved, setSaved] = useState<FaceScan | null>(null)
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)
  const hintId = useId()
  const index = crew.findIndex((c) => c.id === crewId)
  const who = crew[index]

  useEffect(() => {
    const sub = watchScans(crewId, setHistory, () => {})
    void loadTargets(crewId).then((t) => setWearable(t.hr), () => {})
    return () => sub.unsubscribe()
  }, [crewId])

  // the scan is over: let go of the camera so its light goes off
  const done = view.phase === 'done'
  useEffect(() => { if (done) stop() }, [done, stop])
  // sonar lock when the face is held steady and the measurement starts; a sweep that ends on a bell when the result is in
  useEffect(() => { if (view.phase === 'measuring') faceLock() }, [view.phase])
  useEffect(() => { if (done) scanSweep() }, [done])

  const result = view.final
  const blocked = result ? whyNot(result) : null
  const shown = result ?? view.live
  const on = camera === 'on' || camera === 'starting'
  const tone: 'ok' | 'bad' = view.verdict === 'ok' ? 'ok' : 'bad'
  // after the scan, the last 8 s of the pulse stay on screen
  const trace = on ? view.trace : result ? result.pulse.slice(-8 * FS) : new Float64Array(0)

  const begin = () => { setSaved(null); setSaveError(''); void start() }
  const save = async () => {
    if (!result) return
    setBusy(true); setSaveError('')
    try {
      setSaved(await saveScan({ crewId, ts: now, analysis: result }))
      confirmChime()
      void requestPersistentStorage()
    } catch (e) {
      notAllowed()
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="sc">
      <div className="sc-side">
        <HudPanel title="Face scan" meta="Experimental" className="sc-who">
          <p className="sc-eb">{onContinue ? 'Check-in · step 1 · optional' : `Crew ${String(index + 1).padStart(2, '0')} · ${who?.role}`}</p>
          <h1 className="sc-h1">Face scan · {who?.name}</h1>
          <p className="sc-intro">Your camera sees the faint colour change of your skin with each heartbeat. {SCAN_SECONDS} seconds gives a heart rate, a rough HRV and your breathing rate.</p>
          <ul className="sc-facts">
            <li>Video stays on this device. Only the numbers are kept.</li>
            <li>A camera is not a medical sensor. Treat the numbers as a rough guide.</li>
            <li>Scans are logged for Ground, but never raise alerts or change your baselines.</li>
          </ul>
          {!onContinue && <Link to="/checkin" className={buttonClass('ghost', 'sm')}>Back to check-in</Link>}
        </HudPanel>
        <HudPanel title="Recent scans" meta={history.length ? `${history.length} saved` : 'None yet'} className="sc-hist">
          {history.length === 0 ? <p className="sc-empty">Saved scans appear here.</p> : (
            <ol className="sc-list">
              {history.map((s) => (
                <li key={s.id}>
                  <span className="sc-when">{met(s.ts)}</span>
                  <span><b>{s.hr}</b> bpm</span>
                  <span>{s.hrv !== null ? <><b>{s.hrv}</b> ms</> : '—'}</span>
                  <span>{s.resp !== null ? <><b>{s.resp}</b> /min</> : '—'}</span>
                </li>
              ))}
            </ol>
          )}
          {history.length > 0 && <p className="sc-cols" aria-hidden="true"><span>Mission time</span><span>Heart</span><span>HRV</span><span>Breath</span></p>}
        </HudPanel>
      </div>

      <HudPanel className="sc-bay" hero aria-label="Face scan camera">
        <Brackets />
        <PanelHeader title="Camera // scan" meta={camera === 'error' ? 'Camera unavailable' : on ? PHASE_META[view.phase] : done ? 'Done' : 'Camera off'} />
        <div className="sc-main">
          <div className={`sc-stage ${on ? 'on' : ''} ${tone}`}>
            <video ref={videoRef} className="sc-video" playsInline muted aria-label="Camera preview, mirrored" />
            {on && <ScanOverlay verdict={view.verdict} phase={view.phase} bpm={view.live?.reliable ? view.live.bpm : null} />}
            {!on && (
              <div className="sc-idle">
                {camera === 'error' ? <CameraOff size={44} strokeWidth={1.4} aria-hidden="true" /> : <Camera size={44} strokeWidth={1.4} aria-hidden="true" />}
                <p>{camera === 'error' ? error : done ? 'Scan complete.' : 'The camera is off.'}</p>
              </div>
            )}
            {on && view.phase === 'measuring' && <div className="sc-prog" role="progressbar" aria-label="Scan progress" aria-valuemin={0} aria-valuemax={SCAN_SECONDS} aria-valuenow={Math.round(view.seconds)}><i style={{ width: `${view.progress * 100}%` }} /></div>}
          </div>

          <div className="sc-panel">
            <p id={hintId} className={`sc-hint ${on ? tone : ''}`} role="status" aria-live="polite">
              {on ? (view.phase === 'measuring' && view.verdict === 'ok' ? `Measuring ${Math.round(view.seconds)} / ${SCAN_SECONDS} s. Hold still, breathe normally.` : view.restarts > 0 && view.phase === 'aiming' ? `Signal lost, starting again. ${view.hint}` : view.hint)
                : done ? (blocked ?? 'Review the numbers, then save them to the on-board log.')
                  : camera === 'error' ? 'Fix the camera, then try again.' : notice || `Sit facing a light, about an arm's length from the camera. Then start the camera.`}
            </p>

            <Trace data={trace} />
            <Reading a={shown} wearable={wearable} />

            {done && blocked && <p className="sc-warn"><TriangleAlert size={16} aria-hidden="true" /> {blocked}</p>}
            {saveError && <p className="sc-warn" role="alert"><TriangleAlert size={16} aria-hidden="true" /> {saveError}</p>}
            {saved && (
              <p className="sc-saved" role="status">
                <span className="sc-ok" aria-hidden="true"><Check size={16} /></span>
                Saved to the on-board log. Not used for alerts. <StatusTag status="nominal" label="Saved" />
              </p>
            )}

            <div className="sc-acts">
              {!on && !done && <button type="button" className={buttonClass('primary', 'lg')} onClick={begin}>Start camera</button>}
              {on && <button type="button" className={buttonClass('ghost')} onClick={stop}>Stop camera</button>}
              {done && !blocked && !saved && <button type="button" className={buttonClass('primary', 'lg')} onClick={() => void save()} disabled={busy}>Save to log</button>}
              {done && <button type="button" className={buttonClass('ghost')} onClick={begin}>Scan again</button>}
              {onContinue && (
                <button type="button" className={buttonClass(saved || (!on && !done) ? 'primary' : 'ghost', saved ? 'lg' : 'md', 'sc-next')} onClick={() => { stop(); onContinue() }}>
                  {saved ? 'Continue to check-in' : done ? 'Skip saving, continue' : on ? 'Stop and continue' : 'Skip scan'}<ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      </HudPanel>
    </div>
  )
}
