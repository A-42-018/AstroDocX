// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WatchControl } from './WatchControl'
import { useWatch } from './store'

const base = useWatch.getState()
const set = (s: Partial<typeof base>) => useWatch.setState({ ...base, ...s })

afterEach(() => { cleanup(); useWatch.setState(base, true) })

describe('WatchControl', () => {
  it('says so where Web Bluetooth does not exist, with no button', () => {
    set({ status: 'unsupported' })
    render(<WatchControl />)
    expect(screen.getByText(/needs Chrome or Edge/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offers Connect when idle and starts a connection on click', () => {
    const connect = vi.fn(async () => {})
    set({ status: 'idle', connect })
    render(<WatchControl />)
    fireEvent.click(screen.getByRole('button', { name: 'Connect watch' }))
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('shows the reason a connection failed', () => {
    set({ status: 'idle', note: 'No watch was chosen.' })
    render(<WatchControl />)
    expect(screen.getByRole('status').textContent).toMatch(/No watch was chosen/)
  })

  it('disables the button and marks it busy while picking or connecting', () => {
    set({ status: 'picking' })
    render(<WatchControl />)
    const b = screen.getByRole('button', { name: /Choose your watch/ }) as HTMLButtonElement
    expect(b.disabled).toBe(true)
    expect(b.getAttribute('aria-busy')).toBe('true')
  })

  it('tells the wearer to open the heart rate screen until values arrive, then says it is streaming', () => {
    set({ status: 'connected', name: 'HAYLOU Solar 5', hr: null })
    const { rerender } = render(<WatchControl />)
    expect(screen.getByRole('status').textContent).toMatch(/open the heart rate screen on the watch/)
    set({ status: 'connected', name: 'HAYLOU Solar 5', hr: 69 })
    rerender(<WatchControl />)
    expect(screen.getByRole('status').textContent).toMatch(/streaming heart rate/)
  })

  it('disconnects from the connected state', () => {
    const disconnect = vi.fn()
    set({ status: 'connected', name: 'HAYLOU Solar 5', disconnect })
    render(<WatchControl />)
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect watch' }))
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})
