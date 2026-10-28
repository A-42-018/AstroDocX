import type { Status } from '../data/types'
import type { CabinCrew, CabinData } from './data'

/**
 * The four in-cabin screens and the floating crew tags, drawn on 2D canvases that the scene uses as
 * textures. Colours follow the console tokens (styles/tokens.css): cyan for data, green/amber/red for status only.
 */
export const C = { cy: '#36e2f5', cyHi: '#9ff4ff', ok: '#3ddc97', watch: '#ffc53d', act: '#ff4d6a', data2: '#8b9cff', t1: '#eef8ff', t2: 'rgba(214,238,250,0.88)', t3: 'rgba(170,214,232,0.74)' }
const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"
const UI = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
export const SW = 1024, SH = 600

export const statusColor = (s: Status | 'resolved') => (s === 'act' ? C.act : s === 'watch' ? C.watch : C.ok)
export const statusLabel = (s: Status | 'resolved') => (s === 'resolved' ? 'RESOLVED' : s === 'act' ? 'ACT' : s === 'watch' ? 'WATCH' : 'NOMINAL')

type G = CanvasRenderingContext2D

function cut(g: G, x: number, y: number, w: number, h: number, k = 22) {
  g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h - k); g.lineTo(x + w - k, y + h); g.lineTo(x, y + h); g.lineTo(x, y + k); g.closePath()
}
function tag(g: G, text: string, x: number, y: number, color: string, alignRight = false) {
  g.font = `700 17px ${MONO}`
  const w = g.measureText(text).width + 26, x0 = alignRight ? x - w : x
  g.fillStyle = color + '22'; g.fillRect(x0, y - 22, w, 32)
  g.strokeStyle = color; g.lineWidth = 2; g.strokeRect(x0, y - 22, w, 32)
  g.fillStyle = color; g.fillText(text, x0 + 13, y)
}
/** Word-wrap `text` into at most `lines` lines of `w` px; the last line ends in an ellipsis when cut. */
function wrap(g: G, text: string, x: number, y: number, w: number, lineH: number, lines: number) {
  const words = text.split(/\s+/)
  let line = '', n = 0
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i]
    if (g.measureText(next).width <= w) { line = next; continue }
    if (n === lines - 1) { g.fillText(`${line}…`, x, y + n * lineH); return }
    g.fillText(line, x, y + n * lineH); n++; line = words[i]
  }
  if (line) g.fillText(line, x, y + n * lineH)
}
function frame(g: G, title: string, right: string, rightColor: string) {
  const bg = g.createLinearGradient(0, 0, 0, SH); bg.addColorStop(0, '#04121c'); bg.addColorStop(1, '#020a12')
  g.fillStyle = bg; g.fillRect(0, 0, SW, SH)
  g.strokeStyle = 'rgba(54,226,245,0.06)'; g.lineWidth = 1
  for (let x = 0; x < SW; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, SH); g.stroke() }
  for (let y = 0; y < SH; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(SW, y); g.stroke() }
  cut(g, 12, 12, SW - 24, SH - 24, 28); g.strokeStyle = 'rgba(54,226,245,0.6)'; g.lineWidth = 3; g.stroke()
  g.fillStyle = C.cy; g.font = `600 18px ${MONO}`; g.fillText('ASTRODOCX', 44, 54)
  g.fillStyle = C.t1; g.font = `700 32px ${UI}`; g.fillText(title, 44, 92)
  tag(g, right, SW - 44, 70, rightColor, true)
}
const focusOf = (d: CabinData) => d.crew.find((c) => c.id === d.focusId) ?? d.crew[0]

/** A smooth ECG trace: P wave, QRS spike, T wave, at phase 0..1 of one beat. */
export function ecg(ph: number) {
  const gauss = (c: number, a: number, s: number) => a * Math.exp(-((ph - c) ** 2) / (2 * s * s))
  return gauss(0.1, 0.12, 0.025) + gauss(0.2, -0.12, 0.008) + gauss(0.225, 1, 0.009) + gauss(0.25, -0.28, 0.01) + gauss(0.46, 0.3, 0.04)
}

