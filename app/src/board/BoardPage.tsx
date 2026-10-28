import { StateView } from '../ui/StateView'
import { StatusBoard } from './StatusBoard'
import { useBoard } from './store'
import { useMini, useSnapshot } from './hooks'

export default function BoardPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const mini = useMini(snap?.crewId, snap?.now)
  if (boot.state === 'error') return <StateView kind="error" title="Could not open the local database"><p>{boot.error}</p></StateView>
  if (boot.state !== 'ready' || snap === undefined) {
    const pct = boot.state === 'seeding' && boot.total > 0 ? (boot.done / boot.total) * 100 : undefined
    return <StateView kind="loading" label="Initializing demo mission data" progress={pct} />
  }
  if (snap === null) return <StateView kind="empty" label="No crew data yet." />
  return <StatusBoard snap={snap} mini={mini} />
}
