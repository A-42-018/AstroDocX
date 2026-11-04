// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'

/** A speech engine we can drive by hand: utterances queue up until the test ends them. */
class Utter { text: string; voice: unknown = null; pitch = 1; rate = 1; volume = 1; lang = ''; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(t: string) { this.text = t } }
let spoken: Utter[] = []
const synth = {
  speak: vi.fn((u: Utter) => { spoken.push(u) }), cancel: vi.fn(() => { spoken = [] }), pause: vi.fn(), resume: vi.fn(),
  getVoices: () => [{ name: 'Alex', lang: 'en-US', localService: true }, { name: 'Samantha', lang: 'en-US', localService: true }],
  addEventListener: vi.fn(),
}
let v: typeof import('./voice')
let sfx: typeof import('./sfx')

beforeEach(async () => {
  spoken = []
  Object.assign(synth, {})
  vi.stubGlobal('SpeechSynthesisUtterance', Utter)
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
  synth.speak.mockClear(); synth.cancel.mockClear(); synth.pause.mockClear(); synth.resume.mockClear()
  vi.resetModules()
  localStorage.clear()
  v = await import('./voice')
  sfx = await import('./sfx')
})

const settled = (p: Promise<unknown>) => { let done = false; void p.then(() => { done = true }); return () => done }
const flush = () => new Promise((r) => setTimeout(r, 0))

it('speakable reads names and units the way a person would', () => {
  expect(v.speakable('AstroDocX and VITA check CO₂ and SpO₂ in the 3D cabin')).toBe('Astro Doc X and Veeta check C O 2 and S P O 2 in the three D cabin')
  expect(v.speakable('NASA-STD-3001 limits it to 3 mmHg · see EVA')).toBe('NASA standard thirty oh one limits it to 3 millimetres of mercury, see E V A')
})

it('speaks in VITA’s voice: Samantha, natural pitch, a sentence at a time', async () => {
  void v.vitaSay('First sentence. Second sentence!')
  expect(spoken.map((u) => u.text)).toEqual(['First sentence.', 'Second sentence!'])
  expect(spoken[0].pitch).toBeCloseTo(1.08)
  expect((spoken[0].voice as { name: string }).name).toBe('Samantha')
})

it('resolves only once the last sentence has been said', async () => {
  const done = settled(v.vitaSay('One. Two.'))
  spoken[0].onend?.()
  await flush()
  expect(done()).toBe(false)
  spoken[1].onend?.()
  await flush()
  expect(done()).toBe(true)
  expect(v.useVitaVoice.getState().speaking).toBe(false)
})

it('a newer line cuts the old one off and resolves it', async () => {
  const first = settled(v.vitaSay('A long first line.'))
  void v.vitaSay('Second.')
  await flush()
  expect(first()).toBe(true)
  expect(synth.cancel).toHaveBeenCalled()
  expect(spoken.map((u) => u.text)).toEqual(['Second.'])
})

it('vitaStop resolves the line and silences the voice', async () => {
  const done = settled(v.vitaSay('Something long.'))
  v.vitaStop()
  await flush()
  expect(done()).toBe(true)
  expect(v.useVitaVoice.getState().speaking).toBe(false)
})

it('pause and resume go to the speech engine', () => {
  void v.vitaSay('Hold on.')
  v.vitaPause(); expect(synth.pause).toHaveBeenCalled()
  synth.resume.mockClear()
  v.vitaResume(); expect(synth.resume).toHaveBeenCalled()
})

it('an interrupted or refused utterance resolves too (no gesture yet)', async () => {
  const done = settled(v.vitaSay('Blocked.'))
  spoken[0].onerror?.()
  await flush()
  expect(done()).toBe(true)
})

it('with Sound off it says nothing and resolves at once', async () => {
  sfx.useSound.setState({ on: false })
  const done = settled(v.vitaSay('Silent.'))
  await flush()
  expect(done()).toBe(true)
  expect(synth.speak).not.toHaveBeenCalled()
})

it('turning Sound off mid-sentence stops her', async () => {
  const done = settled(v.vitaSay('Going quiet.'))
  sfx.useSound.setState({ on: false })
  await flush()
  expect(done()).toBe(true)
})

it('does not speak before the visitor has touched the page', async () => {
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { userActivation: { hasBeenActive: false } }))
  expect(v.vitaCanSpeak()).toBe(false)
  const done = settled(v.vitaSay('Too early.'))
  await flush()
  expect(done()).toBe(true)
  expect(synth.speak).not.toHaveBeenCalled()
})
