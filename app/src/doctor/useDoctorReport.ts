import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { useBoard } from '../board/store'
import { loadCrewExam, type DoctorReport, type Scope } from './analyze'

/** The crew exam, following the database: the simulator, a check-in or a ticked step updates it. Undefined while loading. */
export function useDoctorReport(scope: Scope = 'all'): DoctorReport | null | undefined {
  const ready = useBoard((s) => s.boot.state === 'ready')
  const [report, setReport] = useState<DoctorReport | null | undefined>(undefined)
  useEffect(() => {
    if (!ready) return
    const sub = liveQuery(() => loadCrewExam(scope)).subscribe({ next: setReport, error: () => setReport(null) })
    return () => sub.unsubscribe()
  }, [ready, scope])
  return report
}

/**
 * VITA's latest whole-crew brief in her own words, kept for the visit: when the Crew Doctor page got a live narrative,
 * the cabin's VITA says that one instead of the offline brief (as long as it is about the same report).
 */
export const useDoctorBrief = create<{ text: string; headline: string } | { text: ''; headline: '' }>(() => ({ text: '', headline: '' }))
