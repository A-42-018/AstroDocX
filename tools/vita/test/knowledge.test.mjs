import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { build, toMarkdown } from '../build-knowledge.mjs'

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8')
const committed = JSON.parse(rd('knowledge/chunks.json'))
let fresh = null, skip = false
try { fresh = await build() } catch (e) { if (/typescript not found/.test(e.message)) skip = true; else throw e }

test('committed knowledge matches a fresh build (no drift)', { skip: skip && 'typescript not installed (cd app && npm ci)' }, () => {
  assert.deepEqual(committed, fresh)
  assert.equal(rd('knowledge/knowledge.md'), toMarkdown(fresh))
})
test('every chunk has an id, label, https url and text; ids unique', () => {
  const ids = new Set()
  for (const c of committed) {
    assert.ok(c.id && c.label && c.text, c.id); assert.match(c.url, /^https:\/\//); assert.ok(!ids.has(c.id)); ids.add(c.id)
  }
})
test('the limits come from limits.ts', () => {
  const lim = rd('app/src/engine/limits.ts')
  const num = (n) => Number(lim.match(new RegExp(`export const ${n} = ([\\d.]+)`))[1])
  const t = committed.find((c) => c.id === 'adx-limits').text
  for (const n of ['CO2_LIMIT_MMHG', 'CAREER_DOSE_MSV', 'SPE_DOSE_MSV', 'CO2_WATCH_HOURS', 'CO2_ACT_HOURS']) assert.ok(t.includes(String(num(n))), n)
})
test('every evidence item, hazard and console route is present', () => {
  const ev = rd('app/src/engine/evidence.ts')
  const ids = [...ev.matchAll(/(?:osd|ntrs)\((\d+|'\d+')/g)].map((m) => m[1].replace(/'/g, ''))
  assert.ok(ids.length >= 7)
  const urls = committed.map((c) => c.url).join(' ')
  for (const id of ids) assert.ok(urls.includes(id), `evidence ${id}`)
  for (const h of 'ridge') assert.ok(committed.some((c) => c.id === 'hazard-' + h), h)
  const routes = [...rd('app/src/shell/pages.tsx').matchAll(/<Route key="[a-z]+" path="(\/[a-z]+)"/g)].map((m) => m[1])
  const known = committed.find((c) => c.id === 'adx-screens').routes
  for (const r of routes) assert.ok(known.includes(r) || !rd('app/src/shell/nav.ts').includes(`'${r}'`), r)
  assert.equal(known.length, 9) // the nine console screens, the Crew Doctor included
})
test('hand-written general topics are all covered and cite nasa.gov / NTRS / OSDR only', () => {
  const gen = committed.filter((c) => c.id.startsWith('gen-'))
  const topics = new Set(gen.map((c) => c.topic))
  for (const t of ['bone-muscle', 'vision', 'radiation', 'sleep', 'isolation', 'co2', 'immune']) assert.ok(topics.has(t), t)
  for (const c of gen) assert.match(new URL(c.url).hostname, /^(www\.nasa\.gov|ntrs\.nasa\.gov|osdr\.nasa\.gov)$/)
})
