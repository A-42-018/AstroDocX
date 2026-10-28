// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MISSION_START } from '../data/synthetic'
import { BottomTabs, StatusBar, TopBar, TopTabs } from './Chrome'
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
  it('top tabs link to all seven screens in two groups and mark the current one', () => {
    render(<MemoryRouter initialEntries={['/trends']}><TopTabs alerts={3} /></MemoryRouter>)
    const nav = screen.getByRole('navigation', { name: 'Crew Console' })
    expect(within(nav).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/board', '/alerts', '/trends', '/checkin', '/simulator', '/sync', '/ground'])
    expect(within(nav).getByRole('link', { name: 'Trends' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: 'Ground Sync' }).textContent).toBe('Sync')
    expect(within(nav).getByRole('link', { name: 'Alerts' }).textContent).toBe('Alerts3')
    expect(nav.querySelectorAll('.tt-sep')).toHaveLength(1)
  })

  it('phone tabs: four screens plus a More sheet that is a dialog, takes focus and closes on Escape', () => {
    render(<MemoryRouter initialEntries={['/board']}><BottomTabs /></MemoryRouter>)
    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('link', { name: 'Check-in' }).textContent).toBe('Check')
    const more = screen.getByRole('button', { name: 'More screens' })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(more)
    expect(more.getAttribute('aria-expanded')).toBe('true')
    const sheet = screen.getByRole('dialog', { name: 'More screens' })
    expect(within(sheet).getAllByRole('link').map((l) => l.textContent)).toEqual(['Simulator', 'Ground Sync', 'Ground View'])
    expect(document.activeElement).toBe(within(sheet).getAllByRole('link')[0])
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('Ground Sync')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(document.activeElement).toBe(more)
  })
})

describe('top bar', () => {
  it('greets the selected person and shows clock, link and alert count in words', () => {
    render(<MemoryRouter initialEntries={['/board']}><TopBar data={data} install={null} /></MemoryRouter>)
    expect(screen.getByText(/Good morning,/).textContent).toContain('Flight Engineer')
    expect(screen.getByText('Status Board')).toBeTruthy()
    expect(screen.getAllByText('D0 08:00').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /^Ground link: Link (open|closed)/ }).getAttribute('href')).toBe('/sync')
    expect(screen.getByRole('link', { name: '2 open alerts for Flight Engineer' }).getAttribute('href')).toBe('/alerts')
  })

  it('shows only the greeting placeholder until data arrives', () => {
    render(<MemoryRouter><TopBar data={null} install={null} /></MemoryRouter>)
    expect(screen.getByText('Starting up…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull()
  })

  it('keeps Run demo, the backdrop, Install and the landing link in the ⋯ menu', () => {
    const install = vi.fn().mockResolvedValue(undefined)
    render(<MemoryRouter><TopBar data={data} install={install} /></MemoryRouter>)
    const btn = screen.getByRole('button', { name: 'More options' })
    fireEvent.click(btn)
    const menu = screen.getByRole('dialog', { name: 'More options' })
    expect(document.activeElement).toBe(within(menu).getByRole('button', { name: /Run demo/ }))
    expect(within(menu).getByRole('link', { name: /Back to landing/ }).getAttribute('href')).toBe('/')
    expect(within(menu).getByRole('group', { name: 'Backdrop for Flight Engineer' })).toBeTruthy()
    fireEvent.click(within(menu).getByRole('button', { name: /Install/ }))
    expect(install).toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'More options' })).toBeNull()
    fireEvent.click(btn)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog', { name: 'More options' })).toBeNull()
  })
})

describe('status bar', () => {
  it('shows the link state, last sync, mission time and the disclaimer', () => {
    render(<StatusBar data={data} />)
    const bar = screen.getByRole('contentinfo')
    expect(bar.textContent).toMatch(/^Ground link (open|closed).* · synced 3\.5 h ago/)
    expect(bar.textContent).toContain('D0 08:00 MET · Prototype, not a medical device.')
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
