// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MISSION_START } from '../data/synthetic'
import { BottomTabs, Rail, TopBar } from './Chrome'
import { CrewSwitcher } from './CrewSwitcher'
import type { ShellData } from './useShellData'

afterEach(cleanup)

const data: ShellData = {
  crewId: 'eng', now: MISSION_START + 8 * 3600_000, pendingSync: 2, sinceSyncH: 3.5,
  crew: [
    { id: 'cmdr', name: 'Commander', role: 'Commander', status: 'nominal', alerts: 0, readiness: 95, worstHazard: null },
    { id: 'eng', name: 'Flight Engineer', role: 'Flight Engineer', status: 'act', alerts: 2, readiness: 61, worstHazard: 'Gravity' },
  ],
}

describe('navigation', () => {
  it('rail links to all seven screens and marks the current one', () => {
    render(<MemoryRouter initialEntries={['/trends']}><Rail /></MemoryRouter>)
    const nav = screen.getByRole('navigation', { name: 'Crew Console' })
    expect(within(nav).getAllByRole('link')).toHaveLength(7)
    expect(within(nav).getByRole('link', { name: 'Trends' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: 'Ground Sync' }).getAttribute('href')).toBe('/sync')
  })

  it('phone tabs: four screens plus a More sheet that closes on Escape', () => {
    render(<MemoryRouter initialEntries={['/board']}><BottomTabs /></MemoryRouter>)
    expect(screen.getAllByRole('link')).toHaveLength(4)
    const more = screen.getByRole('button', { name: 'More screens' })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(more)
    expect(more.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(expect.arrayContaining(['Simulator', 'Ground Sync', 'Ground View']))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(document.activeElement).toBe(more)
  })
})

describe('top bar', () => {
  it('greets the selected person and shows clock, link and alert count in words', () => {
    render(<MemoryRouter><TopBar data={data} install={null} /></MemoryRouter>)
    expect(screen.getByText(/Good morning,/).textContent).toContain('Flight Engineer')
    expect(screen.getByText('D0 08:00 MET')).toBeTruthy()
    expect(screen.getByRole('link', { name: /^Ground link: Link (open|closed)/ }).getAttribute('href')).toBe('/sync')
    expect(screen.getByRole('link', { name: '2 open alerts for Flight Engineer' }).getAttribute('href')).toBe('/alerts')
  })

  it('shows only the greeting placeholder until data arrives, and an install button when offered', () => {
    const install = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<MemoryRouter><TopBar data={null} install={null} /></MemoryRouter>)
    expect(screen.getByText('Starting up…')).toBeTruthy()
    rerender(<MemoryRouter><TopBar data={data} install={install} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /Install/ }))
    expect(install).toHaveBeenCalled()
  })
})

describe('crew switcher', () => {
  it('names status in words, switches on click and moves with arrow keys', () => {
    const onSelect = vi.fn()
    render(<CrewSwitcher crew={data.crew} crewId="eng" onSelect={onSelect} />)
    const btns = within(screen.getByRole('group', { name: 'Crew member' })).getAllByRole('button')
    expect(btns.map((b) => b.querySelector('.sr-only')?.textContent)).toEqual(['Commander, Nominal', 'Flight Engineer, Act, 2 open alerts'])
    expect(within(screen.getByRole('group', { name: 'Crew member' })).getByRole('button', { name: 'Flight Engineer, Act, 2 open alerts' })).toBe(btns[1])
    expect(btns.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
    fireEvent.click(btns[0])
    expect(onSelect).toHaveBeenCalledWith('cmdr')
    btns[1].focus()
    fireEvent.keyDown(btns[1], { key: 'ArrowRight' })
    expect(document.activeElement).toBe(btns[0])
  })
})
