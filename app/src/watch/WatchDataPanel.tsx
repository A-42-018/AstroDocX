import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../data/db'
import { Button } from '../ui/Button'
import {
  deleteWearableData,
  downloadWearablesCsv,
  downloadWearablesJson,
  exportWearablesCsv,
  exportWearablesJson,
  loadAllWearables,
  loadWearableSummary,
  type WearableSummary,
} from './history'
import { useWatch } from './store'

const SUMMARY_DEBOUNCE_MS = 2000

/**
 * Watch data housekeeping, kept off the live heart-rate card: the opt-in to save watch readings on this device, which
 * crew member the saved data belongs to, a coverage summary, export and delete. Lives on the Trends page with the
 * wearable insights the saved data feeds. `crewId` is the crew member selected there; turning saving on links the
 * watch to them.
 */
export function WatchDataPanel({ crewId }: { crewId?: string }) {
  const saveOptIn = useWatch((s) => s.saveOptIn)
  const setSaveOptIn = useWatch((s) => s.setSaveOptIn)
  const wearerId = useWatch((s) => s.wearerId)
  const setWearer = useWatch((s) => s.setWearer)

  const [summary, setSummary] = useState<WearableSummary | null>(null)

  // Watch only the row count; the coverage summary reloads after writes settle, from index keys only
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    let first = true
    const sub = liveQuery(() => db.wearables.count()).subscribe({
      next: () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          void loadWearableSummary(db).then((s) => { if (!cancelled) setSummary(s) }, () => { if (!cancelled) setSummary(null) })
        }, first ? 0 : SUMMARY_DEBOUNCE_MS)
        first = false
      },
      error: () => setSummary(null),
    })
    return () => { cancelled = true; if (timer) clearTimeout(timer); sub.unsubscribe() }
  }, [])

  return (
    <section className="wc wc-data" aria-label="Watch data">
      <div className="wc-data-tools">
        <label className="wc-optin">
          <input
            type="checkbox"
            checked={saveOptIn}
            onChange={(e) => setSaveOptIn(e.target.checked, crewId)}
          />
          <span>Save watch data on this device</span>
        </label>
        {saveOptIn && crewId && wearerId !== crewId && (
          <p className="wc-hint" role="status">
            {wearerId ? 'Saved watch data belongs to another crew member.' : 'Saved watch data is not linked to a crew member yet.'}{' '}
            <button type="button" className="wc-link" onClick={() => setWearer(crewId)}>Link the watch to this crew member</button>
          </p>
        )}

        {summary !== null && summary.total > 0 && (
          <div className="wc-saved-summary">
            <p className="wc-hint">
              Saved {summary.total} reading{summary.total === 1 ? '' : 's'}; last {summary.windowDays} days: {summary.days} day{summary.days === 1 ? '' : 's'} with data ({summary.hours} active hour{summary.hours === 1 ? '' : 's'}).
            </p>
            <div className="wc-actions">
              <Button
                variant="ghost"
                size="sm"
                className="wc-btn"
                onClick={() => void loadAllWearables().then((rows) => downloadWearablesCsv(exportWearablesCsv(rows)))}
              >
                Export CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="wc-btn"
                onClick={() => void loadAllWearables().then((rows) => downloadWearablesJson(exportWearablesJson(rows)))}
              >
                Export JSON
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="wc-btn wc-btn-danger"
                onClick={() => void deleteWearableData()}
              >
                Delete watch data
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
