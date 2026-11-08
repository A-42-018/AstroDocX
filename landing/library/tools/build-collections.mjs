// Builds ../collections.json from picks.json by pulling real metadata from the NASA API.
// Drops anything dead, patch/logo-like, or marked copyrighted. Usage: node build-collections.mjs [--desc]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { lookup, manifest, pickAsset, clean, BAD, COPY } from './lib.mjs'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const picks = JSON.parse(readFileSync(here('./picks.json'), 'utf8'))
const showDesc = process.argv.includes('--desc')
const out = { _note: 'Hand-picked NASA items. Metadata from images-api.nasa.gov. Built by tools/build-collections.mjs. Not affiliated with or endorsed by NASA.', collections: [] }
for (const [cid, c] of Object.entries(picks)) {
  const items = []
  for (const p of c.items) {
    const it = await lookup(p.id)
    if (!it) { console.log(`DROP ${cid} ${p.id}: not found`); continue }
    const d = it.data[0]
    if (d.media_type !== p.type) { console.log(`DROP ${cid} ${p.id}: type ${d.media_type} != ${p.type}`); continue }
    const text = clean(d.title + ' ' + (d.keywords || []).join(' '))
    if (BAD.test(text)) { console.log(`DROP ${cid} ${p.id}: patch/logo`); continue }
    if (COPY.test(clean(d.description) + ' ' + (d.secondary_creator || '') + ' ' + (d.photographer || ''))) { console.log(`DROP ${cid} ${p.id}: copyright marker`); continue }
    const urls = await manifest(p.id)
    if (!pickAsset(urls, p.type)) { console.log(`DROP ${cid} ${p.id}: no playable asset`); continue }
    const title = p.title || clean(d.title)
    const thumb = (it.links || []).find((l) => l.rel === 'preview')?.href || null
    items.push({ nasa_id: p.id, media_type: p.type, title, center: d.center || 'NASA', date: (d.date_created || '').slice(0, 10), caption: p.caption, ...(thumb ? { thumb } : {}) })
    if (showDesc) console.log(`  [${p.id}] ${title} :: ${clean(d.description).slice(0, 230)}`)
  }
  out.collections.push({ id: cid, title: c.title, intro: c.intro, items })
  const n = (t) => items.filter((i) => i.media_type === t).length
  console.log(`${cid}: ${items.length} (image ${n('image')}, video ${n('video')}, audio ${n('audio')})`)
}
writeFileSync(here('../collections.json'), JSON.stringify(out, null, 1) + '\n')
