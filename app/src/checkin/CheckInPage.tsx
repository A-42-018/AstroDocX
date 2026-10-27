import { useEffect, useState } from 'react'
import { useSnapshot } from '../board/hooks'
import { db } from '../data/db'
import { useBoard } from '../board/store'
import { CheckInForm } from './CheckInForm'
import { requestPersistentStorage } from '../shell/install'
import { submitCheckIn } from './submit'
import { StateView } from '../ui/StateView'

export default function CheckInPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const [baseline, setBaseline] = useState<{ crewId: string; mean: number | null } | null>(null)
  const crewId = snap?.crewId
  useEffect(() => {
    if (!crewId) return
    let live = true
    void db.baselines.get([crewId, 'reaction']).then((b) => live && setBaseline({ crewId, mean: b && b.n >= 5 ? b.mean : null }), () => {})
    return () => { live = false }
  }, [crewId])
  if (boot.state === 'error') return <StateView kind="error" title="Could not open the local database"><p>{boot.error}</p></StateView>
  if (boot.state !== 'ready' || snap === undefined) {
    const pct = boot.state === 'seeding' && boot.total > 0 ? (boot.done / boot.total) * 100 : undefined
    return <StateView kind="loading" label="Initializing demo mission data" progress={pct} />
  }
  if (snap === null) return <StateView kind="empty" label="No crew data yet." />
  // key: a fresh form per crew member.
  return <CheckInForm key={snap.crewId} crew={snap.crew} crewId={snap.crewId} now={snap.now} baselineMs={baseline?.crewId === snap.crewId ? baseline.mean : null} onSubmit={(i) => submitCheckIn(i).finally(() => void requestPersistentStorage())} />
}
