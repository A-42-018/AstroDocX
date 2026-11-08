// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

let speech: { resolve: () => void; text: string }[] = []
vi.mock('../audio/voice', () => ({
  hushChatter: vi.fn(),
  vitaPause: vi.fn(),
  vitaResume: vi.fn(),
  vitaStop: vi.fn(),
  vitaSay: vi.fn((text: string) => new Promise<void>((resolve) => { speech.push({ resolve, text }) })),
}))

const { currentRun, narrate, skipChapter, exitTour } = await import('./director')
const { useTour } = await import('./store')
const voice = await import('../audio/voice')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Resolves true once `p` has settled. */
const settled = (p: Promise<unknown>) => { let done = false; void p.then(() => { done = true }); return () => done }

beforeEach(() => {
  speech = []
  vi.mocked(voice.vitaSay).mockClear()
  useTour.getState().set({ phase: 'running', paused: false, caption: '', chapter: 1 })
})
afterEach(() => exitTour())

it('shows the line as the caption and has VITA say it', () => {
  void narrate(currentRun(), 'Hello there.', 10)
  expect(useTour.getState().caption).toBe('Hello there.')
  expect(voice.vitaSay).toHaveBeenCalledWith('Hello there.')
})

it('waits for the speech to end even after the step time is over', async () => {
  const done = settled(narrate(currentRun(), 'Hi.', 10))
  await sleep(450)
  expect(done()).toBe(false) // the step's own time is long gone, VITA is still talking
  speech[0].resolve()
  await sleep(150)
  expect(done()).toBe(true)
})

it('waits for the step time when the speech is already over', async () => {
  const p = narrate(currentRun(), 'Hi.', 600)
  speech[0].resolve()
  const done = settled(p)
  await sleep(300)
  expect(done()).toBe(false)
  await sleep(500)
  expect(done()).toBe(true)
})

it('does not wait on speech when there is none to wait for (Sound off)', async () => {
  vi.mocked(voice.vitaSay).mockResolvedValueOnce(undefined)
  const done = settled(narrate(currentRun(), 'Hi.', 100))
  await sleep(450)
  expect(done()).toBe(true)
})

it('Skip ends the step at once and silences VITA', async () => {
  const done = settled(narrate(currentRun(), 'A long sentence that is still being said.', 10000))
  await sleep(150)
  expect(done()).toBe(false)
  skipChapter()
  await sleep(250)
  expect(done()).toBe(true)
  expect(voice.vitaStop).toHaveBeenCalled()
})

it('Exit ends the step and silences VITA', async () => {
  const done = settled(narrate(currentRun(), 'Another long sentence.', 10000))
  await sleep(150)
  exitTour()
  await sleep(250)
  expect(done()).toBe(true)
  expect(useTour.getState().phase).toBe('off')
  expect(voice.vitaStop).toHaveBeenCalled()
})

it('Pause and Resume pause and resume VITA, and hold the clock', async () => {
  const done = settled(narrate(currentRun(), 'Hi.', 300))
  speech[0].resolve()
  useTour.getState().set({ paused: true })
  expect(voice.vitaPause).toHaveBeenCalled()
  await sleep(700)
  expect(done()).toBe(false)
  useTour.getState().set({ paused: false })
  expect(voice.vitaResume).toHaveBeenCalled()
  await sleep(600)
  expect(done()).toBe(true)
})
