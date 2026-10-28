import '../styles/pages/sim.css'
import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { useSnapshot } from '../board/hooks'
import { useBoard } from '../board/store'
import { seedDemo } from '../data/demo'
import { advance, LEAD_HOURS, makeInjection, missionNow, type AdvanceResult } from './advance'
import { autoSync } from '../sync/outbox'
import { useSync } from '../sync/store'
import { useSim } from './store'
import { loadFeed, type FeedEvent } from './feed'
import { SimulatorView } from './SimulatorView'
import { StateView } from '../ui/StateView'

export default function SimulatorPage() {
  const snap = useSnapshot()
  const boot = useBoard((s) => s.boot)
  const { injections, add, prune, clear } = useSim()
  const [last, setLast] = useState<AdvanceResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [events, setEvents] = useState<FeedEvent[]>([])
  const crew = snap?.crew
  // The feed follows the on-board log, so every engine decision shows up as it is made.
  useEffect(() => {
    if (!crew) return
    const sub = liveQuery(() => loadFeed(crew)).subscribe({ next: setEvents, error: () => setEvents([]) })
    return () => sub.unsubscribe()
  }, [crew])

  const run = async (job: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try { await job() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  const step = async (hours: number, list = useSim.getState().injections) => {
    const res = await advance(hours, list)
    prune(res.to)
    const { auto, blackout } = useSync.getState()
    if (auto) {
      try {
        await autoSync(res.from, res.to, blackout)
      } catch (e) {
        // Time still moved; only the upload failed, so the entries wait for the next window.
        setError(`Ground upload failed, entries stay queued. ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    setLast(res)
  }

  if (boot.state === 'error') return <StateView kind="error" title="Could not open the local database"><p>{boot.error}</p></StateView>
  if (boot.state !== 'ready' || snap === undefined) {
    const pct = boot.state === 'seeding' && boot.total > 0 ? (boot.done / boot.total) * 100 : undefined
    return <StateView kind="loading" label="Initializing demo mission data" progress={pct} />
  }
  if (snap === null) return <StateView kind="empty" label="No crew data yet." />

  return (
    <SimulatorView
      crew={snap.crew}
      now={snap.now}
      injections={injections}
      last={last}
      busy={busy}
      events={events}
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
