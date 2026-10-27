import { useId, type HTMLAttributes, type ReactNode } from 'react'
import type { Status } from '../data/types'

export type PanelTone = Status | 'data'

/** Panel tab header: diamond, mono caps title (the panel's heading), a fading rule and right-aligned meta. */
export function PanelHeader({ title, meta, id, level = 2 }: { title: ReactNode; meta?: ReactNode; id?: string; level?: 1 | 2 | 3 }) {
  const H = `h${level}` as const
  return (
    <header className="ph">
      <span className="ph-dot" aria-hidden="true" />
      <H id={id} className="ph-title">{title}</H>
      <span className="ph-rule" aria-hidden="true" />
      {meta !== undefined && <span className="ph-meta">{meta}</span>}
    </header>
  )
}

/** Four L-shaped glowing corners for hero bays. Decorative. */
export function Brackets() {
  return (
    <>
      <span className="br br-tl" aria-hidden="true" />
      <span className="br br-tr" aria-hidden="true" />
      <span className="br br-bl" aria-hidden="true" />
      <span className="br br-br" aria-hidden="true" />
    </>
  )
}

/** Vertical tick ruler beside a hero bay. Decorative. */
export function Ruler({ side }: { side: 'l' | 'r' }) {
  return <span className={`ruler ruler-${side}`} aria-hidden="true" />
}

type PanelProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** Header title; it becomes the panel's heading and accessible name. Omit it and pass `aria-label` instead. */
  title?: ReactNode
  meta?: ReactNode
  /** Status lights the panel itself: an Act panel gets a red edge and tint. Nominal and data keep the cyan edge. */
  tone?: PanelTone
  /** Hero bays add corner brackets and side rulers. */
  hero?: boolean
  /** No chamfer: a plain 1px edge, for panels nested inside panels. */
  flat?: boolean
  as?: 'section' | 'article' | 'div' | 'li' | 'aside'
  level?: 1 | 2 | 3
  children?: ReactNode
}

/**
 * Chamfered HUD panel (plan §3.5). The outer box is the edge gradient and `::before`, 1px in, is the fill;
 * clip-path cuts the corners, so focus rings inside are drawn inset (styles/components/hud-panel.css).
 */
export function HudPanel({ title, meta, tone, hero, flat, as: Tag = 'section', level = 2, className, children, ...rest }: PanelProps) {
  const id = useId()
  const cls = ['hp', tone && tone !== 'nominal' && tone !== 'data' ? `tone-${tone}` : '', hero ? 'hp-hero' : '', flat ? 'hp-flat' : '', className ?? '']
    .filter(Boolean).join(' ')
  const labelled = title !== undefined && rest['aria-label'] === undefined && rest['aria-labelledby'] === undefined
  return (
    <Tag className={cls} aria-labelledby={labelled ? id : undefined} {...rest}>
      {hero && <><Brackets /><Ruler side="l" /><Ruler side="r" /></>}
      {title !== undefined && <PanelHeader id={id} title={title} meta={meta} level={level} />}
      {children}
    </Tag>
  )
}
