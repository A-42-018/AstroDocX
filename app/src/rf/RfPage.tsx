import '../styles/pages/rf.css'
import { ArrowRight, Radio, Router, User, Wifi } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import { hashSeed, loadTargets, respRate } from '../live/telemetry'
import { useReducedMotion } from '../live/usePaused'
import { HudPanel, KpiCell, KpiGrid, Readout, Segmented, StatusTag, buttonClass } from '../ui'
import { StateView } from '../ui/StateView'
import { CSI_HZ, SITUATIONS, type Situation } from './csi'
import { RfFeed, type Recommendation } from './feed'
import { MIN_S } from './dsp'
import { RfScope } from './RfScope'

const fmt = (n: number | null | undefined, dec = 0) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(dec))

const PIPELINE = [
  { icon: Router, title: 'Cabin Wi-Fi', text: 'Transmits as usual' },
  { icon: User, title: 'Crew member', text: 'Chest moves ~5 mm per breath' },
  { icon: Wifi, title: 'CSI receiver', text: '52 subcarriers, 2 antennas, 20 Hz' },
  { icon: Radio, title: 'DSP', text: 'Ratio, filter, merge, spectrum' },
]

const CHALLENGES = [
  ['Floating orientation', 'A body that turns in microgravity changes every reflection, so the signal path keeps moving.'],
  ['Metal cabin', 'Racks and walls create strong multipath; the static part of the channel is much larger than the breath.'],
  ['More than one person', 'A crewmate passing swamps the breathing band. The estimator holds back instead of guessing.'],
  ['Changed baselines', 'Breathing mechanics differ in microgravity, so earth-trained thresholds need in-flight calibration.'],
]

export default function RfPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  if (boot.state === 'error') return <StateView kind="error" title="Could not open the local database"><p>{boot.error}</p></StateView>
  if (boot.state !== 'ready' || snap === undefined) {
    const pct = boot.state === 'seeding' && boot.total > 0 ? (boot.done / boot.total) * 100 : undefined
    return <StateView kind="loading" label="Initializing demo mission data" progress={pct} />
  }
  if (snap === null) return <StateView kind="empty" label="No crew data yet." />
  return <RfView key={snap.crewId} crewId={snap.crewId} name={snap.crew.find((c) => c.id === snap.crewId)?.name ?? ''} />
}

