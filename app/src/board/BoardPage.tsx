import { StatusBoard } from './StatusBoard'
import { useBoard } from './store'
import { useSnapshot } from './hooks'

export default function BoardPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const select = useBoard((s) => s.selectCrew)
  if (boot.state === 'error') return <p role="alert" className="glass">Could not open the local database: {boot.error}</p>
  if (boot.state !== 'ready' || snap === undefined) {
    const pct = boot.total > 0 ? Math.round((boot.done / boot.total) * 100) : 0
    return (
      <p className="glass muted" role="status">
        Initializing demo mission data{boot.state === 'seeding' ? ` (${pct}%)` : ''}…
      </p>
    )
  }
  if (snap === null) return <p className="glass muted">No crew data yet.</p>
  return <StatusBoard snap={snap} onSelectCrew={select} />
}
