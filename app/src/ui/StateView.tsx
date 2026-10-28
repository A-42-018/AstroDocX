import type { ReactNode } from 'react'

type Props =
  | { kind: 'loading'; label: string; /** 0–100, the real progress when there is one */ progress?: number }
  | { kind: 'empty'; label: ReactNode; action?: ReactNode }
  | { kind: 'error'; title: string; children?: ReactNode; actions?: ReactNode }

/**
 * Loading, empty and error states (plan §4.8), in place of plain glass paragraphs.
 * Loading is a polite status with a scan bar; error is an Act-tone panel announced as an alert.
 */
export function StateView(props: Props) {
  if (props.kind === 'loading') {
    const pct = props.progress === undefined ? undefined : Math.max(0, Math.min(100, Math.round(props.progress)))
    return (
      <div className="hp state-view state-loading" role="status">
        <p className="state-label">{props.label}{pct !== undefined && <> · <span className="state-pct">{pct}%</span></>}…</p>
        <div className={`scanbar${pct === undefined ? ' indeterminate' : ''}`} aria-hidden="true">
          <span style={pct === undefined ? undefined : { width: `${pct}%` }} />
        </div>
      </div>
    )
  }
  if (props.kind === 'empty') {
    return (
      <div className="state-view state-empty">
        <span className="state-diamond" aria-hidden="true" />
        <p>{props.label}</p>
        {props.action}
      </div>
    )
  }
  return (
    <section className="hp tone-act state-view state-error" role="alert">
      <h1 className="state-title">{props.title}</h1>
      {props.children}
      {props.actions && <div className="state-actions">{props.actions}</div>}
    </section>
  )
}
