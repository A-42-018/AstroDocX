// Shared helpers for the NASA Library tools. Node 18+.
export const API = 'https://images-api.nasa.gov'
export const BAD = /\b(patch(es)?|logo|insignia|emblem)\b/i
export const COPY = /copyright|©|\(c\)\s*\d{4}|courtesy of|used with permission|all rights reserved/i
export async function getJson(url, tries = 3) {
  let err
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.status === 404) return null; if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json() } catch (e) { err = e; await new Promise((r) => setTimeout(r, 400 * (i + 1))) }
  }
  throw err
}
export async function lookup(id) {
  const j = await getJson(`${API}/search?nasa_id=${encodeURIComponent(id)}`)
  const it = j?.collection?.items?.find((x) => x.data[0].nasa_id === id)
  return it || null
}
export async function manifest(id) {
  const j = await getJson(`${API}/asset/${encodeURIComponent(id)}`)
  return (j?.collection?.items || []).map((x) => x.href)
}
export function pickAsset(urls, type) {
  const ext = type === 'video' ? /\.mp4$/i : type === 'audio' ? /\.(mp3|m4a)$/i : /\.jpe?g$/i
  const list = urls.filter((u) => ext.test(u))
  const rank = (u) => (type === 'video' ? ['~mobile.', '~medium.', '~large.', ''] : type === 'image' ? ['~medium.', '~large.', '~small.', ''] : ['.mp3', ''])
  const order = rank()
  for (const k of order) { const m = list.find((u) => (k ? u.includes(k) : !/~orig/.test(u) || true)); if (m) return m }
  return list[0] || null
}
export const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