function RfView({ crewId, name }: { crewId: string; name: string }) {
  const reduced = useReducedMotion()
  const [situation, setSituation] = useState<Situation>('calm')
  const [engine, setEngine] = useState<{ resp: number; hr: number } | null>(null)
  const feed = useMemo(() => {
    const f = new RfFeed(hashSeed(crewId))
    f.prefill(32)
    return f
  }, [crewId])
  const [, bump] = useState(0)
  const [version, setVersion] = useState(0)

  // the simulated breath follows the console's own reading for this crew member, so the screens agree
  useEffect(() => {
    let live = true
    void loadTargets(crewId).then((t) => {
      if (!live) return
      setEngine({ resp: respRate(t.co2), hr: t.hr })
      feed.sim.baseRate = respRate(t.co2)
      feed.sim.heartRate = t.hr
    }, () => {})
    return () => { live = false }
  }, [crewId, feed])

  const pick = (s: Situation) => {
    setSituation(s)
    feed.setSituation(s)
    // a still page cannot animate toward the new situation, so jump ahead until the estimator has caught up
    if (reduced) feed.prefill(34)
    setVersion((v) => v + 1)
    bump((n) => n + 1)
  }

  const e = feed.estimateNow
  const rec: Recommendation | null = feed.recommendation
  const sit = SITUATIONS.find((s) => s.id === situation)!
  const ok = e?.breathsPerMin != null
  const conf = Math.round((e?.confidence ?? 0) * 100)

  return (
    <div className="rf">
      <HudPanel title="Wi-Fi sensing" meta="Simulated · experimental" hero className="rf-head">
        <p className="rf-eb">Contactless monitoring · {name}</p>
        <h1 className="rf-h1">Breathing from the cabin Wi-Fi</h1>
        <p className="rf-intro">
          Breathing moves the chest a few millimetres, which changes how Wi-Fi signals bounce through the room. A receiver that records those changes
          (Channel State Information, CSI) can read breathing, movement and sleep with nothing worn. The signal below is <b>simulated</b> from a physical
          model with real-world mess added: random phase offsets, noise, and a static room far stronger than the breath.
        </p>
        <ul className="rf-flow" aria-label="Signal path">
          {PIPELINE.map(({ icon: I, title, text }) => (
            <li key={title}><I size={18} aria-hidden="true" /><b>{title}</b><span>{text}</span></li>
          ))}
        </ul>
      </HudPanel>

      <HudPanel title="Live channel" meta={e ? `${secondsOf(feed)} s window` : 'Starting'} className="rf-live">
        <Segmented label="Situation" options={SITUATIONS.map((s) => ({ id: s.id, label: s.label }))} value={situation} onChange={pick} className="rf-seg" />
        <p className="rf-blurb">{sit.blurb}</p>
        <RfScope feed={feed} version={version} onEstimate={() => bump((n) => n + 1)} />
      </HudPanel>

      <HudPanel title="What the DSP concludes" meta={ok ? 'Rate found' : 'No rate'} className="rf-read" tone={rec ? 'watch' : undefined}>
        <Readout size="hero" value={fmt(e?.breathsPerMin)} unit="breaths/min" meta={e?.reason ?? `Collecting signal (needs ${MIN_S} s)`} />
        <div className="rf-meter" role="meter" aria-label="Confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={conf}>
          <span style={{ width: `${conf}%` }} />
          <em>Confidence {conf}%</em>
        </div>
        <KpiGrid>
          <KpiCell label="Presence" value={e?.presence ? 'Yes' : 'No'} />
          <KpiCell label="Movement" value={e ? fmt(e.motion * 100) : '—'} sub={e?.disturbance === 'people' ? 'others near' : e?.disturbance === 'drift' ? 'drifting' : undefined} />
          <KpiCell label="Breath pause" value={feed.apneaShown ? 'Yes' : 'No'} status={feed.apneaShown ? 'watch' : undefined} />
          <KpiCell label="Console reading" value={engine ? fmt(engine.resp) : '—'} sub="/min" />
          <KpiCell label="Heart rate" value="—" sub="needs watch" />
        </KpiGrid>
        <p className="rf-note">Wi-Fi alone cannot resolve a heartbeat reliably: it moves the chest ten times less than a breath. Heart rate comes from the watch or the face scan.</p>
        {rec && (
          <div className="rf-rec" role="status">
            <StatusTag status="watch" label="Suggestion" />
            <p>{rec.text}</p>
            <Link to={`/ultrasound?exam=${rec.exam}&from=rf`} className={buttonClass('primary', 'sm')}>Start {rec.exam} scan <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        )}
      </HudPanel>

      <HudPanel title="Why microgravity is hard" meta="Open research" className="rf-hard">
        <dl className="rf-challenges">
          {CHALLENGES.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
        </dl>
        <p className="rf-note">
          Prototype path: an ESP32 or Raspberry Pi that exposes CSI could replace the simulator, feeding the same <code>estimate()</code> function.
          Real use needs testing in parabolic flight and on orbit. Never raises alerts and never changes baselines.
        </p>
        <p className="rf-note">Background: <a href="https://www.nist.gov/publications/monitoring-respiratory-motion-wi-fi-csi-characterizing-performance-and-breathsmart" target="_blank" rel="noopener noreferrer">NIST, respiratory motion from Wi-Fi CSI<span className="sr-only"> (opens in a new tab)</span></a></p>
      </HudPanel>
    </div>
  )
}

const secondsOf = (feed: RfFeed) => Math.min(30, Math.round(feed.frames.length / CSI_HZ))
