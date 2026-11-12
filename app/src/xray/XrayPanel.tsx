/**
 * The settings drawer: layers, look, mixed reality, fit to the head and tracking. It slides in from the right (a bottom
 * sheet on phones) and only edits the settings; XrayPage hands them to the scene and saves them.
 */
import { Crosshair, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import {
  alignMode, DEFAULT_FIT, FIT_RANGE, PRESETS, REVEALS, type Fit, type Layer, type Reveal, type XraySettings,
} from './settings'

/** Each layer's checkbox, with a dot in the colour that tissue is drawn in. */
const LAYER_LABELS: { id: Layer; label: string; dot: string }[] = [
  { id: 'skull', label: 'Skull', dot: '#cfeaf5' }, { id: 'brain', label: 'Brain', dot: '#e88fc0' },
  { id: 'muscles', label: 'Muscles', dot: '#ff5a74' }, { id: 'eyes', label: 'Eyes', dot: '#8fe8f5' },
  { id: 'outline', label: 'Head outline', dot: '#7fe3ff' }, { id: 'hands', label: 'Hand bones', dot: '#e6f4fa' },
]

const pct = (v: number) => `${Math.round(v * 100)}%`
const cm = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} cm`

function Range({ label, value, min, max, step, fmt, onChange }: {
  label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <label className="xp-range">
      <span>{label}</span>
      <output>{fmt(value)}</output>
      <input type="range" min={min} max={max} step={step} value={value} aria-valuetext={fmt(value)} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function Check({ label, checked, dot, onChange }: { label: string; checked: boolean; dot?: string; onChange: (v: boolean) => void }) {
  return (
    <label className="xp-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {dot && <i className="xp-dot" style={{ background: dot }} aria-hidden="true" />}
      <span>{label}</span>
    </label>
  )
}

function Section({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="xp-sec" open={open}>
      <summary>{title}</summary>
      <div className="xp-body">{children}</div>
    </details>
  )
}

export default function XrayPanel({ settings: s, onChange, onClose }: { settings: XraySettings; onChange: (next: XraySettings) => void; onClose: () => void }) {
  const root = useRef<HTMLElement>(null)
  const set = (patch: Partial<XraySettings>) => onChange({ ...s, ...patch })
  const setFit = (patch: Partial<Fit>) => onChange({ ...s, fit: { ...s.fit, ...patch } })
  const { scale, shift } = FIT_RANGE

  // focus moves into the drawer when it opens and Tab stays inside it
  useEffect(() => {
    const el = root.current
    el?.querySelector<HTMLElement>('button')?.focus()
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return
      const f = [...el.querySelectorAll<HTMLElement>('button, input, select, summary')].filter((x) => !x.hasAttribute('disabled'))
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    el?.addEventListener('keydown', trap)
    return () => el?.removeEventListener('keydown', trap)
  }, [])

  return (
    <aside ref={root} className="xp" role="dialog" aria-label="X-ray settings">
      <header className="xp-head">
        <b>Settings</b>
        <button type="button" className="xr-icon" onClick={onClose} aria-label="Close the settings" title="Close"><X size={18} aria-hidden="true" /></button>
      </header>

      <Section title="Layers" open>
        <div className="xp-presets" role="group" aria-label="Presets">
          {PRESETS.map((p) => <button key={p.id} type="button" className="xp-preset" onClick={() => set({ layers: p.layers })}>{p.label}</button>)}
        </div>
        <div className="xp-checks" role="group" aria-label="Layers">
          {LAYER_LABELS.map(({ id, label, dot }) => (
            <Check key={id} label={label} dot={dot} checked={s.layers[id]} onChange={(v) => set({ layers: { ...s.layers, [id]: v } })} />
          ))}
        </div>
        <Check label="Show labels" checked={s.labels} onChange={(labels) => set({ labels })} />
      </Section>

      <Section title="Look" open>
        <div className="xp-seg" role="group" aria-label="Look">
          <button type="button" aria-pressed={s.look === 'xray'} onClick={() => set({ look: 'xray' })}>X-ray</button>
          <button type="button" aria-pressed={s.look === 'solid'} onClick={() => set({ look: 'solid' })}>Solid</button>
        </div>
        <Range label="X-ray strength" value={s.strength} min={0.15} max={1} step={0.05} fmt={pct} onChange={(strength) => set({ strength })} />
        <Range label="Brightness" value={s.brightness} min={0.3} max={1.5} step={0.05} fmt={pct} onChange={(brightness) => set({ brightness })} />
      </Section>

      <Section title="Mixed reality" open>
        <Range label="Real me showing through" value={s.realThrough} min={0} max={1} step={0.05} fmt={pct} onChange={(realThrough) => set({ realThrough })} />
        <Range label="Edge feather" value={s.feather} min={0} max={1} step={0.05} fmt={pct} onChange={(feather) => set({ feather })} />
        <label className="xp-select">
          <span>Reveal</span>
          <select value={s.reveal} onChange={(e) => set({ reveal: e.target.value as Reveal })}>
            {REVEALS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        <Range label="Lens size" value={s.lensSize} min={0.05} max={0.45} step={0.01} fmt={pct} onChange={(lensSize) => set({ lensSize })} />
        {s.reveal === 'lens' && <p className="xp-tip">Raise a hand: the lens follows your index fingertip.</p>}
      </Section>

      <Section title="Fit to my head" open>
        <div className="xp-chips">
          <button type="button" className="xr-ghost sm" onClick={() => onChange(alignMode(s))}><Crosshair size={14} aria-hidden="true" />Line it up</button>
          <button type="button" className="xr-ghost sm" onClick={() => setFit(DEFAULT_FIT)}><RotateCcw size={14} aria-hidden="true" />Reset fit</button>
        </div>
        <Range label="Overall size" value={s.fit.size} {...scale} fmt={pct} onChange={(size) => setFit({ size })} />
        <Range label="Width" value={s.fit.width} {...scale} fmt={pct} onChange={(width) => setFit({ width })} />
        <Range label="Height" value={s.fit.height} {...scale} fmt={pct} onChange={(height) => setFit({ height })} />
        <Range label="Depth" value={s.fit.depth} {...scale} fmt={pct} onChange={(depth) => setFit({ depth })} />
        <Range label="Left / right" value={s.fit.dx} {...shift} fmt={cm} onChange={(dx) => setFit({ dx })} />
        <Range label="Up / down" value={s.fit.dy} {...shift} fmt={cm} onChange={(dy) => setFit({ dy })} />
        <Range label="Forward / back" value={s.fit.dz} {...shift} fmt={cm} onChange={(dz) => setFit({ dz })} />
        <p className="xp-tip">Tip: pick the Solid look and set “Real me showing through” to about half, then line the skull up with your face. “Line it up” does that for you.</p>
      </Section>

      <Section title="Tracking">
        <Check label="Show tracking data" checked={s.dots} onChange={(dots) => set({ dots })} />
      </Section>

      <p className="xp-note">
        The anatomy is a real 3D dataset of one adult, scaled and pinned to your head. It shows where structures typically sit, not a
        scan of you, and it is not a medical tool. Video is processed on this computer and never uploaded.
      </p>
    </aside>
  )
}
