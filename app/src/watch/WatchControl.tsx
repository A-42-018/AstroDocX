import { Button } from '../ui/Button'
import { useWatch } from './store'

/**
 * Connect or disconnect a Bluetooth watch (Haylou Solar 5). Chrome and Edge only; elsewhere it says so and the
 * console keeps its simulated signal. While connected, the watch only sends heart rate while its own heart rate
 * screen is open, so the control tells the person to open it.
 */
export function WatchControl() {
  const status = useWatch((s) => s.status)
  const name = useWatch((s) => s.name)
  const note = useWatch((s) => s.note)
  const streaming = useWatch((s) => s.hr !== null)
  const connect = useWatch((s) => s.connect)
  const disconnect = useWatch((s) => s.disconnect)

  if (status === 'unsupported') {
    return <p className="wc wc-off">Watch link needs Chrome or Edge. Showing the simulated signal.</p>
  }
  if (status === 'connected') {
    return (
      <div className="wc">
        <p className="wc-line" role="status">
          <span className={`wc-dot${streaming ? ' on' : ''}`} aria-hidden="true" />
          <span className="wc-name">{name}</span>
          <span className="wc-hint">{streaming ? 'streaming heart rate' : 'open the heart rate screen on the watch to stream'}</span>
        </p>
        <Button variant="ghost" size="sm" className="wc-btn" onClick={disconnect}>Disconnect watch</Button>
      </div>
    )
  }
  const busy = status === 'picking' || status === 'connecting'
  return (
    <div className="wc">
      <Button variant="ghost" size="sm" className="wc-btn" busy={busy} onClick={() => void connect()}>
        {status === 'picking' ? 'Choose your watch…' : status === 'connecting' ? 'Connecting…' : 'Connect watch'}
      </Button>
      {note && <p className="wc-note" role="status">{note}</p>}
    </div>
  )
}
