/*
 * What VITA says on the guided tours. Each line is VITA speaking in the first person, in short sentences, with numbers
 * in words so the voice reads them right. The same text is the on-screen caption, so with Sound off the tour reads the same.
 * "ms" is the least time a step stays up (long enough to read the caption); the director also waits for the speech to end.
 */

export type TourMode = 'quick' | 'full'

/** `more` is added after `text` on the full tour only. */
export interface ConsoleStep { path: string; ms: number; text: string; more?: string }
export interface Line { ms: number; text: string; more?: string }

export const BOARD: Record<'intro' | 'demo' | 'after', Line> = {
  intro: { ms: 5000, text: 'Welcome aboard the Crew Console. This is the Status Board. Every astronaut gets a readiness score, live vitals, a body twin and five NASA hazard modules. It is all worked out on board, with no link to Earth.', more: 'Pick any crew member at the top and the whole board follows them. The turning body is their health twin. The heart beats with the live ECG, and each hazard lights its own part in amber or red.' },
  demo: { ms: 18000, text: 'Now watch this. I am injecting a carbon dioxide scrubber fault. The mission clock jumps ahead one hour at a time. See Environment climb from okay to act.' },
  after: { ms: 3500, text: 'The engine raised an alert on its own. And Next Action tells the crew exactly what to do.', more: 'Every step is logged on board, and waits in the outbox for the next ground contact.' },
}

/** Both tours: the screens after the board. The full tour adds the rest (see FULL_ONLY). */
export const ALERTS: ConsoleStep = { path: '/alerts', ms: 5500, text: 'These are the alerts. Every alert says why, in plain words. It shows the evidence behind it, and the next step from its action card. No black boxes.', more: 'Alerts open, escalate, ease and resolve, and each step is logged. I never diagnose anyone. I give context, and a next action.' }
export const TRENDS: ConsoleStep = { path: '/trends', ms: 4500, text: 'Trends. Thirty days of each vital, drawn against the astronaut’s own baseline band and the crew median.', more: 'There are eleven charts in all, over twenty four hours, seven days, or thirty. The markers show where an alert was raised.' }
export const CHECKIN: ConsoleStep = { path: '/checkin', ms: 5000, text: 'The daily check in. It takes two minutes: mood, sleep, symptoms and a quick reaction test. Your answers join your own baseline, so I can spot drift in how you feel before it becomes a problem.' }
export const SIMULATOR: ConsoleStep = { path: '/simulator', ms: 5000, text: 'The mission simulator. You can inject a solar event, a carbon dioxide fault, insomnia or muscle loss, then fast forward the clock. Everything runs through the same engine as real readings.' }
export const SYNC: ConsoleStep = { path: '/sync', ms: 5000, text: 'Ground sync. Far from Earth, the link comes and goes. Entries wait in an on-board outbox, and go down in the next contact window. Nothing is lost, and nothing waits on the link.' }
export const GROUND: ConsoleStep = { path: '/ground', ms: 4000, text: 'Ground View. This is what the flight surgeons on Earth see once the next sync window opens. Only what has been sent, and when.', more: 'It is rebuilt only from synced entries. So it shows what Earth knows, and how far behind it is.' }
export const NASA: ConsoleStep = { path: '/nasa', ms: 4000, text: 'NASA Data. The hazards, limits and studies the engine is built on. NASA standard thirty oh one, open science data, and Human Research Program reports.', more: 'Every alert and every tile carries a NASA source tag, so you can follow it back to the study.' }

export const QUICK: ConsoleStep[] = [ALERTS, TRENDS, GROUND, NASA]
export const FULL: ConsoleStep[] = [ALERTS, TRENDS, CHECKIN, SIMULATOR, SYNC, GROUND, NASA]
export const stepsFor = (mode: TourMode) => (mode === 'full' ? FULL : QUICK)
/** What VITA says for a step on this tour: the full tour adds a few sentences. */
export const lineFor = (l: Line, mode: TourMode) => (mode === 'full' && l.more ? `${l.text} ${l.more}` : l.text)

export const CABIN_ENTER = 'Now, the three D cabin. The same live data, inside the crew module.'

/** The full tour's closing words: the library lives on the landing page, so it is offered rather than visited. */
export const LIBRARY_LINE = 'One more place I can take you. The NASA library, on the home page, holds NASA’s own photos and videos on keeping astronauts healthy, sorted by hazard.'
export const FINISH = { quick: 'That is Astro Doc X. A doctor on board. Ask me anything, any time.', full: 'And that is everything. Astro Doc X is a doctor on board. It learns each astronaut’s own baseline, explains every alert, and says what to do next, with or without a link to Earth. Ask me anything, any time.' }

/** The cabin's ten stops are spoken from CabinPage (spokenStops), since they use the live crew names. */
export const CABIN_MIN_MS = [4000, 2600, 3000, 3000, 2600, 3000, 3000, 2600, 2600, 6500]

/** How long a caption needs on screen to be read (about twenty two characters a second), whatever the step asks for. */
export const readMs = (text: string) => Math.round(text.length * 45)
