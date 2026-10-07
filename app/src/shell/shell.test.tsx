// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import { requestPersistentStorage, useInstallPrompt } from './install'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('ErrorBoundary', () => {
  let fail = true
  const Flaky = () => { if (fail) throw new Error('boom'); return <p>screen ok</p> }

  it('shows the error with recovery options, and Try again re-renders the screen', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fail = true
    render(<ErrorBoundary><Flaky /></ErrorBoundary>)
    expect(screen.getByRole('alert').textContent).toContain('boom')
    expect(screen.queryByRole('button', { name: 'Reset demo data' })).toBeNull()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('screen ok')).toBeTruthy()
  })

  it('resets only after the crew confirms', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fail = true
    const onReset = vi.fn().mockResolvedValue(undefined)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<ErrorBoundary onReset={onReset}><Flaky /></ErrorBoundary>)
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo data' }))
    expect(onReset).not.toHaveBeenCalled()
    fail = false
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reset demo data' })) })
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(screen.getByText('screen ok')).toBeTruthy()
  })
})

describe('useInstallPrompt', () => {
  it('is null until the browser offers installation, then prompts once', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current).toBeNull()
    const evt = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    act(() => { window.dispatchEvent(evt) })
    expect(evt.defaultPrevented).toBe(true)
    expect(result.current).toBeTypeOf('function')
    await act(async () => { await result.current!() })
    expect(evt.prompt).toHaveBeenCalledTimes(1)
    expect(result.current).toBeNull()
  })
})

describe('requestPersistentStorage', () => {
  it('asks only when not yet persisted and tolerates missing support', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    const persisted = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    Object.defineProperty(navigator, 'storage', { value: { persist, persisted }, configurable: true })
    expect(await requestPersistentStorage()).toBe(true)
    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).toHaveBeenCalledTimes(1)
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true })
    expect(await requestPersistentStorage()).toBe(false)
  })
})
