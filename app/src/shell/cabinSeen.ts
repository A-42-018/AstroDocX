/** Remembers that this browser has found the 3D cabin, so the once-only hint (shell/CabinHint.tsx) stays away. */
const KEY = 'adx.cabinHintSeen'

export function markCabinSeen() { try { localStorage.setItem(KEY, '1') } catch { /* not persisted */ } }
export function cabinSeen() { try { return localStorage.getItem(KEY) === '1' } catch { return true } }
