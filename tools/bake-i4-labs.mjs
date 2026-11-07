#!/usr/bin/env node
/* ============================================================
   AstroDocX — Inspiration4 lab baker.

   Turns three small public tables from NASA's Open Science Data Repository (OSDR) into one
   compact JSON the NASA Data screen draws from:
     OSD-569  Complete Blood Count            (LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv)
     OSD-575  Comprehensive Metabolic Panel   (LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv)
     OSD-575  Serum cardiovascular panel      (LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv)
   Four anonymised crew (C001..C004) x seven timepoints (L-92, L-44, L-3 before launch; R+1, R+45, R+82, R+194 after).

   Usage
     node tools/bake-i4-labs.mjs [--dir <folder with the 3 csv files>] [--out app/src/nasa/i4-labs.json]
   Without --dir the files are downloaded from osdr.nasa.gov.

   Rows that cannot be real (see `impossible`) are left out and listed under `excluded`.
   Only values and lab reference ranges that the files carry are kept; the multiplex cardiovascular panel
   has no reference ranges, so those markers have none. Unit conversions are listed per marker (`scale`).
============================================================ */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const OUT = resolve(ROOT, arg('out', 'app/src/nasa/i4-labs.json'))
const DIR = arg('dir')

const FILES = {
  cbc: { osd: 'OSD-569', file: 'LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv' },
  cmp: { osd: 'OSD-575', file: 'LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv' },
  cardio: { osd: 'OSD-575', file: 'LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv' },
}

/* id, label, panel, unit shown, source column stem, scale from the file's unit to the shown one, note */
const MARKERS = [
  { id: 'wbc', label: 'White blood cells', panel: 'cbc', unit: '10³/µL', col: 'white_blood_cell_count_value_thousand_per_microliter', range: ['white_blood_cell_count_range_min_thousand_per_microliter', 'white_blood_cell_count_range_max_thousand_per_microliter'] },
  { id: 'lymph', label: 'Lymphocytes (absolute)', panel: 'cbc', unit: 'cells/µL', col: 'absolute_lymphocytes_value_cells_per_microliter', range: ['absolute_lymphocytes_range_min_cells_per_microliter', 'absolute_lymphocytes_range_max_cells_per_microliter'] },
  { id: 'neut', label: 'Neutrophils (absolute)', panel: 'cbc', unit: 'cells/µL', col: 'absolute_neutrophils_value_cells_per_microliter', range: ['absolute_neutrophils_range_min_cells_per_microliter', 'absolute_neutrophils_range_max_cells_per_microliter'] },
  { id: 'plt', label: 'Platelets', panel: 'cbc', unit: '10³/µL', col: 'platelet_count_value_thousand_per_microliter', range: ['platelet_count_range_min_thousand_per_microliter', 'platelet_count_range_max_thousand_per_microliter'] },
  { id: 'hgb', label: 'Hemoglobin', panel: 'cbc', unit: 'g/dL', col: 'hemoglobin_value_percent', range: ['hemoglobin_range_min_percent', 'hemoglobin_range_max_percent'] },
  { id: 'glu', label: 'Glucose', panel: 'cmp', unit: 'mg/dL', col: 'glucose_value_milligram_per_deciliter', range: ['glucose_range_min_milligram_per_deciliter', 'glucose_range_max_milligram_per_deciliter'] },
  { id: 'ca', label: 'Calcium', panel: 'cmp', unit: 'mg/dL', col: 'calcium_value_milligram_per_deciliter', range: ['calcium_range_min_milligram_per_deciliter', 'calcium_range_max_milligram_per_deciliter'] },
  { id: 'alp', label: 'Alkaline phosphatase', panel: 'cmp', unit: 'U/L', col: 'alkaline_phosphatase_value_units_per_liter', range: ['alkaline_phosphatase_range_min_units_per_liter', 'alkaline_phosphatase_range_max_units_per_liter'] },
  // research multiplex immunoassay, no clinical reference range; pg/mL -> mg/L is exactly /1e6
  { id: 'crp', label: 'C-reactive protein', panel: 'cardio', unit: 'mg/L', col: 'crp_concentration_picogram_per_milliliter', scale: 1e-6 },
  // kept in the file's own unit: the multiplex readout is a diluted research assay, so a clinical mg/dL conversion would mislead
  { id: 'fib', label: 'Fibrinogen', panel: 'cardio', unit: 'ng/mL', col: 'fibrinogen_concentration_nanogram_per_milliliter' },
]

