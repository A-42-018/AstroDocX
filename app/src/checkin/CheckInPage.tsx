import { useEffect, useState } from 'react'
import { useSnapshot } from '../board/hooks'
import { db } from '../data/db'
import { useBoard } from '../board/store'
import { CheckInForm } from './CheckInForm'
import { requestPersistentStorage } from '../shell/install'
import { submitCheckIn } from './submit'

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
  if (boot.state === 'error') return <p role="alert" className="glass">Could not open the local database: {boot.error}</p>
  if (boot.state !== 'ready' || snap === undefined) return <p className="glass muted" role="status">Initializing demo mission data…</p>
  if (snap === null) return <p className="glass muted">No crew data yet.</p>
  // key: a fresh form per crew member.
  return <CheckInForm key={snap.crewId} crew={snap.crew} crewId={snap.crewId} now={snap.now} baselineMs={baseline?.crewId === snap.crewId ? baseline.mean : null} onSubmit={(i) => submitCheckIn(i).finally(() => void requestPersistentStorage())} />
}
