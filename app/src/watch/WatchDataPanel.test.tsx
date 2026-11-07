// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WatchDataPanel } from './WatchDataPanel'
import { useWatch } from './store'

const base = useWatch.getState()
const set = (s: Partial<typeof base>) => useWatch.setState({ ...base, ...s })

afterEach(() => { cleanup(); useWatch.setState(base, true) })

describe('WatchDataPanel', () => {
  it('toggles opt-in saving of watch data', () => {
    const setSaveOptIn = vi.fn()
    set({ saveOptIn: false, setSaveOptIn })
    render(<WatchDataPanel />)
    const checkbox = screen.getByLabelText(/Save watch data on this device/) as HTMLInputElement
    expect(checkbox.checked).toBe(false)
    fireEvent.click(checkbox)
    expect(setSaveOptIn).toHaveBeenCalledWith(true, undefined)
  })

  it('links the watch to the selected crew member when saving is turned on', () => {
    const setSaveOptIn = vi.fn()
    set({ saveOptIn: false, setSaveOptIn })
    render(<WatchDataPanel crewId="pilot" />)
    fireEvent.click(screen.getByLabelText(/Save watch data on this device/))
    expect(setSaveOptIn).toHaveBeenCalledWith(true, 'pilot')
  })

  it('offers to relink when saved data belongs to someone else, and stays quiet for the wearer', () => {
    const setWearer = vi.fn()
    set({ saveOptIn: true, wearerId: 'cmdr', setWearer })
    const { unmount } = render(<WatchDataPanel crewId="pilot" />)
    expect(screen.getByText(/belongs to another crew member/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Link the watch to this crew member' }))
    expect(setWearer).toHaveBeenCalledWith('pilot')
    unmount()
    set({ saveOptIn: true, wearerId: 'pilot' })
    render(<WatchDataPanel crewId="pilot" />)
    expect(screen.queryByRole('button', { name: 'Link the watch to this crew member' })).toBeNull()
  })

  it('stays off the live heart-rate card', async () => {
    const { WatchControl } = await import('./WatchControl')
    set({ status: 'connected', name: 'HAYLOU Solar 5' })
    render(<WatchControl />)
    expect(screen.queryByLabelText(/Save watch data on this device/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete watch data' })).toBeNull()
  })
})
