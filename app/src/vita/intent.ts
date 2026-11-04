/*
 * Does the visitor want the guided tour? The same pattern is in landing/briefing/briefing.js (ask()), so the landing
 * chat and the dock both start the full guide from the same words.
 */
export const TOUR_INTENT = /full (tour|guide)|\btour\b|guide me|show me (everything|around)|walk me through/i

export const wantsTour = (question: string) => TOUR_INTENT.test(String(question ?? ''))

/** VITA's reply before the full guide starts. */
export const TOUR_REPLY = 'Sure, follow me. I’ll show you everything.'
