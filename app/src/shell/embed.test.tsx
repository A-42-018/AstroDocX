// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Embed, EmbedBridge } from './Embed'
import { embedFromUrl, pageLabel, stickyEmbed } from './embedMode'

// the real pages need the demo database; the screen's own routing is what is under test
vi.mock('./pages', () => ({
  pageRoutes: () => [
    <Route key="board" path="/board" element={<p>board page</p>} />,
    <Route key="doctor" path="/doctor" element={<p>doctor page</p>} />,
    <Route key="nasa" path="/nasa" element={<p>nasa page</p>} />,
    <Route key="any" path="*" element={<p>unknown</p>} />,
  ],
}))
vi.mock('../board/hooks', () => ({ useSnapshot: () => null }))

afterEach(() => { cleanup(); document.documentElement.classList.remove('adx-engaged'); vi.restoreAllMocks() })

const open = (path: string, view: 'board' | 'vitals' = 'board') =>
  render(<MemoryRouter initialEntries={[path]}><EmbedBridge /><Embed view={view} crew={null} /></MemoryRouter>)

describe('embed mode', () => {
  it('reads the embed from the URL, and stays an embed when the query is gone', () => {
    expect(embedFromUrl('?embed=alerts&crew=eng')).toEqual({ view: 'alerts', crew: 'eng' })
    expect(embedFromUrl('?embed=nope')).toBeNull()
    expect(embedFromUrl('')).toBeNull()
    expect(stickyEmbed('?embed=trends')).toEqual({ view: 'trends', crew: null })
  })
  it('titles each page for the cabin bar', () => {
    expect(pageLabel('/vitals')).toBe('Live Vitals')
    expect(pageLabel('/doctor')).toBe('Crew Doctor')
    expect(pageLabel('/anything')).toBe('Status Board')
  })
})

describe('a cabin screen', () => {
  it('has a rail with every console page and Live Vitals', () => {
    open('/board')
    const rail = screen.getByRole('navigation', { name: 'Screens' })
    for (const name of ['Status Board', 'Live Vitals', 'Crew Doctor', 'Alerts', 'Trends', 'Check-in', 'Simulator', 'Ground Sync', 'Ground View', 'NASA Data'])
      expect(rail.querySelector(`[aria-label="${name}"]`), name).toBeTruthy()
  })
  it('opens another page from the rail and stays a screen (rail still there)', () => {
    open('/board')
    expect(screen.getByText('board page')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Crew Doctor'))
    expect(screen.getByText('doctor page')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Screens' })).toBeTruthy()
    expect(document.querySelector('main.embed-doctor')).toBeTruthy()
  })
  it('opens at its own page, Live Vitals included', () => {
    open('/', 'vitals')
    expect(document.querySelector('main.embed-vitals')).toBeTruthy() // the vitals page: loading, with no snapshot
  })
  it('never nests a cabin inside a screen', () => {
    open('/cabin')
    expect(screen.getByText('board page')).toBeTruthy()
  })
  it('scrolls only once the cabin says it is in use', () => {
    open('/board')
    const from = (data: unknown) => act(() => { window.dispatchEvent(new MessageEvent('message', { data, source: window.parent, origin: location.origin })) })
    expect(document.documentElement.classList.contains('adx-engaged')).toBe(false)
    from({ engaged: true })
    expect(document.documentElement.classList.contains('adx-engaged')).toBe(true)
    from({ engaged: false })
    expect(document.documentElement.classList.contains('adx-engaged')).toBe(false)
  })
  it('stays in use while the visitor moves between pages', () => {
    open('/board')
    act(() => { window.dispatchEvent(new MessageEvent('message', { data: { engaged: true }, source: window.parent, origin: location.origin })) })
    fireEvent.click(screen.getByLabelText('Crew Doctor'))
    expect(screen.getByText('doctor page')).toBeTruthy()
    expect(document.documentElement.classList.contains('adx-engaged')).toBe(true)
  })
  it('opens a page the cabin asks for, and ignores messages from elsewhere', () => {
    open('/board')
    act(() => { window.dispatchEvent(new MessageEvent('message', { data: { nav: '/nasa' }, source: window.parent, origin: 'https://elsewhere.example' })) })
    expect(screen.getByText('board page')).toBeTruthy()
    act(() => { window.dispatchEvent(new MessageEvent('message', { data: { nav: '/nasa' }, source: window.parent, origin: location.origin })) })
    expect(screen.getByText('nasa page')).toBeTruthy()
  })
  it('tells the cabin which page it is on, and passes Esc up while in use', () => {
    const up = vi.fn()
    const real = Object.getOwnPropertyDescriptor(window, 'parent')
    Object.defineProperty(window, 'parent', { configurable: true, value: { postMessage: up } })
    try {
      open('/board')
      expect(up).toHaveBeenCalledWith({ adxScreen: 'route', path: '/board', label: 'Status Board' }, location.origin)
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(up).not.toHaveBeenCalledWith({ adxScreen: 'escape' }, location.origin) // not in use: Esc is not the screen's
      document.documentElement.classList.add('adx-engaged')
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(up).toHaveBeenCalledWith({ adxScreen: 'escape' }, location.origin)
    } finally {
      if (real) Object.defineProperty(window, 'parent', real)
    }
  })
})
