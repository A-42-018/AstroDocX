import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import { CheckInForm } from './CheckInForm'
import { requestPersistentStorage } from '../shell/install'
import { submitCheckIn } from './submit'

export default function CheckInPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const select = useBoard((s) => s.selectCrew)
  if (boot.state === 'error') return <p role="alert" className="glass">Could not open the local database: {boot.error}</p>
  if (boot.state !== 'ready' || snap === undefined) return <p className="glass muted" role="status">Initializing demo mission data…</p>
  if (snap === null) return <p className="glass muted">No crew data yet.</p>
  // key: a fresh form per crew member.
  return <CheckInForm key={snap.crewId} crew={snap.crew} crewId={snap.crewId} now={snap.now} onSelectCrew={select} onSubmit={(i) => submitCheckIn(i).finally(() => void requestPersistentStorage())} />
}