/** 0 · Crew Status Board: one card per crew member (up to six). */
export function drawStatusBoard(g: G, d: CabinData, t: number) {
  const off = d.crew.filter((c) => c.status !== 'nominal').length
  const worst = d.crew.some((c) => c.status === 'act') ? 'act' : off ? 'watch' : 'nominal'
  frame(g, 'Crew Status Board', `${d.crew.length} CREW · ${off ? `${off} OFF-NOMINAL` : 'ALL NOMINAL'}`, statusColor(worst))
  d.crew.slice(0, 6).forEach((m, i) => {
    const x = 44 + (i % 3) * 316, y = 124 + Math.floor(i / 3) * 228, w = 300, h = 212, col = statusColor(m.status), ok = m.status === 'nominal'
    cut(g, x, y, w, h, 16); g.fillStyle = ok ? 'rgba(8,24,34,0.95)' : 'rgba(40,30,8,0.9)'; g.fill()
    g.strokeStyle = ok ? 'rgba(54,226,245,0.35)' : col; g.lineWidth = 2; g.stroke()
    g.fillStyle = C.t1; g.font = `700 24px ${UI}`; g.fillText(m.name, x + 18, y + 38)
    g.fillStyle = C.t3; g.font = `500 15px ${MONO}`; g.fillText(m.alerts ? `${m.alerts} OPEN ALERT${m.alerts > 1 ? 'S' : ''}` : m.id.toUpperCase(), x + 18, y + 62)
    g.fillStyle = ok ? C.t1 : col; g.font = `600 54px ${MONO}`; g.fillText(m.live.hr.toFixed(0), x + 18, y + 128)
    g.fillStyle = C.t3; g.font = `500 16px ${MONO}`; g.fillText('BPM', x + 122, y + 128)
    g.fillStyle = C.t2; g.font = `500 18px ${MONO}`; g.fillText(`SpO₂ ${m.live.spo2.toFixed(0)}%`, x + 170, y + 104); g.fillText(`RR ${m.live.resp.toFixed(0)}`, x + 170, y + 128)
    g.beginPath()
    for (let k = 0; k < 40; k++) { const yy = y + 172 - Math.sin(k * 0.45 + i + t * 0.6) * 10; if (k) g.lineTo(x + 18 + k * 6.6, yy); else g.moveTo(x + 18, yy) }
    g.strokeStyle = ok ? C.cy : col; g.lineWidth = 2.5; g.stroke()
    g.font = `700 14px ${MONO}`; g.fillStyle = col; g.fillText(`● ${statusLabel(m.status)}`, x + 18, y + 200)
  })
}

