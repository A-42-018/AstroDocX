/**
 * Snapshot: the mirror as you see it (the darkened camera picture with the X-ray on top, flipped like a mirror) saved
 * as a PNG on this device. Nothing is uploaded.
 */
import { drawTags, type TagGroup } from './labels'
import type { XraySettings } from './settings'
import { coverRect, tintFor, videoFilter } from './view'

/** The snapshot's file name, from the time it was taken (local time, no characters a file system dislikes). */
export function snapshotName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `astrodocx-xray-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`
}

/** Draws the mirror into a new canvas the size of the overlay canvas. `overlay` must hold the frame just drawn. */
export function composeSnapshot(video: HTMLVideoElement, overlay: HTMLCanvasElement, s: XraySettings, tags: readonly TagGroup[] = []): HTMLCanvasElement {
  const W = overlay.width, H = overlay.height
  const out = document.createElement('canvas')
  out.width = W; out.height = H
  const ctx = out.getContext('2d')
  if (!ctx) return out
  const vw = video.videoWidth, vh = video.videoHeight
  const { ox, oy } = coverRect(vw, vh, W, H)
  ctx.save()
  ctx.translate(W, 0); ctx.scale(-1, 1) // a mirror
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
  if (vw && vh) {
    ctx.filter = videoFilter(s.strength, s.realThrough)
    ctx.drawImage(video, ox, oy, vw - 2 * ox, vh - 2 * oy, 0, 0, W, H)
    ctx.filter = 'none'
  }
  ctx.fillStyle = tintFor(s.strength, s.realThrough); ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = s.look === 'solid' ? 'source-over' : 'lighter'
  ctx.drawImage(overlay, 0, 0, W, H)
  ctx.restore()
  const f = Math.max(12, Math.round(H / 60))
  // the textbook plate: tag positions are in screen pixels, the overlay canvas may be denser
  const cw = overlay.clientWidth || W, k = W / cw
  ctx.save(); ctx.scale(k, k)
  drawTags(ctx, tags, cw, H / k, 12)
  ctx.restore()
  ctx.font = `600 ${f}px ui-monospace, monospace`
  ctx.fillStyle = 'rgba(159, 244, 255, 0.8)'
  ctx.fillText('ASTRODOCX X-RAY MIRROR · NOT A MEDICAL IMAGE', f, H - f)
  return out
}

/** Saves a canvas as a PNG download. */
export function saveCanvas(c: HTMLCanvasElement, name = snapshotName()): Promise<void> {
  return new Promise((done) => c.toBlob((blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = name
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }
    done()
  }, 'image/png'))
}
