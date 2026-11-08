#!/usr/bin/env node
/*
 * Builds knowledge/chunks.json, the only source VITA may answer from.
 * Reads the real engine files (nasa.ts, evidence.ts, limits.ts, data/types.ts), the README and the console routes, so
 * numbers cannot drift from the code, then appends the hand-written knowledge/general.json.
 *
 *   node tools/vita/build-knowledge.mjs          write knowledge/chunks.json (+ knowledge/knowledge.md)
 *   node tools/vita/build-knowledge.mjs --check  exit 1 if the committed files are out of date
 *
 * TypeScript is only used to strip types: it is found in app/node_modules (run `cd app && npm ci` first).
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const SITE = 'https://astrodocx.vercel.app'
const REPO = 'https://github.com/A-42-018/AstroDocX'
const rd = (p) => readFileSync(join(ROOT, p), 'utf8')

function loadTs() {
  const dirs = [join(ROOT, 'app')]
  // a git worktree has no node_modules of its own: fall back to the main checkout's
  const m = ROOT.match(/^(.*)\/\.claude\/worktrees\/[^/]+$/)
  if (m) dirs.push(join(m[1], 'app'))
  for (const d of dirs) {
    try { return createRequire(join(d, 'package.json'))('typescript') } catch { /* try next */ }
  }
  throw new Error('typescript not found. Run `cd app && npm ci` first.')
}

/** Transpile the engine modules to a temp dir and import them. */
async function loadEngine() {
  const ts = loadTs()
  const tmp = mkdtempSync(join(tmpdir(), 'vita-kb-'))
  try {
    for (const f of ['data/types', 'engine/limits', 'engine/evidence', 'engine/nasa']) {
      const out = ts.transpileModule(rd(`app/src/${f}.ts`), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
        .replace(/from ['"](\.\.?\/[^'"]+)['"]/g, (_, p) => `from '${p.replace(/^\.\.\//, '../').replace(/(\.mjs)?$/, '.mjs')}'`)
      const file = join(tmp, f + '.mjs')
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, out)
    }
    const load = (f) => import(pathToFileURL(join(tmp, f + '.mjs')).href)
    return { types: await load('data/types'), limits: await load('engine/limits'), evidence: await load('engine/evidence'), nasa: await load('engine/nasa') }
  } finally { rmSync(tmp, { recursive: true, force: true }) }
}

