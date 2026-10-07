import { db } from '../data/db'
import type { Alert } from '../data/types'

/** Most recently resolved alerts for one crew member, newest first. */
export async function loadResolved(crewId: string, limit = 8): Promise<Alert[]> {
  const rows = await db.alerts.where('[crewId+state]').equals([crewId, 'resolved']).toArray()
  return rows.sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0)).slice(0, limit)
}