/** 1 · Live Vitals for the focus crew member: scrolling ECG at their live heart rate, plus SpO₂, breathing and cabin CO₂. */
export function drawLiveVitals(g: G, d: CabinData, t: number) {
  const m = focusOf(d), col = statusColor(m.status), ok = m.status === 'nominal'
  frame(g, `Live Vitals · ${m.name}`, statusLabel(m.status), col)
  const x0 = 44, y0 = 124, w = 640, h = 230
  cut(g, x0, y0, w, h, 16); g.fillStyle = 'rgba(6,20,30,0.95)'; g.fill(); g.strokeStyle = 'rgba(54,226,245,0.3)'; g.lineWidth = 2; g.stroke()
  g.fillStyle = C.t3; g.font = `600 15px ${MONO}`; g.fillText('ECG · LEAD II · SIMULATED FROM LIVE HR', x0 + 18, y0 + 30)
  g.beginPath()
  const speed = 160, rate = m.live.hr / 60
  for (let px = 0; px <= w - 36; px += 2) {
    const ph = ((((t - (w - 36 - px) / speed) * rate) % 1) + 1) % 1, yy = y0 + 150 - ecg(ph) * 95
    if (px) g.lineTo(x0 + 18 + px, yy); else g.moveTo(x0 + 18, yy)
  }
  g.strokeStyle = C.cy; g.lineWidth = 3; g.shadowColor = C.cy; g.shadowBlur = 12; g.stroke(); g.shadowBlur = 0
  const hx = 710
  cut(g, hx, y0, 270, h, 16); g.fillStyle = ok ? 'rgba(6,20,30,0.95)' : 'rgba(40,30,8,0.9)'; g.fill(); g.strokeStyle = ok ? 'rgba(54,226,245,0.3)' : col; g.stroke()
  g.fillStyle = C.t3; g.font = `600 15px ${MONO}`; g.fillText('HEART RATE', hx + 20, y0 + 30)
  g.fillStyle = ok ? C.t1 : col; g.font = `700 96px ${MONO}`; g.fillText(m.live.hr.toFixed(0), hx + 20, y0 + 135)
  g.fillStyle = C.t2; g.font = `500 20px ${MONO}`; g.fillText('BPM', hx + 196, y0 + 135)
  g.fillStyle = col; g.font = `600 16px ${MONO}`; g.fillText(m.alerts ? `${m.alerts} open alert${m.alerts > 1 ? 's' : ''}` : 'Within baseline', hx + 20, y0 + 190)
  const items: [string, string][] = [['SpO₂', `${m.live.spo2.toFixed(1)}%`], ['RESP', `${m.live.resp.toFixed(0)}/min`], ['CABIN CO₂', `${m.live.co2.toFixed(1)} mmHg`], ['DOSE', `${m.live.dose.toFixed(1)} µSv/h`]]
  items.forEach(([k, v], i) => {
    const x = 44 + i * 236, y = 384
    cut(g, x, y, 220, 110, 14); g.fillStyle = 'rgba(6,20,30,0.95)'; g.fill(); g.strokeStyle = 'rgba(54,226,245,0.3)'; g.stroke()
    g.fillStyle = C.t3; g.font = `600 15px ${MONO}`; g.fillText(k, x + 16, y + 30)
    g.fillStyle = C.t1; g.font = `600 30px ${MONO}`; g.fillText(v, x + 16, y + 80)
  })
  g.fillStyle = C.t3; g.font = `500 16px ${UI}`; g.fillText('Simulated live stream around the latest readings · the engine stays the single source of truth', 44, 548)
}

/** 2 · Explainable Alerts: what, the engine's explanation (WHY) and the next action step (NEXT). */
export function drawAlerts(g: G, d: CabinData) {
  const open = d.alerts.filter((a) => a.status !== 'resolved').length
  frame(g, 'Explainable Alerts', open ? `${open} OPEN` : 'NONE OPEN', open ? C.watch : C.ok)
  if (!d.alerts.length) { g.fillStyle = C.t2; g.font = `500 24px ${UI}`; g.fillText('No alerts this mission. Everyone is within their baseline.', 44, 180); return }
  let y = 120
  for (const a of d.alerts) {
    const col = statusColor(a.status), full = a.status !== 'resolved', h = full ? 136 : 92
    if (y + h > SH - 30) break
    cut(g, 44, y, SW - 88, h, 14); g.fillStyle = 'rgba(6,20,30,0.95)'; g.fill(); g.strokeStyle = col + '88'; g.lineWidth = 2; g.stroke()
    g.fillStyle = col; g.fillRect(44, y + 14, 6, h - 28)
    tag(g, statusLabel(a.status), SW - 64, y + 40, col, true)
    g.fillStyle = C.t1; g.font = `700 23px ${UI}`; g.fillText(a.title, 70, y + 40)
    g.fillStyle = C.t2; g.font = `500 17px ${MONO}`; g.fillText(a.detail, 70, y + 70)
    if (full) {
      g.fillStyle = C.t3; g.font = `500 16px ${UI}`; wrap(g, `WHY  ${a.why}`, 70, y + 98, SW - 180, 20, 1)
      g.fillStyle = C.cyHi; g.font = `600 16px ${UI}`; wrap(g, `NEXT  ${a.next}`, 70, y + 122, SW - 180, 20, 1)
    }
    y += h + 14
  }
}

