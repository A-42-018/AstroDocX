// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.resetModules() })

it('reads what the landing page left, keeping the last six messages', async () => {
  const chat = Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `m${i}` }))
  sessionStorage.setItem('adx-vita', JSON.stringify({ sound: true, tour: 'full', chat }))
  const { readHandoff } = await import('./handoff')
  const h = readHandoff()
  expect(h.sound).toBe(true)
  expect(h.tour).toBe('full')
  expect(h.chat?.map((m) => m.text)).toEqual(['m3', 'm4', 'm5', 'm6', 'm7', 'm8'])
})

it('ignores junk', async () => {
  sessionStorage.setItem('adx-vita', '{"sound":"yes","tour":"huge","chat":[{"role":"system","text":"x"},{"role":"user","text":5},{"role":"user","text":"ok"}]}')
  const { readHandoff } = await import('./handoff')
  expect(readHandoff()).toEqual({ sound: undefined, tour: null, chat: [{ role: 'user', text: 'ok' }] })
  sessionStorage.setItem('adx-vita', 'not json')
  expect(readHandoff()).toEqual({})
})

it('the landing page’s Sound choice wins, and later changes are written back', async () => {
  sessionStorage.setItem('adx-vita', JSON.stringify({ sound: false }))
  const { useSound } = await import('../audio/sfx')
  expect(useSound.getState().on).toBe(true) // the console's own default
  const { readHandoff } = await import('./handoff')
  expect(useSound.getState().on).toBe(false)
  useSound.setState({ on: true })
  expect(readHandoff().sound).toBe(true)
})

it('?mode=full in the address, or a full tour left behind, makes it the full tour', async () => {
  const { askedMode, writeHandoff } = await import('./handoff')
  expect(askedMode('?tour=1')).toBe('quick')
  expect(askedMode('?tour=1&mode=full')).toBe('full')
  writeHandoff({ tour: 'full' })
  expect(askedMode('?tour=1')).toBe('full')
  expect(askedMode('?tour=1&mode=quick')).toBe('quick')
})
