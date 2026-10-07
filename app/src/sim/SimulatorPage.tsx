import { useState } from 'react'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import { seedDemo } from '../data/demo'
import { advance, LEAD_HOURS, makeInjection, missionNow, type AdvanceResult } from './advance'
import { autoSync } from '../sync/outbox'
import { useSync } from '../sync/store'
import { useSim } from './store'
import { SimulatorView } from './SimulatorView'

export default function SimulatorPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const { injections, add, prune, clear } = useSim()
  const [last, setLast] = useState<AdvanceResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (job: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try { await job() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  const step = async (hours: number, list = useSim.getState().injections) => {
    const res = await advance(hours, list)
    prune(res.to)
    const { auto, blackout } = useSync.getState()
    if (auto) await autoSync(res.from, res.to, blackout)
    setLast(res)
  }

  if (boot.state === 'error') return <p role="alert" className="glass">Could not open the local database: {boot.error}</p>
  if (boot.state !== 'ready' || snap === undefined) return <p className="glass muted" role="status">Initializing demo mission data…</p>
  if (snap === null) return <p className="glass muted">No crew data yet.</p>

  return (
    <SimulatorView
      crew={snap.crew}
      now={snap.now}
      injections={injections}
      last={last}
      busy={busy}
      error={error}
      onInject={(scenario, crewIds) => void run(async () => {
        const inj = makeInjection(scenario, crewIds, await missionNow())
        add(inj)
        await step(LEAD_HOURS[scenario], [...useSim.getState().injections])
      })}
      onAdvance={(h) => void run(() => step(h))}
      onCancel={(i) => useSim.setState((s) => ({ injections: s.injections.filter((_, k) => k !== i) }))}
      onReset={() => void run(async () => { clear(); setLast(null); await seedDemo() })}
    />
  )
}
