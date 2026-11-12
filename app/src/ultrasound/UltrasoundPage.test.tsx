// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, resetDb } from '../data/db'
import UltrasoundPage from './UltrasoundPage'

vi.mock('../board/hooks', () => ({
  useSnapshot: () => ({ crew: [{ id: 'c1', name: 'Commander', role: 'CDR' }], crewId: 'c1', now: 5000 }),
}))
vi.mock('../board/store', () => ({ useBoard: (sel: (s: unknown) => unknown) => sel({ boot: { state: 'ready', done: 0, total: 0 } }) }))
vi.mock('../audio/sfx', () => ({ confirmChime: () => {}, notAllowed: () => {}, scanSweep: () => {} }))
vi.mock('../shell/install', () => ({ requestPersistentStorage: () => Promise.resolve() }))

beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
})
beforeEach(() => resetDb())
afterEach(cleanup)

const open = (url = '/ultrasound') => render(<MemoryRouter initialEntries={[url]}><UltrasoundPage /></MemoryRouter>)

/** Follow the on-screen instruction until the view is good. */
function lineUp() {
  for (let i = 0; i < 60; i++) {
    const text = screen.getByRole('status', { name: '' }).textContent ?? ''
    if (text.startsWith('Good view')) return
    fireEvent.click(screen.getByRole('button', { name: text.replace(/\.$/, '') }))
  }
  throw new Error('never reached a good view')
}

describe('UltrasoundPage', () => {
  it('opens the exam named in the link and says where the suggestion came from', () => {
    open('/ultrasound?exam=lung&from=rf')
    expect(screen.getByRole('heading', { name: 'Lungs scan' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText(/Suggested by Wi-Fi sensing/)).toBeTruthy()
    expect(screen.getByText('Simulated imagery')).toBeTruthy()
  })

  it('switches exam from the picker', () => {
    open()
    expect(screen.getByRole('heading', { name: 'Heart scan' })).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Eye' })[0])
    expect(screen.getByRole('heading', { name: 'Eye scan' })).toBeTruthy()
  })

  it('cannot capture until the probe is lined up, then saves the scan and can flag it', async () => {
    open('/ultrasound?exam=ocular')
    const capture = screen.getByRole('button', { name: /Capture now/ }) as HTMLButtonElement
    expect(capture.disabled).toBe(true)
    lineUp()
    expect(capture.disabled).toBe(false)
    fireEvent.click(capture)
    await waitFor(() => expect(screen.getByText('Scan captured.')).toBeTruthy())
    expect(screen.getByText('Within the expected range.')).toBeTruthy()
    expect(screen.getAllByText('Optic nerve sheath').length).toBeGreaterThan(0)
    expect(await db.usScans.count()).toBe(1)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Flag for flight surgeon/ })) })
    await waitFor(() => expect(screen.getByRole('button', { name: /Flagged for flight surgeon/ })).toBeTruthy())
    expect((await db.usScans.toArray())[0].flagged).toBe(true)
    expect(await db.actionLog.count()).toBe(2)
    expect(await db.alerts.count()).toBe(0)
  })

  it('the concerning finding is shown as outside the expected range', async () => {
    open('/ultrasound?exam=lung')
    fireEvent.click(screen.getByRole('button', { name: 'Concerning' }))
    lineUp()
    fireEvent.click(screen.getByRole('button', { name: /Capture now/ }))
    await waitFor(() => expect(screen.getByText(/Outside the expected range/)).toBeTruthy())
    expect(screen.getByText('Absent')).toBeTruthy()
  })

  it('switching exam right after a capture does not show the old scan under the new exam', async () => {
    open('/ultrasound?exam=lung')
    lineUp()
    fireEvent.click(screen.getByRole('button', { name: /Capture now/ }))
    await waitFor(() => expect(screen.getByText('Scan captured.')).toBeTruthy())
    fireEvent.click(screen.getAllByRole('button', { name: 'Heart' })[0])
    expect(screen.getByRole('heading', { name: 'Heart scan' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('Scan captured.')).toBeNull())
    expect(screen.getByRole('button', { name: /Capture now/ })).toBeTruthy()
  })
})
