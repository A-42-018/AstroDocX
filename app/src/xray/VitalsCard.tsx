import { Activity, Check, RotateCcw, Save } from 'lucide-react'
import { SCAN_SECONDS } from '../scan/rppg'
import type { SessionView } from '../scan/session'
import { whyNot } from '../scan/store'

/** Where a finished reading is kept: `onSave` is missing when the console data is not ready. */
export interface SaveState { onSave?: () => void; busy: boolean; saved: boolean; error: string }

/** A short SVG line of the last seconds of the pulse. */
function Trace({ data }: { data: Float64Array }) {
  if (data.length < 8) return null
  const step = Math.ceil(data.length / 120)
  let max = 1e-9
  for (let i = 0; i < data.length; i += step) max = Math.max(max, Math.abs(data[i]))
  const pts: string[] = []
  for (let i = 0, x = 0; i < data.length; i += step, x++) pts.push(`${x},${(10 - (data[i] / max) * 9).toFixed(1)}`)
  return <svg className="xr-trace" viewBox={`0 0 ${pts.length - 1} 20`} preserveAspectRatio="none" aria-hidden="true"><polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>
}

/** The camera-pulse readout over the mirror: heart rate, HRV and breathing, with the hint while the signal settles. */
export function VitalsCard({ view, onAgain, save }: { view: SessionView; onAgain: () => void; save: SaveState }) {
  const r = view.final ?? view.live
  const shown = r?.reliable ? r : null
  const measuring = view.phase === 'measuring'
  const blocked = view.final ? whyNot(view.final) : null
  const left = Math.max(0, Math.ceil(SCAN_SECONDS - view.seconds))
  return (
    <section className="xr-vitals" aria-label="Vital signs from the camera">
      <h2><Activity size={14} aria-hidden="true" />Vitals <span>camera pulse</span></h2>
      <dl>
        <div><dt>Heart rate</dt><dd>{shown?.bpm ? <>{Math.round(shown.bpm)}<small> bpm</small></> : '--'}</dd></div>
        <div><dt>HRV</dt><dd>{shown?.hrv != null ? <>{Math.round(shown.hrv)}<small> ms</small></> : '--'}</dd></div>
        <div><dt>Breathing</dt><dd>{shown?.resp != null ? <>{Math.round(shown.resp)}<small> /min</small></> : '--'}</dd></div>
      </dl>
      <Trace data={view.trace} />
      {view.phase === 'done' ? (
        <p className="xr-vnote">Done. {view.final?.reliable ? 'Estimate from 30 s of clean video.' : 'The signal was too weak for a reliable reading.'}
          {blocked && <span role="status">{blocked}</span>}
          {save.error && <span role="alert">{save.error}</span>}
          <span className="xr-vrow">
            {!blocked && (save.saved
              ? <span className="xr-saved"><Check size={14} aria-hidden="true" />Saved to Face Scan</span>
              : <button type="button" className="xr-go sm" disabled={!save.onSave || save.busy} onClick={save.onSave}><Save size={14} aria-hidden="true" />{save.busy ? 'Saving…' : 'Save reading'}</button>)}
            <button type="button" className="xr-ghost sm" onClick={onAgain}><RotateCcw size={14} aria-hidden="true" />Measure again</button>
          </span></p>
      ) : measuring ? (
        <>
          <div className="xr-vbar" role="progressbar" aria-label="Measuring" aria-valuemin={0} aria-valuemax={SCAN_SECONDS} aria-valuenow={Math.round(view.seconds)}><i style={{ width: `${view.progress * 100}%` }} /></div>
          <p className="xr-vnote">Hold still, about {left} s left{view.verdict !== 'ok' ? `. ${view.hint}` : '.'}</p>
        </>
      ) : <p className="xr-vnote">{view.hint}</p>}
      <p className="xr-vfine">Not a medical measurement.</p>
    </section>
  )
}
