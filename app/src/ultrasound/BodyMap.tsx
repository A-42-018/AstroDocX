import { EXAMS, type ExamId } from './exams'

/** A plain front view of a body with the five probe sites; the active one pulses. Decorative: the picker names the exam. */
export function BodyMap({ active, onPick }: { active: ExamId; onPick: (id: ExamId) => void }) {
  return (
    <svg className="us-body" viewBox="0 0 100 200" role="group" aria-label="Probe sites on the body">
      <g className="us-fig" fill="none" strokeLinejoin="round" strokeLinecap="round">
        <circle cx="50" cy="17" r="11" />
        <path d="M44 28 v8 M56 28 v8" />
        <path d="M30 40 q20 -8 40 0 q8 3 9 14 l5 44 M30 40 q-8 3 -9 14 l-5 44" />
        <path d="M30 40 l2 62 q18 8 36 0 l2 -62" />
        <path d="M33 102 l-3 90 M45 106 l1 86 M67 102 l3 90 M55 106 l-1 86" />
      </g>
      {EXAMS.map((e) => (
        <g key={e.id} transform={`translate(${e.site.x} ${e.site.y})`}>
          <title>{e.label}</title>
          {active === e.id && <circle className="us-ping" r="6" />}
          <circle className={active === e.id ? 'us-site on' : 'us-site'} r="3.4" onClick={() => onPick(e.id)} />
        </g>
      ))}
    </svg>
  )
}
