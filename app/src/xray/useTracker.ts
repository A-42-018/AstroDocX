/**
 * The mirror's camera and trackers: opens the front camera and runs MediaPipe's face and hand landmarkers on every
 * frame, on this device (WebGL where it can, else the CPU). Nothing is sent anywhere: each frame goes to the trackers
 * and is dropped. The tracker files are served with the app from /xray/mediapipe/ and load only when the mirror starts.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FaceLandmarker, HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'
import { cameraError } from '../scan/useFaceScan'

export type MirrorState = 'off' | 'loading' | 'on' | 'error'

export interface TrackFrame {
  /** The live video element, for features that read its pixels (the vital-sign readout). */
  video?: HTMLVideoElement
  /** The video's own size in pixels (the overlay is laid out in it). */
  vw: number
  vh: number
  now: number
  face: { lm: NormalizedLandmark[]; matrix: ArrayLike<number> | null; jaw: number } | null
  /** `right` is the subject's own right hand. */
  hands: { lm: NormalizedLandmark[]; right: boolean }[]
}

const FILES = `${import.meta.env.BASE_URL}xray/mediapipe`
/**
 * MediaPipe names a hand as if the picture were a mirrored selfie. The trackers here get the camera's own (unmirrored)
 * picture, so its "Left" is the subject's right hand.
 */
const LABEL_IS_SWAPPED = true

interface Trackers { face: FaceLandmarker; hand: HandLandmarker }
let trackers: Promise<Trackers> | null = null

/** Loads both trackers once per visit (they stay for the next start), on the GPU if it works, else the CPU. */
function loadTrackers(): Promise<Trackers> {
  trackers ??= (async () => {
    const { FilesetResolver, FaceLandmarker, HandLandmarker } = await import('@mediapipe/tasks-vision')
    const files = await FilesetResolver.forVisionTasks(FILES)
    const make = (delegate: 'GPU' | 'CPU') => Promise.all([
      FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${FILES}/face_landmarker.task`, delegate },
        runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
      }),
      HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${FILES}/hand_landmarker.task`, delegate },
        runningMode: 'VIDEO', numHands: 2,
      }),
    ]).then(([face, hand]) => ({ face, hand }))
    try { return await make('GPU') } catch { return await make('CPU') }
  })()
  trackers.catch(() => { trackers = null })
  return trackers
}

/** Camera + trackers; `onFrame` gets every tracked frame (outside React, so 30 frames a second cost no re-renders). */
export function useTracker(onFrame: (f: TrackFrame) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<MirrorState>('off')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const stream = useRef<MediaStream | null>(null)
  const loop = useRef(0)
  const alive = useRef(true)
  const frame = useRef(onFrame)
  useEffect(() => { frame.current = onFrame }, [onFrame])

  const halt = useCallback(() => {
    const v = videoRef.current
    if (v && 'cancelVideoFrameCallback' in v) v.cancelVideoFrameCallback(loop.current)
    cancelAnimationFrame(loop.current)
    loop.current = 0
  }, [])

  const stop = useCallback(() => {
    halt()
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    const v = videoRef.current
    if (v) v.srcObject = null
    setState('off')
  }, [halt])

  const start = useCallback(async () => {
    if (stream.current) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(window.isSecureContext ? 'This browser has no camera access.' : 'The camera needs a secure (https) connection.')
      return setState('error')
    }
    setError(''); setNotice(''); setState('loading')
    try {
      const [s, t] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } }),
        loadTrackers(),
      ])
      if (!alive.current) return s.getTracks().forEach((x) => x.stop())
      stream.current = s
      const v = videoRef.current
      if (!v) { stop(); return }
      v.srcObject = s
      v.muted = true
      await v.play()
      setState('on')
      let last = -1
      const own = 'requestVideoFrameCallback' in v
      const schedule = () => { loop.current = own ? v.requestVideoFrameCallback(tick) : requestAnimationFrame(tick) }
      const tick = () => {
        schedule()
        if (v.readyState < 2 || !v.videoWidth) return
        // the trackers need a rising time stamp, one per frame
        const now = Math.max(performance.now(), last + 1)
        last = now
        const f = t.face.detectForVideo(v, now)
        const h = t.hand.detectForVideo(v, now)
        const lm = f.faceLandmarks[0]
        const jaw = f.faceBlendshapes?.[0]?.categories.find((c) => c.categoryName === 'jawOpen')?.score ?? 0
        frame.current({
          video: v, vw: v.videoWidth, vh: v.videoHeight, now,
          face: lm ? { lm, matrix: f.facialTransformationMatrixes?.[0]?.data ?? null, jaw } : null,
          hands: h.landmarks.map((l, i) => {
            const label = h.handedness[i]?.[0]?.categoryName
            return { lm: l, right: LABEL_IS_SWAPPED ? label === 'Left' : label === 'Right' }
          }),
        })
      }
      schedule()
    } catch (e) {
      stream.current?.getTracks().forEach((x) => x.stop()); stream.current = null
      const camera = e instanceof DOMException
      setError(camera ? cameraError(e) : 'The X-ray trackers could not load. Check your connection and try again.')
      setState('error')
    }
  }, [stop])

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; halt(); stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null }
  }, [halt])

  // a hidden tab gets no frames: let go of the camera so its light goes off
  useEffect(() => {
    const hide = () => { if (document.hidden && stream.current) { setNotice('The mirror stopped because this tab was hidden. Start it again when you are back.'); stop() } }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [stop])

  return { videoRef, state, error, notice, start, stop }
}