const CREW = ['C001', 'C002', 'C003', 'C004']
const TIMEPOINTS = ['L-92', 'L-44', 'L-3', 'R+1', 'R+45', 'R+82', 'R+194']

/** Minimal CSV reader (these files have no quoted commas). Strips a BOM. */
function parseCsv(text) {
  const [head, ...lines] = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean)
  const cols = head.split(',')
  return lines.map((l) => { const c = l.split(','); return Object.fromEntries(cols.map((k, i) => [k, c[i]])) })
}

async function load({ osd, file }) {
  if (DIR) return readFileSync(join(DIR, file), 'utf8')
  const url = `https://osdr.nasa.gov/geode-py/ws/studies/${osd}/download?source=datamanager&file=${encodeURIComponent(file)}`
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${res.status} for ${url}`)
  return res.text()
}

const round = (x) => +x.toPrecision(5)
const tables = {}
for (const [k, f] of Object.entries(FILES)) tables[k] = parseCsv(await load(f))

/*
 * NASA's own CBC table has a row that cannot be a real blood count: C003 at L-92 lists MPV 330 fL, RDW 32.4 %,
 * MCHC 29.6, platelets 12.9 and absolute neutrophils 10.1 cells/µL next to 71 % neutrophils (same in the submitted file).
 * Rows with a physiologically impossible MPV, RDW or MCHC are left out, and listed under `excluded`, rather than
 * drawn as if they were measurements.
 */
const col = (r, stem) => parseFloat(Object.entries(r).find(([k]) => k.startsWith(stem + '_value'))?.[1])
const impossible = (r) => col(r, 'mpv') > 20 || col(r, 'rdw') > 25 || col(r, 'mchc') < 30
const sampleOf = (r) => ({ crew: r['Sample Name'].split('_')[0], tp: r['Sample Name'].split('_').find((p) => /^[LR][-+]\d+$/.test(p)) })
const excluded = tables.cbc.filter(impossible).map((r) => ({ ...sampleOf(r), panel: 'cbc', reason: 'Implausible in the source table (MPV, RDW and MCHC out of physiological range; platelets and neutrophils inconsistent with the other counts)' }))
tables.cbc = tables.cbc.filter((r) => !impossible(r))

const markers = MARKERS.map((m) => {
  const rows = tables[m.panel]
  const scale = m.scale ?? 1
  const values = Object.fromEntries(CREW.map((c) => [c, {}]))
  for (const r of rows) {
    const { crew, tp } = sampleOf(r)
    if (!CREW.includes(crew) || !TIMEPOINTS.includes(tp)) continue
    const v = parseFloat(r[m.col])
    if (!Number.isFinite(v)) throw new Error(`no value for ${m.id} ${crew} ${tp}`)
    values[crew][tp] = round(v * scale)
  }
  for (const c of CREW) for (const t of TIMEPOINTS) {
    if (values[c][t] !== undefined) continue
    if (excluded.some((e) => e.panel === m.panel && e.crew === c && e.tp === t)) values[c][t] = null
    else throw new Error(`missing ${m.id} ${c} ${t}`)
  }
  const out = { id: m.id, label: m.label, unit: m.unit, osd: FILES[m.panel].osd, source: FILES[m.panel].file }
  if (m.range) {
    const lo = parseFloat(rows[0][m.range[0]]), hi = parseFloat(rows[0][m.range[1]])
    if (!(lo < hi)) throw new Error(`bad reference range for ${m.id}`)
    out.refMin = lo; out.refMax = hi
  }
  out.values = values
  return out
})

const json = {
  about: 'SpaceX Inspiration4 (Sep 2021) crew blood and serum lab values from NASA OSDR, 4 anonymised crew, 7 timepoints. Baked by tools/bake-i4-labs.mjs.',
  fetched: new Date().toISOString().slice(0, 10),
  crew: CREW,
  timepoints: TIMEPOINTS,
  studies: [...new Set(Object.values(FILES).map((f) => f.osd))],
  excluded,
  markers,
}
writeFileSync(OUT, JSON.stringify(json) + '\n')
console.log(`wrote ${markers.length} markers x ${CREW.length} crew x ${TIMEPOINTS.length} timepoints -> ${OUT}`)
