// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScrollCue, showScrollCue, type CueState } from './ScrollCue'

afterEach(cleanup)

const ready: CueState = { settled: true, visorDown: true, stop: 0, moved: false, floating: false, busy: false, touring: false }

describe('showScrollCue', () => {
  it('is up on the helmet stop once the HUD has booted', () => {
    expect(showScrollCue(ready)).toBe(true)
  })
  it('waits for the arrival and the visor glass', () => {
    expect(showScrollCue({ ...ready, settled: false })).toBe(false)
    expect(showScrollCue({ ...ready, visorDown: false })).toBe(false)
  })
  it('is for the first move only', () => {
    expect(showScrollCue({ ...ready, moved: true })).toBe(false)
    expect(showScrollCue({ ...ready, stop: 3 })).toBe(false)
  })
  it('stays out of the way of float mode, a screen or crew card, and the guided tour', () => {
    expect(showScrollCue({ ...ready, floating: true })).toBe(false)
    expect(showScrollCue({ ...ready, busy: true })).toBe(false)
    expect(showScrollCue({ ...ready, touring: true })).toBe(false)
  })
})

describe('ScrollCue', () => {
  it('asks a mouse or trackpad visitor to scroll', () => {
    const { container } = render(<ScrollCue touch={false} onGo={() => {}} />)
    expect(screen.getByRole('button', { name: 'Scroll to float forward' })).toBeTruthy()
    expect(container.querySelector('.cue-mouse')).not.toBeNull()
  })
  it('asks a touch visitor to tap, and floating forward is what the tap does', () => {
    const go = vi.fn()
    const { container } = render(<ScrollCue touch onGo={go} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tap to float forward' }))
    expect(go).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.cue-mouse')).toBeNull()
  })
})
