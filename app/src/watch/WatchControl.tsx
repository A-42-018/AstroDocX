import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../data/db'
import type { WearableSample } from '../data/types'
import { Button } from '../ui/Button'
import {
  deleteWearableData,
  downloadWearablesCsv,
  downloadWearablesJson,
  exportWearablesCsv,
  exportWearablesJson,
  getCoverageSummary,
  type DailyCoverage,
} from './history'
import { useWatch } from './store'

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

  const [samples, setSamples] = useState<WearableSample[]>([])

  useEffect(() => {
    const sub = liveQuery(() => db.wearables.toArray()).subscribe({
      next: (rows) => setSamples(rows),
      error: () => setSamples([]),
    })
    return () => sub.unsubscribe()
  }, [])

  if (status === 'unsupported') {
    return <p className="wc wc-off">Watch link needs Chrome or Edge. Showing the simulated signal.</p>
  }

  const coverage: DailyCoverage[] = getCoverageSummary(samples)
  const totalDays = coverage.length
  const totalHours = coverage.reduce((acc, c) => acc + c.hoursWithData, 0)
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

        {samples.length > 0 && (
          <div className="wc-saved-summary">
            <p className="wc-hint">
              Saved {samples.length} readings across {totalDays} day{totalDays === 1 ? '' : 's'} ({totalHours} active hours).
            </p>
            <div className="wc-actions">
              <Button
                variant="ghost"
                size="sm"
                className="wc-btn"
                onClick={() => downloadWearablesCsv(exportWearablesCsv(samples))}
              >
                Export CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="wc-btn"
                onClick={() => downloadWearablesJson(exportWearablesJson(samples))}
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
