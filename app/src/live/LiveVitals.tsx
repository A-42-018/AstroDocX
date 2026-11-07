import { HeartPulse } from 'lucide-react'
import { liveQuery } from 'dexie'
import { useEffect, useRef, useState } from 'react'
import { db } from '../data/db'
import { NORMAL } from '../data/synthetic'
import { WatchControl } from '../watch/WatchControl'
import { PanelHeader } from '../ui/HudPanel'
import { LiveNumber } from './LiveNumber'
import { LiveWave } from './LiveWave'
import { respRate } from './telemetry'
import { emitBeat } from './heartbeat'
import type { LiveTelemetry } from './useLiveTelemetry'

type Baselines = { hr: number | null; spo2: number | null }

/** This person's own baseline means for the two metrics shown, kept up to date with the database. */
function useBaselines(crewId: string): Baselines {
  const [b, setB] = useState<Baselines>({ hr: null, spo2: null })
  useEffect(() => {
    const sub = liveQuery(async () => ({
      hr: (await db.baselines.get([crewId, 'hr']))?.mean ?? null,
      spo2: (await db.baselines.get([crewId, 'spo2']))?.mean ?? null,
    })).subscribe({ next: setB, error: () => setB({ hr: null, spo2: null }) })
    return () => sub.unsubscribe()
  }, [crewId])
  return b
}

const SIM_TITLE = 'Simulated signal, built around the latest real reading'
const WATCH_TITLE = 'Read from the connected Bluetooth watch. Shown only: not saved and not used for alerts'
const base = (v: number | null, unit: string) => (v === null ? null : unit === '%' ? v.toFixed(1) : String(Math.round(v)))

/**
 * Live vitals (mockup 1, right column): a heart-rate instrument with a 60 px readout, a heart that beats with
 * the ECG and the delta against this person's baseline, then SpO₂ and breathing tiles with their traces.
 * Simulated around the latest real reading, and labelled SIM.
 */
export function LiveVitals({ crewId, telemetry, showWatch = true }: { crewId: string; telemetry: LiveTelemetry; showWatch?: boolean }) {
  const { targets, values, seed, source } = telemetry
  const b = useBaselines(crewId)
  const heart = useRef<HTMLSpanElement>(null)
  const beat = () => {
    emitBeat()
    heart.current?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.25)', offset: 0.12 }, { transform: 'scale(1)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 600, easing: 'ease-out' })
  }
  const delta = b.hr === null ? null : Math.round(targets.hr - b.hr)
  const respBase = respRate(NORMAL.co2.mean)

  // Screen readers get a short summary at most every 30 s, never the moving numbers.
  const [summary, setSummary] = useState('')
  const latest = useRef(values)
  useEffect(() => { latest.current = values })
  useEffect(() => {
    const say = () => setSummary(`Heart rate ${Math.round(latest.current.hr)} beats per minute, oxygen ${latest.current.spo2.toFixed(0)} percent, breathing ${Math.round(latest.current.resp)} per minute. ${source.hr === 'watch' ? 'Heart rate is from the connected watch.' : 'Simulated live telemetry.'}`)
    say()
    const id = setInterval(say, 30_000)
    return () => clearInterval(id)
  }, [crewId, source.hr])

  return (
    <section className="vitals" aria-label="Live vitals">
      <p className="sr-only" role="status" aria-live="polite">{summary}</p>
      <article className="hp vt vt-hr">
        <PanelHeader title="Heart rate" meta={<span title={source.hr === 'watch' ? WATCH_TITLE : SIM_TITLE}>{source.hr === 'watch' ? 'Watch' : 'Sim'}{b.hr !== null && ` · base ${base(b.hr, 'bpm')}`}</span>} />
        {showWatch && <WatchControl />}
        <div className="vt-hr-row">
          <b className="vt-big"><LiveNumber value={values.hr} /></b>
          <span className="vt-side">
            <span ref={heart} className="vt-heart" aria-hidden="true"><HeartPulse size={24} strokeWidth={1.9} /></span>
            <span className="vt-unit">bpm</span>
            {delta !== null && <span className="vt-delta">{delta > 0 ? '+' : delta < 0 ? '−' : '±'}{Math.abs(delta)} vs base</span>}
          </span>
        </div>
        <LiveWave kind="ecg" rate={targets.hr} variability={Math.min(0.08, (targets.hrv / (60000 / targets.hr)) * 0.5)} seed={seed} onBeat={beat} height={48} />
      </article>
      <div className="vt-duo">
        <article className="hp vt vt-mini">
          <PanelHeader title="SpO₂" meta={<span title={source.spo2 === 'watch' ? WATCH_TITLE : SIM_TITLE}>{source.spo2 === 'watch' ? 'Watch' : 'Sim'}</span>} />
          <p className="vt-read"><b className="vt-big"><LiveNumber value={values.spo2} decimals={1} /></b><span className="vt-unit">%</span></p>
          {b.spo2 !== null && <p className="vt-base">Base {base(b.spo2, '%')}</p>}
          <LiveWave kind="pleth" rate={targets.hr} variability={0.02} seed={seed + 1} height={28} />
        </article>
        <article className="hp vt vt-mini">
          <PanelHeader title="Resp" meta={<span title={SIM_TITLE}>Sim</span>} />
          <p className="vt-read"><b className="vt-big"><LiveNumber value={values.resp} /></b><span className="vt-unit">/min</span></p>
          <p className="vt-base">Base {base(respBase, '/min')}</p>
          <LiveWave kind="resp" rate={values.resp} variability={0.05} seed={seed + 2} height={28} />
        </article>
      </div>
    </section>
  )
}
