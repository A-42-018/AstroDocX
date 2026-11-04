import { create } from 'zustand'
import { useSound } from './sfx'

/*
 * Background score for the 3D cabin, played through YouTube's own embedded player (nothing is downloaded or
 * bundled). The player script loads only when the crew first presses Music, which is also the click the browser
 * needs before it allows sound. Needs a connection; offline the button just stays off.
 */

const VIDEO = 'LpGx4uqtvgs'
const VOLUME = 16 // well under the cabin's effects and voices

interface YTPlayer { playVideo(): void; pauseVideo(): void; setVolume(v: number): void; destroy(): void }
interface YTApi { Player: new (el: HTMLElement, o: object) => YTPlayer }
declare global { interface Window { YT?: YTApi; onYouTubeIframeAPIReady?: () => void } }

interface MusicState { on: boolean; failed: boolean }
export const useMusic = create<MusicState>(() => ({ on: false, failed: false }))

let player: YTPlayer | null = null // set only once the embed reports ready: its methods do not exist before
let creating = false
let host: HTMLElement | null = null
let loading: Promise<YTApi> | null = null

const loadApi = () => (loading ??= new Promise<YTApi>((resolve, reject) => {
  if (window.YT?.Player) return resolve(window.YT)
  window.onYouTubeIframeAPIReady = () => resolve(window.YT!)
  const s = document.createElement('script')
  s.src = 'https://www.youtube.com/iframe_api'
  s.onerror = () => { loading = null; reject(new Error('offline')) }
  document.head.appendChild(s)
}))

const fail = () => useMusic.setState({ on: false, failed: true })

/** Start the score (loading the player on the first call). */
export async function startMusic() {
  useMusic.setState({ on: true, failed: false })
  if (player) { player.setVolume(VOLUME); player.playVideo(); return }
  if (creating) return
  creating = true
  try {
    const YT = await loadApi()
    if (!useMusic.getState().on) return // switched off while it loaded
    host = document.createElement('div')
    host.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px'
    host.appendChild(document.createElement('div'))
    document.body.appendChild(host)
    new YT.Player(host.firstElementChild as HTMLElement, {
      videoId: VIDEO, width: 1, height: 1,
      playerVars: { autoplay: 1, loop: 1, playlist: VIDEO, controls: 0, disablekb: 1, playsinline: 1, rel: 0 },
      events: {
        onReady: (e: { target: YTPlayer }) => {
          creating = false
          if (!host) { e.target.destroy(); return } // left the cabin while it loaded
          player = e.target
          e.target.setVolume(VOLUME)
          if (useMusic.getState().on) e.target.playVideo()
        },
        onError: () => { creating = false; stopMusic(); fail() }, // not embeddable, removed or blocked
      },
    })
  } catch { creating = false; fail() }
}

/** Lower the score while someone is speaking, so the words come through. */
export function duckMusic(on: boolean) { player?.setVolume(on ? 5 : VOLUME) }

export function stopMusic() {
  useMusic.setState({ on: false })
  player?.pauseVideo()
}

/** Leaving the cabin takes the score with it. */
export function disposeMusic() {
  useMusic.setState({ on: false })
  player?.destroy(); player = null
  host?.remove(); host = null
  creating = false
}

// the sound toggle mutes the score too
useSound.subscribe((s) => { if (!s.on) player?.pauseVideo(); else if (useMusic.getState().on) player?.playVideo() })
