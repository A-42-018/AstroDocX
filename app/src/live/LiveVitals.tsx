import { Activity, HeartPulse, Wind } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LiveNumber } from './LiveNumber'
import { LiveWave } from './LiveWave'
import { useLiveTelemetry } from './useLiveTelemetry'

/** Live vitals strip: ECG at the real heart rate, pleth at the real SpO₂, breathing. Simulated, and labelled as such. */
export function LiveVitals({ crewId }: { crewId: string }) {
  const { targets, values, seed } = useLiveTelemetry(crewId)
  const pulse = useRef<HTMLSpanElement>(null)
  const beat = () => pulse.current?.animate([{ transform: 'scale(1)', opacity: 0.7 }, { transform: 'scale(1.9)', opacity: 0 }], { duration: 600, easing: 'ease-out' })

  // Screen readers get a short summary at most every 30 s, never the moving numbers.
  const [summary, setSummary] = useState('')
  const latest = useRef(values)
  useEffect(() => { latest.current = values })
  useEffect(() => {
    const say = () => setSummary(`Heart rate ${Math.round(latest.current.hr)} beats per minute, oxygen ${latest.current.spo2.toFixed(0)} percent, breathing ${Math.round(latest.current.resp)} per minute. Simulated live telemetry.`)
    say()
    const id = setInterval(say, 30_000)
    return () => clearInterval(id)
  }, [crewId])

  return (
    <section className="vitals" aria-label="Live vitals">
      <p className="sr-only" role="status" aria-live="polite">{summary}</p>
      <article className="glass vital">
        <header>
          <span className="vital-icon"><span ref={pulse} className="pulse-ring" aria-hidden="true" /><HeartPulse size={18} aria-hidden="true" /></span>
          <h2>Heart rate</h2>
        </header>
        <p className="val"><b><LiveNumber value={values.hr} /></b> <small>bpm</small></p>
        <LiveWave kind="ecg" rate={targets.hr} variability={Math.min(0.08, (targets.hrv / (60000 / targets.hr)) * 0.5)} seed={seed} onBeat={beat} />
      </article>
      <article className="glass vital">
        <header><span className="vital-icon"><Activity size={18} aria-hidden="true" /></span><h2>Oxygen (SpO₂)</h2></header>
        <p className="val"><b><LiveNumber value={values.spo2} decimals={1} /></b> <small>%</small></p>
        <LiveWave kind="pleth" rate={targets.hr} variability={0.02} seed={seed + 1} />
      </article>
      <article className="glass vital">
        <header><span className="vital-icon"><Wind size={18} aria-hidden="true" /></span><h2>Breathing</h2></header>
        <p className="val"><b><LiveNumber value={values.resp} /></b> <small>/min</small></p>
        <LiveWave kind="resp" rate={values.resp} variability={0.05} seed={seed + 2} />
      </article>
      <p className="vitals-note muted">Simulated live telemetry, built around the latest real readings. It does not change alerts.</p>
    </section>
  )
}
