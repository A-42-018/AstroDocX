import { expect, it } from 'vitest'
import { scriptOf, wordAt } from '../audio/voice'
import { babble, shapeAt, startsOf, VISEMES, visemesOf, wordIndexAt } from './lips'

it('spells a word as mouth shapes: digraphs first, no repeats in a row, a silent final e dropped', () => {
  expect(visemesOf('the')).toEqual(['TH', 'E'])
  expect(visemesOf('Mom,')).toEqual(['PP', 'O', 'PP'])
  expect(visemesOf('sleep')).toEqual(['SS', 'nn', 'E', 'PP'])
  expect(visemesOf('rate')).toEqual(['RR', 'aa', 'DD'])
  expect(visemesOf('CO2')).toEqual(['kk', 'O', 'DD', 'U', 'O'])   // digits are said as words
  expect(visemesOf('—')).toEqual(['aa'])                           // nothing to spell still opens the mouth
})

it('places a shape by time through the word, and closes the mouth after it', () => {
  expect(shapeAt(['PP', 'aa'], 200, 0)).toBe('PP')
  expect(shapeAt(['PP', 'aa'], 200, 150)).toBe('aa')
  expect(shapeAt(['PP', 'aa'], 200, 40)).toBe('PP')                 // a lip closure is brief...
  expect(shapeAt(['PP', 'aa'], 200, 70)).toBe('aa')                 // ...and the vowel gets the rest of the word
  expect(shapeAt(['PP', 'aa'], 200, 200)).toBe('sil')
  expect(shapeAt([], 200, 50)).toBe('sil')
})

it('babbles word-like runs of known shapes when the voice gives no word timing', () => {
  let s = 0.37
  const rand = () => (s = (s * 9301 + 49297) % 233280 / 233280)
  for (let i = 0; i < 50; i++) {
    const b = babble(rand)
    expect(b.shapes.length % 2).toBe(0)
    expect(b.shapes.every((v) => VISEMES.includes(v))).toBe(true)
    expect(b.ms).toBeGreaterThanOrEqual(120)
    expect(b.ms).toBeLessThanOrEqual(480)
  }
})

it('weighs and times the words VITA says for the 3D doctor', () => {
  expect(wordAt('Pilot first: sleep', 0)).toMatchObject({ word: 'Pilot', power: 0.25 })
  expect(wordAt('Pilot first: sleep', 6)).toMatchObject({ word: 'first:', power: 1 })
  expect(wordAt('a crewmate.', 2).power).toBe(1)
  expect(wordAt('swap safety-critical tasks', 5)).toMatchObject({ word: 'safety-critical', power: 0.85, ms: 800 })
  expect(wordAt('a', 0).ms).toBe(140)
  expect(wordAt('1. Pilot', 0)).toMatchObject({ power: 0.25 })   // a list number is not a sentence end
})

it('times a sentence word by word, with a pause after commas and full stops', () => {
  const ws = scriptOf('Pilot first, then sleep.')
  expect(ws.map((w) => w.word)).toEqual(['Pilot', 'first,', 'then', 'sleep.'])
  expect(ws.map((w) => w.at)).toEqual([0, 6, 13, 18])
  expect(ws[1].gap).toBeGreaterThan(0)                              // a comma
  expect(ws[3].gap).toBeGreaterThan(ws[1].gap)                      // a full stop is longer
  expect(ws[0].gap).toBe(0)
  const starts = startsOf(ws)
  expect(starts[0]).toBe(0)
  expect(starts[1]).toBe(ws[0].ms)
  expect(wordIndexAt(starts, -5)).toBe(-1)
  expect(wordIndexAt(starts, 0)).toBe(0)
  expect(wordIndexAt(starts, starts[2])).toBe(2)
  expect(wordIndexAt(starts, 1e6)).toBe(3)                          // the last word stays once the sentence is said
})
