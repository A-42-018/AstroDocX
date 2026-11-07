/*
 * VITA's lips. Her voice is the browser's speech synthesis, which gives no audio to analyse, so her mouth is driven from
 * text: each word is spelt out as a run of visemes (the 15 Oculus mouth shapes the doctor model carries) spread over
 * the word's spoken length. When the engine reports word timing the shapes land on the real words; when it does not,
 * `babble` makes word-like runs at a natural speaking rhythm. No three.js here, so it is cheap to test.
 */

export const VISEMES = ['sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U'] as const
export type Viseme = (typeof VISEMES)[number]

const ONE: Record<string, Viseme | null> = {
  a: 'aa', e: 'E', i: 'I', o: 'O', u: 'U', y: 'I',
  b: 'PP', m: 'PP', p: 'PP', f: 'FF', v: 'FF', d: 'DD', t: 'DD', l: 'nn', n: 'nn',
  c: 'kk', g: 'kk', k: 'kk', q: 'kk', x: 'kk', s: 'SS', z: 'SS', r: 'RR', j: 'CH', w: 'U', h: null,
}
const TWO: Record<string, Viseme> = { th: 'TH', ch: 'CH', sh: 'CH', ph: 'FF', ee: 'E', ea: 'E', oo: 'U', ou: 'U', ng: 'nn', ck: 'kk', qu: 'kk' }
const DIGIT = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/** The mouth shapes for one word, in order, without repeats in a row. A silent final "e" is dropped. */
export function visemesOf(word: string): Viseme[] {
  let w = word.toLowerCase().replace(/\d/g, (d) => DIGIT[+d]).replace(/[^a-z]/g, '')
  if (w.length > 3 && /[^aeiou]e$/.test(w)) w = w.slice(0, -1)
  const out: Viseme[] = []
  const push = (v: Viseme | null) => { if (v && v !== out[out.length - 1]) out.push(v) }
  for (let i = 0; i < w.length; i++) {
    const two = TWO[w.slice(i, i + 2)]
    if (two) { push(two); i++; continue }
    push(ONE[w[i]] ?? null)
  }
  return out.length ? out : ['aa']
}

/** How open each shape is at full voice: closures and vowels read clearly, the rest a little softer. */
export const WEIGHT: Record<Viseme, number> = {
  sil: 0, PP: 1, FF: 0.8, TH: 0.7, DD: 0.65, kk: 0.6, CH: 0.75, SS: 0.65, nn: 0.6, RR: 0.65, aa: 0.85, E: 0.75, I: 0.7, O: 0.8, U: 0.75,
}

const BABBLE_V: Viseme[] = ['aa', 'E', 'I', 'O', 'aa', 'E']
const BABBLE_C: Viseme[] = ['PP', 'DD', 'nn', 'SS', 'kk', 'RR', 'FF', 'TH']
/** A made-up word for engines without word timing: 1 to 3 syllables of consonant + vowel, 120–160 ms each. */
export function babble(rand = Math.random): { shapes: Viseme[]; ms: number } {
  const n = 1 + Math.floor(rand() * 3)
  const shapes: Viseme[] = []
  for (let i = 0; i < n; i++) shapes.push(BABBLE_C[Math.floor(rand() * BABBLE_C.length)], BABBLE_V[Math.floor(rand() * BABBLE_V.length)])
  return { shapes, ms: n * (120 + rand() * 40) }
}

/** How long each shape holds, relative to the others: vowels carry the word, a lip closure is a flick. */
const HOLD: Record<Viseme, number> = { sil: 1, PP: 0.55, FF: 0.8, TH: 0.7, DD: 0.65, kk: 0.75, CH: 0.9, SS: 0.9, nn: 0.7, RR: 0.8, aa: 1.7, E: 1.5, I: 1.4, O: 1.7, U: 1.5 }
/** How far the jaw drops with each shape (the open vowels drop it, the lip closures do not). */
export const JAW: Record<Viseme, number> = { sil: 0, PP: 0, FF: 0.04, TH: 0.12, DD: 0.14, kk: 0.2, CH: 0.14, SS: 0.08, nn: 0.12, RR: 0.15, aa: 0.9, E: 0.45, I: 0.3, O: 0.65, U: 0.3 }
/** Shapes the lips snap into fast (closures, teeth on lip, tongue): they are brief, so the mouth must reach them in time. */
export const SNAP = new Set<Viseme>(['PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR'])
/** The picture leads the sound by this much: the eye reads a mouth that lands late as a dub. */
export const LEAD_MS = 40

/** Which shape the mouth makes `t` ms into a word of `ms` that spells `shapes` (silence once it is said). The time each
    shape gets follows HOLD, so the vowels are long and the consonants short. */
export function shapeAt(shapes: Viseme[], ms: number, t: number): Viseme {
  if (t < 0 || t >= ms || !shapes.length) return 'sil'
  let total = 0
  for (const v of shapes) total += HOLD[v]
  let at = (t / ms) * total
  for (const v of shapes) { if (at < HOLD[v]) return v; at -= HOLD[v] }
  return shapes[shapes.length - 1]
}

/** The word VITA is saying `t` ms into a sentence of `words` (each lasting `ms` then pausing `gap`): its index, or -1 before
    the first word; the last word once the sentence is said. `starts` is the start of each word, as `startsOf` gives it. */
export function startsOf(words: { ms: number; gap: number }[]): number[] {
  let at = 0
  return words.map((w) => { const s = at; at += w.ms + w.gap; return s })
}
export function wordIndexAt(starts: number[], t: number): number {
  let i = -1
  while (i + 1 < starts.length && starts[i + 1] <= t) i++
  return i
}
