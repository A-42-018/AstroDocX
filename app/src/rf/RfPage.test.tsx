// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import RfPage from './RfPage'

vi.mock('../board/hooks', () => ({
  useSnapshot: () => ({ crew: [{ id: 'c1', name: 'Commander', role: 'CDR' }], crewId: 'c1', now: 5000 }),
}))
vi.mock('../board/store', () => ({ useBoard: (sel: (s: unknown) => unknown) => sel({ boot: { state: 'ready', done: 0, total: 0 } }) }))

// a still page: no animation loop, so the test controls what is on screen
beforeAll(() => {
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
})
afterEach(cleanup)

const open = () => render(<MemoryRouter><RfPage /></MemoryRouter>)

describe('RfPage', () => {
  it('opens full of signal with a breathing rate near the console reading, and says it is simulated', async () => {
    open()
    expect(screen.getByRole('heading', { name: 'Breathing from the cabin Wi-Fi' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText('Simulated · experimental')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Clear breathing rhythm')).toBeTruthy())
    expect(document.querySelector('.ro-value')?.textContent).toBe('14')
  })

  it('explains why it holds back when a crewmate passes, and shows nothing for an empty cabin', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Crewmate passes' }))
    expect(screen.getByText(/Another person is moving nearby/)).toBeTruthy()
    expect(document.querySelector('.ro-value')?.textContent).toBe('—')
    fireEvent.click(screen.getByRole('button', { name: 'Empty cabin' }))
    expect(screen.getByText('No one detected in the sensing zone')).toBeTruthy()
  })

  it('a breathing pause raises a suggestion that links to the lung scan', () => {
    open()
    expect(screen.queryByRole('link', { name: /Start lung scan/ })).toBeNull() // nothing suggested while breathing is normal
    fireEvent.click(screen.getByRole('button', { name: 'Breathing pause' }))
    expect(screen.getByText('Breathing movement has stopped')).toBeTruthy()
    const link = screen.getByRole('link', { name: /Start lung scan/ })
    expect(link.getAttribute('href')).toBe('/ultrasound?exam=lung&from=rf')
  })

  it('never claims a heart rate from Wi-Fi alone', () => {
    open()
    expect(screen.getByText('needs watch')).toBeTruthy()
  })

  it('offers the 3D cabin and the plan view, and does not build the 3D scene until it is near the screen', () => {
    open()
    expect(screen.getByRole('button', { name: '3D cabin' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('3D cabin loads when you scroll here')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Plan view' }))
    expect(screen.getByText(/How the scan works, from above/)).toBeTruthy()
  })
})