/** 3 · Trends: daily mean heart rate for the focus crew member over 30 days, their personal band and the crew median. */
export function drawTrends(g: G, d: CabinData, t: number) {
  const m = focusOf(d), tr = d.trend
  frame(g, 'Trends · Heart Rate · 30 d', m.name.toUpperCase(), C.cy)
  if (!tr || tr.days.length < 2) { g.fillStyle = C.t2; g.font = `500 24px ${UI}`; g.fillText('Collecting readings…', 44, 180); return }
  const all = [...tr.days, ...tr.median, ...(tr.band ?? [])]
  const lo = Math.floor(Math.min(...all) / 5) * 5 - 5, hi = Math.ceil(Math.max(...all) / 5) * 5 + 5
  const x0 = 100, y0 = 130, w = 860, h = 360, n = tr.days.length
  const X = (i: number) => x0 + (i / (n - 1)) * w, Y = (v: number) => y0 + h - ((v - lo) / (hi - lo)) * h
  g.font = `500 15px ${MONO}`
  const step = hi - lo > 40 ? 10 : 5
  for (let v = lo; v <= hi; v += step) { g.strokeStyle = 'rgba(150,200,220,0.15)'; g.beginPath(); g.moveTo(x0, Y(v)); g.lineTo(x0 + w, Y(v)); g.stroke(); g.fillStyle = C.t3; g.fillText(String(v), x0 - 46, Y(v) + 5) }
  if (tr.band) {
    g.fillStyle = 'rgba(61,220,151,0.12)'; g.fillRect(x0, Y(tr.band[1]), w, Y(tr.band[0]) - Y(tr.band[1]))
    g.fillStyle = C.ok; g.fillText('PERSONAL BASELINE', x0 + 10, Y(tr.band[1]) - 8)
  }
  const line = (vs: number[]) => { g.beginPath(); vs.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)))) }
  g.setLineDash([8, 8]); line(tr.median); g.strokeStyle = C.data2; g.lineWidth = 2.5; g.stroke(); g.setLineDash([])
  line(tr.days); g.strokeStyle = C.cy; g.lineWidth = 3.5; g.shadowColor = C.cy; g.shadowBlur = 10; g.stroke(); g.shadowBlur = 0
  const last = tr.days[n - 1], col = statusColor(m.status)
  g.fillStyle = col; g.beginPath(); g.arc(X(n - 1), Y(last), 7 + Math.sin(t * 4) * 3, 0, 7); g.fill()
  g.font = `700 18px ${MONO}`; g.fillText(`${last.toFixed(0)} bpm`, X(n - 1) - 110, Y(last) - 16)
  g.fillStyle = C.t3; g.font = `500 15px ${MONO}`; g.fillText(`DAY -${n - 1}`, x0, y0 + h + 30); g.fillText('TODAY', x0 + w - 56, y0 + h + 30)
  g.fillStyle = C.cy; g.fillRect(x0 + 240, y0 + h + 20, 22, 4); g.fillStyle = C.t2; g.fillText(m.name, x0 + 270, y0 + h + 28)
  g.fillStyle = C.data2; g.fillRect(x0 + 520, y0 + h + 20, 22, 4); g.fillStyle = C.t2; g.fillText('Crew median', x0 + 550, y0 + h + 28)
}

export const TAG_W = 512, TAG_H = 150
/** The floating name tag above an astronaut: name, status and a heart that beats harder when off-nominal. */
export function drawTag(g: G, m: CabinCrew, t: number) {
  const col = statusColor(m.status)
  g.clearRect(0, 0, TAG_W, TAG_H)
  cut(g, 4, 4, TAG_W - 8, TAG_H - 8, 18); g.fillStyle = 'rgba(5,14,22,0.88)'; g.fill(); g.strokeStyle = col; g.lineWidth = 3; g.stroke()
  g.fillStyle = col; g.fillRect(4, 22, 8, 106)
  g.fillStyle = C.t1; g.font = `700 34px ${UI}`; g.fillText(m.name, 32, 60)
  g.fillStyle = col; g.font = `700 22px ${MONO}`; g.fillText(`● ${statusLabel(m.status)}`, 32, 104)
  const beat = m.status === 'nominal' ? 1 : 1 + Math.max(0, Math.sin(t * 6)) * 0.15
  g.save(); g.translate(330, 104); g.scale(beat, beat); g.fillStyle = col; g.font = `700 30px ${UI}`; g.fillText('♥', -12, 10); g.restore()
  g.fillStyle = C.t1; g.font = `700 40px ${MONO}`; g.fillText(m.live.hr.toFixed(0), 360, 117)
}
