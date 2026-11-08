import { useEffect, useRef } from 'react'
import { useHidden, useReducedMotion } from '../live/usePaused'

/**
 * The holo-pedestal under VITA: a light cone rising from a disc of concentric rings, dashed arcs turning against each
 * other and motes drifting up the beam. Brighter while she talks. Drawn on a canvas in fractions of its size, so it
 * scales; with reduced motion it is drawn once, still. Decorative.
 */
export function Pedestal({ talking = false, width = 420, height = 300 }: { talking?: boolean; width?: number; height?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const talk = useRef(talking)
  const reduced = useReducedMotion()
  const hidden = useHidden()
  useEffect(() => { talk.current = talking }, [talking])
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)

  useEffect(() => {
    const el = canvas.current
    const g = el?.getContext('2d')
    if (!el || !g) return
    const motes = Array.from({ length: 46 }, (_, i) => ({ x: Math.sin(i * 12.9898) * 0.5, s: 0.25 + ((i * 7919) % 100) / 130, o: (i * 0.137) % 1 }))
    let raf = 0, glow = talk.current ? 1 : 0
    const draw = (t: number) => {
      const W = el.width, H = el.height, cx = W / 2, base = H * 0.8, R = W * 0.36
      glow += ((talk.current ? 1 : 0) - glow) * 0.06
      const a = 0.75 + glow * 0.25 + (reduced ? 0 : Math.sin(t / 900) * 0.05)
      g.clearRect(0, 0, W, H)
      g.globalCompositeOperation = 'lighter'
      // the beam
      const beam = g.createLinearGradient(0, base, 0, 0)
      beam.addColorStop(0, `rgba(54, 226, 245, ${0.32 * a})`)
      beam.addColorStop(0.55, `rgba(54, 226, 245, ${0.08 * a})`)
      beam.addColorStop(1, 'rgba(54, 226, 245, 0)')
      g.fillStyle = beam
      g.beginPath(); g.moveTo(cx - R * 0.62, base); g.lineTo(cx - R * 0.95, 0); g.lineTo(cx + R * 0.95, 0); g.lineTo(cx + R * 0.62, base); g.closePath(); g.fill()
      // motes rising
      for (const m of motes) {
        const k = reduced ? m.o : (m.o + t / (5200 / m.s)) % 1
        const y = base - k * base * 0.95, x = cx + m.x * R * (1.25 - k * 0.5)
        g.fillStyle = `rgba(159, 244, 255, ${(1 - k) * 0.55 * a})`
        g.fillRect(x, y, 1.6 * dpr, 1.6 * dpr)
      }
      // the disc: a soft pool, then rings
      const pool = g.createRadialGradient(cx, base, 0, cx, base, R * 1.1)
      pool.addColorStop(0, `rgba(120, 240, 255, ${0.5 * a})`)
      pool.addColorStop(0.35, `rgba(54, 226, 245, ${0.22 * a})`)
      pool.addColorStop(1, 'rgba(54, 226, 245, 0)')
      g.fillStyle = pool
      g.beginPath(); g.ellipse(cx, base, R * 1.1, R * 0.3, 0, 0, Math.PI * 2); g.fill()
      g.lineCap = 'round'
      const rings = [[0.38, 2.2, 0], [0.62, 1.4, 1], [0.86, 1.8, -1], [1.02, 1, 0.6]] as const
      rings.forEach(([r, w, spin], i) => {
        g.strokeStyle = `rgba(${i ? '54, 226, 245' : '159, 244, 255'}, ${(0.85 - i * 0.14) * a})`
        g.lineWidth = w * dpr
        g.shadowColor = 'rgba(54, 226, 245, 0.9)'; g.shadowBlur = 10 * dpr
        if (!spin) { g.beginPath(); g.ellipse(cx, base, R * r, R * r * 0.27, 0, 0, Math.PI * 2); g.stroke(); return }
        const rot = reduced ? 0 : (t / 4000) * spin
        for (let k = 0; k < 3; k++) {
          const s = rot + (k * Math.PI * 2) / 3
          g.beginPath(); g.ellipse(cx, base, R * r, R * r * 0.27, 0, s, s + Math.PI * 0.42); g.stroke()
        }
      })
      g.shadowBlur = 0
      // the scan line sweeping up the beam
      if (!reduced) {
        const k = (t / 2600) % 1, y = base - k * base * 0.9
        g.fillStyle = `rgba(159, 244, 255, ${0.18 * (1 - k) * a})`
        g.fillRect(cx - R * (0.62 + k * 0.33), y, R * 2 * (0.62 + k * 0.33), 1.2 * dpr)
      }
      g.globalCompositeOperation = 'source-over'
      if (!reduced && !hidden) raf = requestAnimationFrame(draw)
    }
    draw(performance.now())
    return () => cancelAnimationFrame(raf)
  }, [reduced, hidden, dpr])

  return <canvas ref={canvas} className="dr-pedestal" width={Math.round(width * dpr)} height={Math.round(height * dpr)} style={{ width, height }} aria-hidden="true" />
}
