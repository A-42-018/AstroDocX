import { HudPanel } from '../ui/HudPanel'
import { EXCLUDED, FETCHED, I4_STUDIES, USED_TABLES, osdUrl } from './i4'

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const
const NewTab = () => <span className="sr-only"> (opens in a new tab)</span>

/**
 * Every NASA dataset behind the Real crew data panel, in one list: the three source tables drawn on this screen, then all ten
 * public Inspiration4 records in OSDR with how each one is used (as data, or cited only).
 */
export function I4Datasets() {
  const used = new Set(USED_TABLES.map((t) => t.osd))
  return (
    <HudPanel className="i4d" title="NASA datasets used" meta={`SpaceX Inspiration4 · OSDR · fetched ${FETCHED}`} id="nasa-datasets">
      <p className="i4-lede">
        Two of the ten Inspiration4 records are used as data (three source tables). The other eight are listed so the whole set is on one page; they hold
        sequencing, microbiome and similar omics files that this console does not draw.
      </p>

      <h3 className="ns-k">Used as data on this screen</h3>
      <ul className="ns-list i4d-list">
        {USED_TABLES.map((t) => (
          <li key={t.file} className="i4d-used">
            <span className="i4d-tag on">Used as data</span>
            <a href={osdUrl(t.osd)} {...ext}>{t.osd} · {I4_STUDIES.find((s) => s.osd === t.osd)?.title}<NewTab /></a>
            <span><code>{t.file}</code></span>
            <span>{t.markers.join(' · ')} · {t.values} values (4 crew × 7 timepoints{EXCLUDED.some((e) => e.panel === 'cbc') && t.file.includes('Blood_Count') ? ', one corrupt draw left out' : ''})</span>
          </li>
        ))}
      </ul>

      <h3 className="ns-k">All ten Inspiration4 records in OSDR</h3>
      <ul className="ns-list i4d-list">
        {I4_STUDIES.map((s) => (
          <li key={s.osd}>
            <span className={`i4d-tag ${used.has(s.osd) ? 'on' : ''}`}>{used.has(s.osd) ? 'Used as data' : 'Cited only'}</span>
            <a href={osdUrl(s.osd)} {...ext}>{s.osd} · {s.title}<NewTab /></a>
            <span>{s.what}</span>
          </li>
        ))}
      </ul>
    </HudPanel>
  )
}
