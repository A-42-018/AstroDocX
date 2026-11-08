import { useCallback, useEffect, useRef, useState } from 'react'
import { measureFrame } from './roi'
import { ScanSession, type SessionView } from './session'

/** Frames are shrunk to this before reading; a face patch is still hundreds of pixels. */
const W = 128, H = 96

export type CameraState = 'off' | 'starting' | 'on' | 'error'

/** A person-readable reason for a camera failure. */
export function cameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was blocked. Click the camera icon in the address bar (or open the browser’s site settings), choose Allow for this site, then reload and try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.'
  if (name === 'NotReadableError') return 'The camera is in use by another app. Close it and try again.'
  return 'The camera could not be started.'
}

/**
 * Open the front camera, read three skin patches per frame and feed a ScanSession. The video never leaves the device:
 * frames are drawn to a tiny canvas, reduced to three average colours, and discarded.
 */
export function useFaceScan() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<CameraState>('off')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [view, setView] = useState<SessionView>(ScanSession.initial)
  const session = useRef(new ScanSession())
  const stream = useRef<MediaStream | null>(null)
  const loop = useRef(0)
  const alive = useRef(true)

  const halt = useCallback(() => {
    const v = videoRef.current
    if (v && 'cancelVideoFrameCallback' in v) v.cancelVideoFrameCallback(loop.current)
    cancelAnimationFrame(loop.current)
    loop.current = 0
  }, [])

  const stop = useCallback(() => {
    halt()
    // a run that was cut short has no result: drop its half-finished numbers
    if (session.current.state.phase !== 'done') { session.current = new ScanSession(); setView(session.current.state) }
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    const v = videoRef.current
    if (v) v.srcObject = null
    setCamera('off')
  }, [halt])

  /** A fresh run on the same open camera. */
  const again = useCallback(() => { session.current = new ScanSession(); setView(session.current.state) }, [])

  const start = useCallback(async () => {
    if (stream.current) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(window.isSecureContext ? 'This browser has no camera access.' : 'The camera needs a secure (https) connection.')
      return setCamera('error')
    }
    setError(''); setNotice(''); setCamera('starting'); again()
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } })
      if (!alive.current) return s.getTracks().forEach((t) => t.stop())
      stream.current = s
      const v = videoRef.current
      if (!v) { s.getTracks().forEach((t) => t.stop()); stream.current = null; return setCamera('off') }
      v.srcObject = s
      v.muted = true
      await v.play()
      setCamera('on')
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('canvas')
      // one sample per real camera frame where the browser says so (the frame's own time), else per animation frame
      const own = 'requestVideoFrameCallback' in v
      const schedule = () => { loop.current = own ? v.requestVideoFrameCallback(tick) : requestAnimationFrame(tick) }
      const tick = (now: number) => {
        schedule()
        if (v.readyState < 2 || !v.videoWidth) return
        // a centre 4:3 crop, matching how the video is shown, so the patches sit where the guide says
        const sw = Math.min(v.videoWidth, (v.videoHeight * 4) / 3), sh = (sw * 3) / 4
        ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, W, H)
        const m = measureFrame(ctx.getImageData(0, 0, W, H).data, W, H)
        if (session.current.feed(m, now)) setView(session.current.state)
      }
      schedule()
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null
      setError(cameraError(e)); setCamera('error')
    }
  }, [again])

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; halt(); stream.current?.getTracks().forEach((t) => t.stop()) }
  }, [halt])

  // a hidden tab stops delivering frames and the run is lost anyway: let go of the camera, so its light goes off
  useEffect(() => {
    const hide = () => { if (document.hidden && stream.current) { setNotice('The scan stopped because this tab was hidden. Start again and keep this tab open.'); stop() } }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [stop])

  return { videoRef, camera, error, notice, view, start, stop, again }
}
