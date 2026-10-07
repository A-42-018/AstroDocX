import { liveQuery } from 'dexie'
import { useEffect, useRef, useState } from 'react'
import { db, openAlerts } from '../data/db'
import type { Status } from '../data/types'
import { useBoard } from '../board/store'
import { COMPOSITE, SURFACE, VERT } from './backdropShaders'

/** The selected crew member's worst open alert (one indexed read), used to set the mood of the sky. */
function useCrewStatus(): Status {
  const crewId = useBoard((s) => s.crewId)
  const ready = useBoard((s) => s.boot.state === 'ready')
  const [status, setStatus] = useState<Status>('nominal')
  useEffect(() => {
    if (!ready) return
    const sub = liveQuery(async () => {
      const id = crewId ?? (await db.crew.toCollection().first())?.id
      const alerts = id ? await openAlerts(id) : []
      return alerts.some((a) => a.status === 'act') ? 'act' : alerts.length ? 'watch' : 'nominal'
    }).subscribe({ next: (s) => setStatus(s as Status), error: () => undefined })
    return () => sub.unsubscribe()
  }, [crewId, ready])
  return status
}


/** Warm golden sunrise when nominal, paler when there is a Watch, cool and dimmer with an Act. */
const MOOD: Record<Status, number> = { nominal: 1, watch: 0.55, act: 0 }

/** Sharp pass: device pixels up to 4K (3840 × 2160). Soft surface pass: this fraction of the sharp pass. */
const MAX_PIXELS = 3840 * 2160
const SURFACE_SCALE = 0.5
const FPS = 30
/** Start mid-sunrise so the first frame already looks good. */
const START = 40

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
  return s
}

function program(gl: WebGLRenderingContext, frag: string) {
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag))
  gl.bindAttribLocation(p, 0, 'a')
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
  return p
}

/**
 * Live orbital-sunrise backdrop (WebGL, no images): see backdropShaders.ts. Runs at 30 fps, pauses when the tab is
 * hidden, and draws one still frame for people who prefer reduced motion. Without WebGL the CSS gradient behind
 * the canvas is the fallback. Decorative only, so it is hidden from assistive tech.
 */
export function Backdrop() {
  const status = useCrewStatus()
  const canvas = useRef<HTMLCanvasElement>(null)
  const mood = useRef(MOOD[status])
  const target = useRef(MOOD[status])
  useEffect(() => { target.current = MOOD[status] }, [status])

  useEffect(() => {
    const el = canvas.current
    // jsdom (tests) has no WebGL; skip quietly.
    if (!el || /jsdom/i.test(navigator.userAgent)) return
    const gl = el.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' })
    // No WebGL: hide the canvas so the CSS dawn gradient shows.
    const fail = () => { el.style.display = 'none' }
    if (!gl) return fail()
    let surfProg: WebGLProgram, compProg: WebGLProgram
    try {
      surfProg = program(gl, SURFACE)
      compProg = program(gl, COMPOSITE)
    } catch {
      return fail()
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    // Offscreen texture for the soft surface pass (linear filtering smooths the upscale).
    const tex = gl.createTexture()
    const fbo = gl.createFramebuffer()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)

    const u = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n)
    const uS = { res: u(surfProg, 'u_res'), time: u(surfProg, 'u_time'), mood: u(surfProg, 'u_mood') }
    const uC = { res: u(compProg, 'u_res'), time: u(compProg, 'u_time'), mood: u(compProg, 'u_mood'), surf: u(compProg, 'u_surf'), dpr: u(compProg, 'u_dpr') }

    let sw = 1, sh = 1, dpr = 1
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      let w = el.clientWidth * dpr, h = el.clientHeight * dpr
      const over = Math.sqrt((w * h) / MAX_PIXELS)
      if (over > 1) { w /= over; h /= over; dpr /= over }
      el.width = Math.max(1, Math.round(w))
      el.height = Math.max(1, Math.round(h))
      sw = Math.max(1, Math.round(el.width * SURFACE_SCALE))
      sh = Math.max(1, Math.round(el.height * SURFACE_SCALE))
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    }
    let lastT = START
    const draw = (t: number) => {
      lastT = t
      mood.current += (target.current - mood.current) * 0.04
      // Pass 1: soft surface into the texture.
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.viewport(0, 0, sw, sh)
      gl.useProgram(surfProg)
      gl.uniform2f(uS.res, sw, sh); gl.uniform1f(uS.time, t); gl.uniform1f(uS.mood, mood.current)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      // Pass 2: sharp composite to the screen.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, el.width, el.height)
      gl.useProgram(compProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(uC.surf, 0)
      gl.uniform2f(uC.res, el.width, el.height); gl.uniform1f(uC.time, t); gl.uniform1f(uC.mood, mood.current); gl.uniform1f(uC.dpr, dpr)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    resize()
    // Resizing clears the canvas, so redraw straight away (the loop may be paused in a hidden tab).
    const ro = new ResizeObserver(() => { resize(); draw(lastT) })
    ro.observe(el)

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      mood.current = target.current
      draw(START)
      // Keep the mood in step with crew status without animating.
      const id = setInterval(() => { mood.current = target.current; draw(START) }, 2000)
      return () => { clearInterval(id); ro.disconnect() }
    }
    // Draw the first frame now, even if the tab starts hidden, so the sky is never black.
    draw(START)
    let raf = 0
    let last = 0
    const t0 = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || now - last < 1000 / FPS - 2) return
      last = now
      draw(START + (now - t0) / 1000)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <div className={`backdrop tint-${status}`} aria-hidden="true">
      <canvas ref={canvas} className="bd-canvas" />
      <div className="bd-scrim" />
    </div>
  )
}
