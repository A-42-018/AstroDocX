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
 * Connect or disconnect a Bluetooth watch (Haylou Solar 5). Chrome and Edge only; elsewhere it says so and the
 * console keeps its simulated signal. While connected, the watch only sends heart rate while its own heart rate
 * screen is open, so the control tells the person to open it.
 *
 * When opt-in saving is enabled, readings are stored locally in the Dexie `wearables` store for shadow-mode ML features.
 */
export function WatchControl() {
  const status = useWatch((s) => s.status)
  const name = useWatch((s) => s.name)
  const note = useWatch((s) => s.note)
  const streaming = useWatch((s) => s.hr !== null)
  const stored = useWatch((s) => s.storedStress)
  const saveOptIn = useWatch((s) => s.saveOptIn)
  const setSaveOptIn = useWatch((s) => s.setSaveOptIn)
  const connect = useWatch((s) => s.connect)
  const disconnect = useWatch((s) => s.disconnect)

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

  if (status === 'unsupported') {
    return <p className="wc wc-off">Watch link needs Chrome or Edge. Showing the simulated signal.</p>
  }

  const busy = status === 'picking' || status === 'connecting'

  return (
    <div className="wc">
      {status === 'connected' ? (
        <>
          <p className="wc-line" role="status">
            <span className={`wc-dot${streaming ? ' on' : ''}`} aria-hidden="true" />
            <span className="wc-name">{name}</span>
            <span className="wc-hint">{streaming ? 'streaming heart rate' : 'open the heart rate screen on the watch to stream'}</span>
          </p>
          {stored && (
            <p className="wc-hint">
              Last stored stress {stored.value}, from {new Date(stored.at * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}. A past reading, not live.
            </p>
          )}
          <Button variant="ghost" size="sm" className="wc-btn" onClick={disconnect}>Disconnect watch</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" size="sm" className="wc-btn" busy={busy} onClick={() => void connect()}>
            {status === 'picking' ? 'Choose your watch…' : status === 'connecting' ? 'Connecting…' : 'Connect watch'}
          </Button>
          {note && <p className="wc-note" role="status">{note}</p>}
        </>
      )}

      <div className="wc-data-tools">
        <label className="wc-optin">
          <input
            type="checkbox"
            checked={saveOptIn}
            onChange={(e) => setSaveOptIn(e.target.checked)}
          />
          <span>Save watch data on this device</span>
        </label>

        {summary !== null && summary.total > 0 && (
          <div className="wc-saved-summary">
            <p className="wc-hint">
              Saved {summary.total} readings; last {summary.windowDays} days: {summary.days} day{summary.days === 1 ? '' : 's'} with data ({summary.hours} active hours).
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
    </div>
  )
}
