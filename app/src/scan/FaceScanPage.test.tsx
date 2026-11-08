// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, resetDb } from '../data/db'
import FaceScanPage from './FaceScanPage'
import type { ScanAnalysis } from './rppg'
import { ScanSession, type SessionView } from './session'

const hook = vi.hoisted(() => ({ camera: 'off', error: '', view: null as unknown, start: vi.fn(), stop: vi.fn(), again: vi.fn() }))
vi.mock('./useFaceScan', () => ({ useFaceScan: () => ({ videoRef: { current: null }, ...hook }) }))
vi.mock('../board/hooks', () => ({
  useSnapshot: () => ({ crew: [{ id: 'c1', name: 'Commander', role: 'CDR' }], crewId: 'c1', now: 5000 }),
}))
vi.mock('../board/store', () => ({ useBoard: (sel: (s: unknown) => unknown) => sel({ boot: { state: 'ready', done: 0, total: 0 } }) }))
vi.mock('../audio/sfx', () => ({ confirmChime: () => {} }))
vi.mock('../shell/install', () => ({ requestPersistentStorage: () => Promise.resolve() }))

const analysis = (over: Partial<ScanAnalysis> = {}): ScanAnalysis => ({
  seconds: 28.5, pulse: new Float64Array(0), bpm: 66.2, snr: 9, quality: 0.9, reliable: true, hrv: 38, beatCount: 30, resp: 15, ...over,
})
const view = (over: Partial<SessionView> = {}): SessionView => ({ ...ScanSession.initial(), ...over })

const open = (onContinue?: () => void) => render(<MemoryRouter><FaceScanPage onContinue={onContinue} /></MemoryRouter>)

beforeEach(async () => {
  await resetDb()
  hook.camera = 'off'; hook.error = ''; hook.view = view(); hook.start.mockClear(); hook.stop.mockClear()
})
afterEach(cleanup)

describe('FaceScanPage', () => {
  it('starts with the camera off and a clear promise about the data', () => {
    open()
    expect(screen.getByRole('heading', { name: /face scan · commander/i })).toBeTruthy()
    expect(screen.getByText(/video stays on this device/i)).toBeTruthy()
    expect(screen.getByText(/never raise alerts/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start camera' }))
    expect(hook.start).toHaveBeenCalledOnce()
  })

  it('explains a blocked camera and offers another try', () => {
    hook.camera = 'error'; hook.error = 'Camera access was blocked. Allow the camera for this site in the browser, then try again.'
    open()
    expect(screen.getByText(/camera access was blocked/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start camera' })).toBeTruthy()
  })

  it('tells the person what to fix while aiming', () => {
    hook.camera = 'on'; hook.view = view({ verdict: 'too-dark', hint: 'Too dark. Face a lamp or a window.' })
    open()
    expect(screen.getByRole('status').textContent).toMatch(/too dark/i)
    expect(screen.getByRole('button', { name: 'Stop camera' })).toBeTruthy()
  })

  it('shows progress and a live rate only when the pulse is reliable', () => {
    hook.camera = 'on'
    hook.view = view({ phase: 'measuring', verdict: 'ok', seconds: 12, progress: 0.4, live: analysis({ reliable: false, bpm: 140, quality: 0.1 }) })
    const { unmount } = open()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('12')
    expect(screen.getByRole('status').textContent).toMatch(/12 \/ 30 s/)
    expect(screen.queryByText('140')).toBeNull()
    unmount()
    hook.view = view({ phase: 'measuring', verdict: 'ok', seconds: 14, progress: 0.45, live: analysis() })
    open()
    expect(screen.getByText('66')).toBeTruthy()
  })

  it('saves a finished scan to the log, and nothing else', async () => {
    hook.view = view({ phase: 'done', final: analysis(), live: analysis() })
    open()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save to log' })) })
    await waitFor(() => expect(screen.getByText(/saved to the on-board log/i)).toBeTruthy())
    expect(await db.scans.count()).toBe(1)
    expect((await db.scans.toArray())[0]).toMatchObject({ crewId: 'c1', hr: 66, hrv: 38, resp: 15, ts: 5000 })
    expect(await db.readings.count()).toBe(0)
    expect(screen.queryByRole('button', { name: 'Save to log' })).toBeNull()
  })

  it('will not offer to save a weak scan', () => {
    hook.view = view({ phase: 'done', final: analysis({ reliable: false, snr: -4, quality: 0.1 }) })
    open()
    expect(screen.queryByRole('button', { name: 'Save to log' })).toBeNull()
    expect(screen.getAllByText(/too weak to trust/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Scan again' })).toBeTruthy()
  })

  it('on its own it links back to the check-in; inside the check-in it can be skipped or continued from', () => {
    const { unmount } = open()
    expect(screen.getByRole('link', { name: 'Back to check-in' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /skip scan/i })).toBeNull()
    unmount()
    const go = vi.fn()
    open(go)
    expect(screen.queryByRole('link', { name: 'Back to check-in' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /skip scan/i }))
    expect(go).toHaveBeenCalledOnce()
  })

  it('offers Continue to check-in once the scan is saved', async () => {
    hook.view = view({ phase: 'done', final: analysis(), live: analysis() })
    const go = vi.fn()
    open(go)
    expect(screen.getByRole('button', { name: /skip saving, continue/i })).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save to log' })) })
    await waitFor(() => expect(screen.getByRole('button', { name: /continue to check-in/i })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /continue to check-in/i }))
    expect(go).toHaveBeenCalledOnce()
  })
})
