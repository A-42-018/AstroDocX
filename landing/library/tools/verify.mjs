// Re-verifies every id in collections.json against images-api.nasa.gov and prints a report.
// Checks: id exists with the expected media type, metadata matches, asset manifest resolves to a playable file
// (mp4 / mp3|m4a / jpg), and the asset file answers a HEAD request. Exit code 1 if anything is dead.
// Usage: node landing/library/tools/verify.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { lookup, manifest, pickAsset, BAD, COPY, clean } from './lib.mjs'
const data = JSON.parse(readFileSync(fileURLToPath(new URL('../collections.json', import.meta.url)), 'utf8'))
const cache = new Map()
async function head(url) {
  try { const r = await fetch(url.replace(/^http:/, 'https:'), { method: 'HEAD' }); return r.ok } catch { return false }
}
async function check(it) {
  const m = await lookup(it.nasa_id)
  if (!m) return 'id not found in API'
  const d = m.data[0]
  if (d.media_type !== it.media_type) return `type is ${d.media_type}`
  if (BAD.test(d.title)) return 'patch/logo title'
  if (COPY.test(clean(d.description) + ' ' + (d.secondary_creator || ''))) return 'copyright marker'
  const urls = await manifest(it.nasa_id)
  const asset = pickAsset(urls, it.media_type)
  if (!asset) return 'no playable asset in manifest'
  if (!(await head(asset))) return 'asset URL does not resolve: ' + asset
  if (it.thumb && !(await head(it.thumb))) return 'thumbnail does not resolve'
  return null
}
const dead = []
const rows = []
for (const c of data.collections) {
  const n = { image: 0, video: 0, audio: 0 }
  await Promise.all(c.items.map(async (it) => {
    let err
    try { err = await check(it) } catch (e) { err = 'error: ' + e.message }
    if (err) dead.push(`${c.id} / ${it.nasa_id}: ${err}`); else n[it.media_type]++
  }))
  rows.push(`${c.id.padEnd(16)} ok ${String(n.image + n.video + n.audio).padStart(2)} / ${c.items.length}  (image ${n.image}, video ${n.video}, audio ${n.audio})`)
}
console.log(rows.join('\n'))
console.log(dead.length ? `\nDEAD (${dead.length}):\n` + dead.join('\n') : '\nAll ids verified: 0 dead.')
process.exit(dead.length ? 1 : 0)
