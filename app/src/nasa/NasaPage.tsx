import '../styles/pages/nasa.css'
import { ExternalLink } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { METRICS } from '../data/types'
import { ALL_EVIDENCE } from '../engine/evidence'
import { FIVE_HAZARDS_URL, HAZARD_BASIS, RESOURCES, STANDARDS } from '../engine/nasa'
import { HazardIcon } from '../shell/icons'
import { HudPanel, PanelHeader } from '../ui/HudPanel'
import { KpiCell, KpiGrid } from '../ui/Readout'

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const
const NewTab = () => <span className="sr-only"> (opens in a new tab)</span>

/**
 * NASA Data: the NASA science the console is built on, hazard by hazard. For each of NASA's five hazards of human
 * spaceflight: what NASA says it does to the crew, what AstroDocX monitors for it, the NASA-STD-3001 limit it checks
 * (where there is one) and the NASA studies and reports cited under its alerts. Then the NASA services used.
 */
export default function NasaPage() {
  const { hash } = useLocation()
  // the board's source tags link to a hazard here (#nasa-E): bring it into view once the page has rendered
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }) }, [hash])
  const limits = new Set(Object.values(STANDARDS).map((s) => s.title)).size

  return (
    <div className="ns">
      <HudPanel hero className="ns-head" aria-labelledby="ns-title">
        <div className="ns-intro">
          <PanelHeader title="NASA Space Apps Challenge 2026" />
          <h1 className="ns-h1" id="ns-title">Built on NASA science</h1>
          <p className="ns-lede">
            AstroDocX is organised around NASA’s <a href={FIVE_HAZARDS_URL} {...ext}>five hazards of human spaceflight<NewTab /></a>.
            Every alert checks the crew against NASA-STD-3001 limits or the person’s own baseline, and cites NASA open data for what the change can mean.
          </p>
          <p className="ns-note">An independent Space Apps project using NASA open data. Not affiliated with or endorsed by NASA. Nothing here diagnoses.</p>
        </div>
        <KpiGrid>
          <KpiCell label="NASA hazards" value="5" />
          <KpiCell label="NASA studies & reports" value={ALL_EVIDENCE.length} />
          <KpiCell label="NASA-STD-3001 limits" value={limits} />
          <KpiCell label="NASA services" value={RESOURCES.length} />
        </KpiGrid>
      </HudPanel>

      <section className="ns-hazards" aria-label="NASA basis by hazard">
        {HAZARD_BASIS.map((h) => (
          <HudPanel key={h.id} as="article" id={`nasa-${h.id}`} className="ns-hz" aria-labelledby={`nasa-${h.id}-t`}>
            <header className="ns-hz-head">
              <HazardIcon hazard={h.id} />
              <div>
                <p className="ns-eb">RIDGE {h.id} · NASA hazard</p>
                <h2 id={`nasa-${h.id}-t`}>{h.nasaName}</h2>
              </div>
            </header>
            <p className="ns-risk">{h.risk}</p>

            <h3 className="ns-k">AstroDocX monitors</h3>
            <ul className="ns-metrics">{h.metrics.map((m) => <li key={m}>{METRICS[m].label}</li>)}</ul>
            <p className="ns-resp">{h.response}</p>

            {h.standards.length > 0 && <>
              <h3 className="ns-k">NASA limit</h3>
              <ul className="ns-list">
                {h.standards.map((s) => (
                  <li key={s.title} className="ns-std">
                    <a href={s.url} {...ext}>{s.title}<NewTab /></a>
                    <b>{s.value}</b>
                    <span>{s.use}</span>
                  </li>
                ))}
              </ul>
            </>}

            <h3 className="ns-k">NASA evidence</h3>
            {h.evidence.length > 0 ? (
              <ul className="ns-list">
                {h.evidence.map((e) => (
                  <li key={e.url} className="ns-ev">
                    <span className="ns-src">{e.source.replace('NASA ', '')}</span>
                    <a href={e.url} {...ext}>{e.title}<NewTab /></a>
                    <span>{e.id}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ns-none">No study cited: the response follows from NASA’s description of the hazard.</p>
            )}
          </HudPanel>
        ))}
      </section>

      <HudPanel className="ns-res" title="NASA open data and services used">
        <ul className="ns-res-list">
          {RESOURCES.map((r) => (
            <li key={r.url}>
              <a href={r.url} {...ext}>{r.name}<ExternalLink size={13} aria-hidden="true" /><NewTab /></a>
              <span>{r.what}</span>
            </li>
          ))}
        </ul>
      </HudPanel>
    </div>
  )
}
