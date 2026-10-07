import { useEffect, useRef } from 'react'
import { RANGE, WaveGenerator, type WaveKind } from './waves'
import { useHidden, useReducedMotion } from './usePaused'

const SPEED = 110 // CSS px per second the trace scrolls
const FPS = 30

interface Props {
  kind: WaveKind
  /** Beats or breaths per minute to follow. */
  rate: number
  /** Sd of cycle length as a fraction (beat-to-beat variability). */
  variability?: number
  seed: number
  height?: number
  /** Called at the start of every cycle (used to pulse the heart icon in step with the ECG). */
  onBeat?: () => void
}

/**
 * Scrolling canvas trace with a glowing leading dot. Decorative (aria-hidden): the numbers next to it carry
 * the information. Draws at 30 fps, only while on screen and the tab is visible; with reduced motion it
 * draws one still frame.
 */
export function LiveWave({ kind, rate, variability = 0.025, seed, height = 64, onBeat }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef({ rate, variability, onBeat })
  useEffect(() => { live.current = { rate, variability, onBeat } })
  const reduced = useReducedMotion()
  const hidden = useHidden()

  useEffect(() => {
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const color = getComputedStyle(cv).getPropertyValue('--data').trim() || '#2dd4e8'
    const gen = new WaveGenerator(kind, seed, live.current.rate)
    const [lo, hi] = RANGE[kind]
    let w = 0
    let buf = new Float32Array(0)
    let head = 0
    let visible = true
    let raf = 0
    let last = 0
    let carry = 0

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const box = cv.getBoundingClientRect()
      w = Math.max(1, Math.floor(box.width))
      cv.width = Math.floor(box.width * dpr)
      cv.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      buf = new Float32Array(w).fill(lo)
      head = 0
    }
    const push = (dt: number, beats: boolean) => {
      const s = gen.next(dt, live.current.rate, live.current.variability)
      buf[head] = s.value
      head = (head + 1) % w
      if (s.beat && beats) live.current.onBeat?.()
    }
    const y = (v: number) => height - 6 - ((v - lo) / (hi - lo)) * (height - 12)
    const draw = () => {
      ctx.clearRect(0, 0, w, height)
      const g = ctx.createLinearGradient(0, 0, w, 0)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(0.35, color + '66')
      g.addColorStop(1, color)
      ctx.strokeStyle = g
      ctx.lineWidth = 1.8
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i < w; i++) {
        const v = buf[(head + i) % w]
        if (i === 0) ctx.moveTo(0, y(v)); else ctx.lineTo(i, y(v))
      }
      ctx.stroke()
      const tip = buf[(head + w - 1) % w]
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(w - 2, y(tip), 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible || now - last < 1000 / FPS - 1) return
      const dt = Math.min((now - last) / 1000, 0.25)
      last = now
      carry += dt * SPEED
      const n = Math.floor(carry)
      carry -= n
      for (let i = 0; i < n; i++) push(1 / SPEED, true)
      draw()
    }

    size()
    // Pre-fill so the trace is full the moment it appears.
    for (let i = 0; i < w * 2; i++) push(1 / SPEED, false)
    draw()
    if (reduced || hidden) return
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { size(); for (let i = 0; i < w * 2; i++) push(1 / SPEED, false); draw() }) : null
    ro?.observe(cv)
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((e) => { visible = e[0]?.isIntersecting ?? true }) : null
    io?.observe(cv)
    last = performance.now()
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); io?.disconnect() }
  }, [kind, seed, height, reduced, hidden])

  return <canvas ref={canvas} className="live-wave" style={{ height }} aria-hidden="true" />
}