const clean = (s) => s.replace(/\*\*|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim()

/** Rows of the README table that follows `heading`: [[cell, cell], ...]. */
function readmeTable(readme, afterText) {
  const i = readme.indexOf(afterText)
  if (i < 0) throw new Error(`README: "${afterText}" not found`)
  return readme.slice(i).split(/\n\s*\n/)[0].split('\n').filter((l) => l.startsWith('|')).slice(2)
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((r) => r.length >= 2)
}

export async function build() {
  const { types, limits, evidence, nasa } = await loadEngine()
  const readme = rd('README.md')
  const app = rd('app/src/App.tsx')
  const pages = rd('app/src/shell/pages.tsx')
  const nav = rd('app/src/shell/nav.ts')
  const chunks = []
  const add = (c) => chunks.push(c)

  /* ---- console routes (shell/pages.tsx is the truth; nav.ts supplies labels) ---- */
  const routes = [...pages.matchAll(/<Route key="[a-z]+" path="(\/[a-z]+)"/g)].map((m) => m[1])
  const label = (p) => nav.match(new RegExp(`path: '${p}', label: '([^']+)'`))?.[1]
  const screens = routes.map((p) => ({ path: p, label: label(p) })).filter((s) => s.label)
  if (screens.length < 8) throw new Error(`expected 8 console screens, found ${screens.length}`)

  /* ---- AstroDocX: what it is ---- */
  const tagline = clean(readme.match(/\*\*Astronaut \+ Doctor \+ X\*\*[^\n]*/)[0])
  add({ id: 'adx-overview', topic: 'astrodocx', label: 'AstroDocX overview (README)', url: REPO,
    text: `${tagline} Built by Team AstroDocX in Dhaka, Bangladesh for the NASA Space Apps Challenge 2026 challenge "Create Health Monitoring Software for Astronauts on Space Missions". The loop is Detect, Explain, Act, Log, Sync later. AstroDocX is a prototype and not a medical device. It runs on synthetic demo data (a 6-crew 30-day demo mission). It is an independent Space Apps project using NASA open data and is not affiliated with or endorsed by NASA. Every number, alert, finding and step comes from tested, deterministic code; VITA's live answers only re-word cited sources or the console's own crew exam. Only the CO2 and radiation dose limits are NASA-STD-3001 cited; other thresholds are illustrative and labelled so.` })

  /* ---- AstroDocX: each README feature row ---- */
  const ROUTE_OF = { 'Status Board': '/board', 'Crew Doctor (VITA)': '/doctor', 'Health Twin (console)': '/board', Trends: '/trends', 'Daily Check-in': '/checkin', 'Mission Simulator': '/simulator', 'Ground Sync': '/sync', 'Ground View': '/ground', 'NASA Data': '/nasa', 'Action cards': '/alerts', 'Explainable alerts': '/alerts' }
  for (const [area, what] of readmeTable(readme, '| Area | What the Crew Console really does |')) {
    const a = clean(area), r = ROUTE_OF[a]
    add({ id: 'adx-' + a.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), topic: 'astrodocx', label: `AstroDocX: ${a}`,
      url: r ? `${SITE}/app${r}` : REPO, text: `${a}: ${clean(what)}`, ...(r ? { route: r } : {}) })
  }
  const roadmap = clean(readme.match(/\*\*Not built yet \(Roadmap\):\*\*[^\n]*/)[0])
  add({ id: 'adx-roadmap', topic: 'astrodocx', label: 'AstroDocX roadmap (README)', url: REPO, text: roadmap })

  /* ---- every console screen ---- */
  add({ id: 'adx-screens', topic: 'astrodocx', label: 'AstroDocX Crew Console screens', url: `${SITE}/app/`,
    text: `The Crew Console at /app/ has ${screens.length} screens: ${screens.map((s) => `${s.label} (${s.path})`).join(', ')}. It is an offline-first installable PWA.`, routes: screens.map((s) => s.path) })

  /* ---- the 3D cabin (facts from the cabin source headers; the checks fail the build if they drift) ---- */
  const scene = rd('app/src/cabin/scene.ts'), visor = rd('app/src/cabin/VisorHud.tsx')
  const stops = scene.match(/export const STOP_COUNT = (\d+)/)?.[1]
  if (!stops || !/four wall screens running the real console/.test(scene) || !/helmet visor/.test(visor) || !/pathname\.startsWith\('\/cabin'\)/.test(app))
    throw new Error('cabin source changed: update the adx-cabin chunk in tools/vita/build-knowledge.mjs')
  add({ id: 'adx-cabin', topic: 'astrodocx', label: 'AstroDocX 3D cabin', url: `${SITE}/app/cabin`,
    text: `The 3D cabin (/app/cabin) is a scroll-driven tour of a space-station hall with ${stops} camera stops. It starts inside an astronaut's helmet, where a visor HUD wired to AstroDocX shows crew readiness, the five hazard modules, the ground link and the engine's next action. It passes four wall screens running the real Crew Console, with crew members floating beside them and TARS robots walking the floor, looks back from the window, and ends outside with a crew member on a spacewalk (EVA) beside the station.` })

  /* ---- how detection works (numbers from limits.ts / types.ts) ---- */
  const metrics = Object.values(types.METRICS)
  add({ id: 'adx-how-detection-works', topic: 'astrodocx', label: 'How AstroDocX detection works (engine)', url: `${SITE}/app/alerts`,
    text: `AstroDocX monitors ${metrics.length} metrics: ${metrics.map((m) => `${m.label} (${m.unit}, hazard ${m.hazard})`).join('; ')}. For each crew member it learns a personal baseline with Welford running statistics and an EWMA-smoothed z-score, and only learns while the status is nominal so slow drift is not learned away. A status is Nominal, Watch or Act, with hysteresis; a statistical Watch or Act needs 2 readings in a row. Absolute limits come from NASA-STD-3001 for CO2 and radiation dose. A two-signal rule combines low sleep with slow reaction time. Each alert says what changed, by how much, against whose baseline and since when, and links published NASA evidence. This is context, never a diagnosis.` })

  /* ---- the limits ---- */
  add({ id: 'adx-limits', topic: 'limits', label: 'AstroDocX limits (limits.ts)', url: nasa.STANDARDS.co2.url,
    text: `CO2: NASA-STD-3001 Vol. 2 [V2 6004] limits the average 1-hour habitat ppCO2 to ${limits.CO2_LIMIT_MMHG} mmHg. AstroDocX raises Watch after ${limits.CO2_WATCH_HOURS} consecutive hourly readings over the limit and Act after ${limits.CO2_ACT_HOURS}; a single reading of ${limits.CO2_EMERGENCY_MMHG} mmHg or more is an illustrative emergency level (AstroDocX's own choice, not a NASA value). Radiation: NASA-STD-3001 Vol. 1 sets a career effective dose of ${limits.CAREER_DOSE_MSV} mSv and ${limits.SPE_DOSE_MSV} mSv per solar particle event; AstroDocX compares a rolling 24-hour dose with the per-event limit, Watch at ${limits.SPE_DOSE_MSV / 2} mSv and Act at ${limits.SPE_DOSE_MSV} mSv. Ground Sync flags data not yet sent to Earth: Watch at 24 h, Act at 72 h (AstroDocX design, not a NASA value).` })
  for (const s of Object.values(nasa.STANDARDS)) {
    add({ id: 'std-' + s.tag.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + s.value.split(' ')[0], topic: 'limits', label: s.title, url: s.url,
      text: `${s.title}: ${s.value}. How AstroDocX applies it: ${s.use}` })
  }

  /* ---- five hazards ---- */
  for (const h of nasa.HAZARD_BASIS) {
    add({ id: 'hazard-' + h.id.toLowerCase(), topic: 'hazards', label: `NASA hazard ${h.id}: ${h.nasaName}`, url: nasa.FIVE_HAZARDS_URL,
      text: `${h.nasaName} (${h.id} in RIDGE). ${h.risk} AstroDocX: ${h.response} Metrics: ${h.metrics.map((m) => types.METRICS[m].label).join(', ')}.${h.standards.length ? ` Limits checked: ${h.standards.map((s) => s.value).join('; ')}.` : ''}` })
  }

  /* ---- evidence items ---- */
  for (const e of evidence.ALL_EVIDENCE) {
    add({ id: 'ev-' + e.id.split(' ')[0].toLowerCase(), topic: 'evidence', label: `${e.source} ${e.id}: ${e.title}`, url: e.url,
      text: `${e.source} ${e.id}, "${e.title}". Why AstroDocX cites it: ${e.why}` })
  }
  add({ id: 'nasa-resources', topic: 'evidence', label: 'NASA resources AstroDocX draws on', url: 'https://osdr.nasa.gov/bio/',
    text: nasa.RESOURCES.map((r) => `${r.name}: ${r.what} (${r.url})`).join(' ') })
  for (const r of nasa.RESOURCES) {
    add({ id: 'res-' + r.url.replace(/^https?:\/\/(www\.)?/, '').replace(/[^a-z0-9]+/gi, '-').replace(/-$/, ''), topic: 'resources', label: r.name, url: r.url, text: `${r.name}: ${r.what}` })
  }

  /* ---- hand-written general topics ---- */
  const general = JSON.parse(rd('knowledge/general.json')).chunks
  for (const g of general) add({ ...g })

  const ids = new Set()
  for (const c of chunks) {
    if (ids.has(c.id)) throw new Error('duplicate chunk id ' + c.id)
    ids.add(c.id)
    if (!c.label || !/^https:\/\//.test(c.url) || !c.text) throw new Error('bad chunk ' + c.id)
  }
  return chunks
}

/** The prompt-ready text: one block per chunk, with its URL, so the model can cite by URL. */
export function toMarkdown(chunks) {
  return chunks.map((c) => `## [${c.id}] ${c.label}\nURL: ${c.url}\n${c.text}`).join('\n\n') + '\n'
}

const outJson = join(ROOT, 'knowledge/chunks.json'), outMd = join(ROOT, 'knowledge/knowledge.md')
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const chunks = await build()
  const json = JSON.stringify(chunks, null, 2) + '\n', md = toMarkdown(chunks)
  if (process.argv.includes('--check')) {
    const same = existsSync(outJson) && readFileSync(outJson, 'utf8') === json && existsSync(outMd) && readFileSync(outMd, 'utf8') === md
    if (!same) { console.error('knowledge/ is out of date: run node tools/vita/build-knowledge.mjs'); process.exit(1) }
    console.log(`knowledge/ up to date (${chunks.length} chunks)`)
  } else {
    writeFileSync(outJson, json); writeFileSync(outMd, md)
    console.log(`wrote ${chunks.length} chunks, ${md.length} chars`)
  }
}
