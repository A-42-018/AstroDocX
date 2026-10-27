// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StatusPill } from '../shell/icons'
import { Button, buttonClass, Gauge, HudPanel, KpiCell, KpiGrid, Readout, Segmented, StateView, StatusTag, Switch } from '.'

afterEach(cleanup)

describe('HudPanel', () => {
  it('is a region named by its header, whose title is a real heading', () => {
    render(<HudPanel title="Readiness" meta="RIDGE · 5 HAZARDS"><p>body</p></HudPanel>)
    const region = screen.getByRole('region', { name: 'Readiness' })
    expect(within(region).getByRole('heading', { level: 2, name: 'Readiness' })).toBeTruthy()
    expect(region.textContent).toContain('RIDGE · 5 HAZARDS')
    expect(region.className).toBe('hp')
  })

  it('takes an explicit aria-label instead of a header, and lights up by tone', () => {
    render(<HudPanel aria-label="Next action" tone="act"><p>x</p></HudPanel>)
    const region = screen.getByRole('region', { name: 'Next action' })
    expect(region.classList.contains('tone-act')).toBe(true)
    expect(within(region).queryByRole('heading')).toBeNull()
  })

  it('hero panels add decorative brackets and rulers that stay out of the accessibility tree', () => {
    const { container } = render(<HudPanel title="Health twin" hero level={1} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Health twin' })).toBeTruthy()
    const deco = container.querySelectorAll('[aria-hidden="true"]')
    expect(deco.length).toBe(4 + 2 + 2) // brackets, rulers, header dot + rule
  })

  it('nominal and data tones keep the default cyan edge', () => {
    render(<><HudPanel aria-label="a" tone="nominal" /><HudPanel aria-label="b" tone="data" /></>)
    expect(screen.getByRole('region', { name: 'a' }).className).toBe('hp')
    expect(screen.getByRole('region', { name: 'b' }).className).toBe('hp')
  })
})

describe('StatusTag', () => {
  it('always carries the word, and StatusPill is the same component', () => {
    render(<><StatusTag status="act" /><StatusTag status="nominal" short /><StatusPill status="watch" /><StatusTag status="nominal" label="RESOLVED" /></>)
    expect(screen.getByText('ACT').className).toBe('tag st-act')
    expect(screen.getByText('NOM')).toBeTruthy()
    expect(screen.getByText('WATCH').className).toBe('tag st-watch')
    expect(screen.getByText('RESOLVED')).toBeTruthy()
    expect(StatusPill).toBe(StatusTag)
  })
})

describe('Button', () => {
  it('maps variant and size to classes', () => {
    expect(buttonClass()).toBe('hbtn')
    expect(buttonClass('ghost', 'lg', 'x')).toBe('hbtn ghost lg x')
  })

  it('is busy: aria-busy, disabled, a spinner, and the name is unchanged', () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>Sync now</Button>)
    const btn = screen.getByRole('button', { name: 'Sync now' })
    expect(btn.getAttribute('type')).toBe('button')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<Button onClick={onClick} busy>Sync now</Button>)
    expect(btn.getAttribute('aria-busy')).toBe('true')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    expect(btn.querySelector('.hbtn-spin')).toBeTruthy()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('KpiCell and Readout', () => {
  it('KPIs are a description list, so each value is read with its label', () => {
    const { container } = render(<KpiGrid><KpiCell label="Active alerts" value={3} status="act" /><KpiCell label="Baseline" value={62} sub="sd 3.1" /></KpiGrid>)
    const list = container.querySelector('dl.kpis') as HTMLElement
    expect(within(list).getByText('Active alerts').tagName).toBe('DT')
    expect(within(list).getByText('62').closest('dd')?.textContent).toBe('62sd 3.1')
  })

  it('a readout keeps value, unit, delta and meta as text', () => {
    render(<Readout value="58" unit="BPM" delta="-4 vs base" meta="Simulated" size="hero" />)
    const p = screen.getByText('58').closest('p')!
    expect(p.className).toBe('readout readout-hero')
    expect(p.textContent).toBe('58BPM-4 vs baseSimulated')
  })
})

describe('Gauge', () => {
  it('a dial is one image named in words, with the status tag in the centre', () => {
    const { container } = render(<Gauge kind="dial" value={83} unit="%" status="act" label="Crew readiness 83 percent, ACT" />)
    const img = screen.getByRole('img', { name: 'Crew readiness 83 percent, ACT' })
    expect(img.textContent).toContain('83%')
    expect(img.textContent).toContain('ACT')
    expect(container.querySelectorAll('.gauge-tick')).toHaveLength(41)
    expect(container.querySelectorAll('.gauge-tick.lit')).toHaveLength(34) // 0..33 of 40
    expect(container.querySelector('.gauge-arc')?.getAttribute('stroke-dasharray')).toBe('83 100')
  })

  it('a ring shows a status word and clamps the fill', () => {
    const { container } = render(<Gauge kind="ring" value={140} display="59" unit="BPM" status="nominal" word="IN BAND" label="Heart rate 59 BPM, in band" />)
    expect(screen.getByRole('img', { name: 'Heart rate 59 BPM, in band' }).textContent).toContain('IN BAND')
    expect(container.querySelectorAll('.gauge-tick')).toHaveLength(60)
    expect(container.querySelector('.gauge-arc')?.getAttribute('stroke-dasharray')).toBe('100 100')
  })

  it('two gauges never share a gradient id', () => {
    const { container } = render(<><Gauge kind="dial" value={10} label="a" /><Gauge kind="dial" value={20} label="b" /></>)
    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id)
    expect(new Set(ids).size).toBe(2)
  })
})

describe('Segmented', () => {
  function Range() {
    const [v, setV] = useState<'24h' | '7d'>('7d')
    return <Segmented label="Range" value={v} onChange={setV} options={[{ id: '24h', label: '24 H' }, { id: '7d', label: '7 days' }]} />
  }

  it('is a named group of toggle buttons with exactly one pressed', () => {
    render(<Range />)
    const group = screen.getByRole('group', { name: 'Range' })
    const [a, b] = within(group).getAllByRole('button')
    expect(a.getAttribute('aria-pressed')).toBe('false')
    expect(b.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(a)
    expect(a.getAttribute('aria-pressed')).toBe('true')
    expect(b.getAttribute('aria-pressed')).toBe('false')
  })

  it('with counts it is the stacked variant and the count is part of the name', () => {
    render(<Segmented label="Filter" value="act" onChange={() => {}} options={[{ id: 'active', label: 'Active', count: 3 }, { id: 'act', label: 'Act', count: 2, status: 'act' }]} />)
    expect(screen.getByRole('group', { name: 'Filter' }).className).toBe('seg seg-stacked')
    expect(screen.getByRole('button', { name: '2Act' }).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('StateView', () => {
  it('loading is a polite status that shows the real progress', () => {
    const { container } = render(<StateView kind="loading" label="Initializing demo mission data" progress={41.6} />)
    expect(screen.getByRole('status').textContent).toBe('Initializing demo mission data · 42%…')
    expect((container.querySelector('.scanbar span') as HTMLElement).style.width).toBe('42%')
  })

  it('loading without progress is indeterminate', () => {
    const { container } = render(<StateView kind="loading" label="Loading screen" />)
    expect(screen.getByRole('status').textContent).toBe('Loading screen…')
    expect(container.querySelector('.scanbar.indeterminate')).toBeTruthy()
  })

  it('error is an alert with a heading and actions; empty is a plain line', () => {
    render(<>
      <StateView kind="error" title="This screen hit an error" actions={<Button>Try again</Button>}><p>boom</p></StateView>
      <StateView kind="empty" label="No alerts" />
    </>)
    const alert = screen.getByRole('alert')
    expect(within(alert).getByRole('heading', { level: 1, name: 'This screen hit an error' })).toBeTruthy()
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(alert.textContent).toContain('boom')
    expect(screen.getByText('No alerts')).toBeTruthy()
  })
})

describe('Switch', () => {
  it('is a labelled switch that reports on/off', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange}>Auto-sync</Switch>)
    const sw = screen.getByRole('switch', { name: 'Auto-sync' })
    expect((sw as HTMLInputElement).checked).toBe(false)
    fireEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
