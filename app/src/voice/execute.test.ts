// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const said: string[] = []
vi.mock('../audio/voice', () => ({
  vitaSay: vi.fn((t: string) => { said.push(t); return Promise.resolve() }), vitaStop: vi.fn(), vitaPause: vi.fn(), vitaResume: vi.fn(),
  hushChatter: vi.fn(), announce: vi.fn(), startChatter: vi.fn(), stopChatter: vi.fn(),
  useVitaVoice: Object.assign(() => ({}), { subscribe: vi.fn(), getState: () => ({ speaking: false }) }),
}))
const ask = vi.fn(async () => ({ text: 'An answer', citations: [], actions: [{ label: 'Open Alerts', kind: 'console', target: '/alerts' }], source: 'offline' }))
vi.mock('../../../landing/vita/ask.js', () => ({ ask }))

const { handleSpeech } = await import('./execute')
const { useVita } = await import('../vita/store')

const mk = (pathname = '/board') => ({ go: vi.fn(), history: vi.fn(), pathname, voiceOff: vi.fn() })

beforeEach(() => { said.length = 0; ask.mockClear(); useVita.setState({ open: false, busy: false, messages: [] }) })

describe('voice execute', () => {
  it('navigates to a screen and confirms it', () => {
    const ctx = mk()
    const r = handleSpeech('open the alerts', ctx)
    expect(r.kind).toBe('command')
    expect(ctx.go).toHaveBeenCalledWith('/alerts')
    expect(said).toEqual(['Opening Alerts.'])
  })
  it('goes to a cabin stop through ?shot=', () => {
    const ctx = mk('/cabin')
    handleSpeech('window', ctx)
    expect(ctx.go).toHaveBeenCalledWith('/cabin?shot=window')
  })
  it('back uses history, stop listening turns voice mode off', () => {
    const ctx = mk()
    handleSpeech('go back', ctx); expect(ctx.history).toHaveBeenCalledWith(-1)
    handleSpeech('stop listening', ctx); expect(ctx.voiceOff).toHaveBeenCalled()
  })
  it('anything else is a question for VITA, and the panel opens', async () => {
    const ctx = mk()
    const r = handleSpeech('why does co2 matter on a spacecraft', ctx)
    expect(r.kind).toBe('question')
    expect(useVita.getState().open).toBe(true)
    await vi.waitFor(() => expect(ask).toHaveBeenCalled())
    expect(ctx.go).not.toHaveBeenCalled()
  })
  it('"yes" runs the first action of the last answer', async () => {
    const ctx = mk()
    handleSpeech('what do the alerts mean', ctx)
    await vi.waitFor(() => expect(useVita.getState().messages.some((m) => m.role === 'assistant')).toBe(true))
    handleSpeech('yes', ctx)
    expect(ctx.go).toHaveBeenCalledWith('/alerts')
  })
})
