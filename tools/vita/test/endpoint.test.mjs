import test from 'node:test'
import assert from 'node:assert/strict'
import { createHandler, loadKnowledge, validateReply, parseInput, cleanText, makeLimiter, systemPrompt, LIMITS, MODEL } from '../../../api/_vita.js'

const kb = loadKnowledge()
const GOOD = [...kb.byUrl.keys()].find((u) => u.includes('ochmo-tb-004'))

test('model is claude-haiku-5-5', () => assert.equal(MODEL, 'claude-haiku-5-5'))

test('validateReply: citations not in the knowledge base are dropped; labels come from the KB', () => {
  const r = validateReply({ covered: true, text: 'ok', citations: [{ url: GOOD }, { url: 'https://example.com/made-up' }, { url: GOOD }, { url: 'https://www.nasa.gov/invented' }], actions: [] }, kb)
  assert.equal(r.citations.length, 1)
  assert.equal(r.citations[0].url, GOOD)
  assert.equal(r.citations[0].label, kb.byUrl.get(GOOD))
  assert.equal(r.source, 'live')
})
test('validateReply: bad action targets are dropped', () => {
  const r = validateReply({ text: 'ok', citations: [], actions: [
    { label: 'a', kind: 'console', target: '/alerts' }, { label: 'b', kind: 'console', target: '/admin' }, { label: 'c', kind: 'console', target: '/board?x=<script>' },
    { label: 'd', kind: 'console', target: '/board?crew=pilot' }, { label: 'e', kind: 'library', target: 'moon' }, { label: 'f', kind: 'library', target: 'twins-study' },
    { label: 'g', kind: 'cabin', target: 'secret' }, { label: 'h', kind: 'cabin', target: 'eva' }, { label: 'i', kind: 'tour', target: 'x' }, { label: 'j', kind: 'weird', target: '' }, null, 'str',
  ] }, kb)
  assert.deepEqual(r.actions.map((a) => `${a.kind}:${a.target}`), ['console:/alerts', 'console:/board?crew=pilot'])
  const r2 = validateReply({ text: 'ok', citations: [], actions: [{ label: 'e', kind: 'library', target: 'moon' }, { label: 'f', kind: 'library', target: 'twins-study' }, { label: 'g', kind: 'cabin', target: 'secret' }, { label: 'h', kind: 'cabin', target: 'eva' }, { label: 'i', kind: 'tour', target: 'x' }] }, kb)
  assert.deepEqual(r2.actions.map((a) => `${a.kind}:${a.target}`), ['library:twins-study', 'cabin:eva'])
})
test('validateReply: not covered => no citations; empty/garbage => null; text sanitised', () => {
  assert.deepEqual(validateReply({ covered: false, text: 'My sources do not cover that.', citations: [{ url: GOOD }], actions: [] }, kb).citations, [])
  assert.equal(validateReply({ text: '   ' }, kb), null)
  assert.equal(validateReply(null, kb), null)
  assert.equal(cleanText('a <b>b</b> <em>c</em> <img src=x onerror=1> d </em><em>e'), 'a b <em>c</em> d <em>e</em>')
})
test('parseInput: limits', () => {
  assert.ok(parseInput({}).error)
  assert.ok(parseInput({ question: 'x'.repeat(LIMITS.maxQuestion + 1) }).error)
  assert.ok(parseInput({ question: 'hi', history: 'x' }).error)
  const long = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: 'm' + i }))
  const p = parseInput({ question: 'now', history: long })
  assert.ok(p.messages.length <= LIMITS.maxHistory + 1)
  assert.equal(p.messages[0].role, 'user'); assert.equal(p.messages.at(-1).content, 'now')
  for (let i = 1; i < p.messages.length; i++) assert.notEqual(p.messages[i].role, p.messages[i - 1].role)
})
test('limiter: per-minute cap, then recovers', () => {
  let t = 0; const allow = makeLimiter({ perMinute: 2, perHour: 100, dailyCap: 100 }, () => t)
  assert.ok(allow('a')); assert.ok(allow('a')); assert.equal(allow('a'), false); assert.ok(allow('b'))
  t = 61_000; assert.ok(allow('a'))
})
test('limiter: daily cap', () => { const allow = makeLimiter({ perMinute: 99, perHour: 99, dailyCap: 1 }, () => 0); assert.ok(allow('a')); assert.equal(allow('b'), false) })
test('system prompt carries the whole knowledge base and the safety rules', () => {
  const s = systemPrompt(kb)
  for (const c of kb.chunks) assert.ok(s.includes(c.url), c.id)
  assert.match(s, /never diagnose/i); assert.match(s, /120 words/); assert.match(s, /NASA endorses/)
})

/* ---------- handler with a mocked Anthropic client ---------- */
const res = () => { const r = { headers: {}, setHeader(k, v) { r.headers[k] = v }, end(b) { r.body = b ? JSON.parse(b) : null } }; return r }
const req = (body, o = {}) => ({ method: 'POST', headers: { 'x-forwarded-for': o.ip ?? '1.1.1.1' }, body, ...o })
const mockClient = (reply, calls = []) => ({ messages: { create: async (p, opts) => { calls.push({ p, opts }); return typeof reply === 'function' ? reply(p) : reply } } })
const ok = (obj) => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(obj) }] })
const env = { ANTHROPIC_API_KEY: 'test-key' }
const mk = (client, e = env) => createHandler({ getClient: async () => client, kb, env: e, limiter: makeLimiter({ perMinute: 99, perHour: 99, dailyCap: 99 }) })

test('handler: 503 when ANTHROPIC_API_KEY is missing, and the client is never created', async () => {
  let made = false
  const h = createHandler({ getClient: async () => { made = true }, kb, env: {} })
  const r = res(); await h(req({ question: 'hi' }), r)
  assert.equal(r.statusCode, 503); assert.equal(made, false)
})
test('handler: 405 on GET, 400 on bad input, 413 on large body', async () => {
  const h = mk(mockClient(ok({})))
  let r = res(); await h({ method: 'GET', headers: {} }, r); assert.equal(r.statusCode, 405)
  r = res(); await h(req({ question: '' }), r); assert.equal(r.statusCode, 400)
  r = res(); await h(req({ question: 'x' }, { headers: { 'content-length': '999999' } }), r); assert.equal(r.statusCode, 413)
})
test('handler: 200 with validated reply; request uses haiku, cached system, structured output, token cap, timeout', async () => {
  const calls = []
  const h = mk(mockClient(ok({ covered: true, text: 'CO2 is limited to <em>3 mmHg</em>.', citations: [{ url: GOOD }, { url: 'https://evil.example/x' }], actions: [{ label: 'Sim', kind: 'console', target: '/simulator' }, { label: 'X', kind: 'console', target: '/nope' }] }), calls))
  const r = res(); await h(req('{"question":"What is the CO2 limit?","history":[{"role":"user","text":"hi"},{"role":"assistant","text":"hello"}]}'), r)
  assert.equal(r.statusCode, 200)
  assert.deepEqual(r.body, { text: 'CO2 is limited to <em>3 mmHg</em>.', citations: [{ label: kb.byUrl.get(GOOD), url: GOOD }], actions: [{ label: 'Sim', kind: 'console', target: '/simulator' }], source: 'live' })
  const { p, opts } = calls[0]
  assert.equal(p.model, 'claude-haiku-5-5'); assert.equal(p.max_tokens, LIMITS.maxTokens)
  assert.deepEqual(p.system[0].cache_control, { type: 'ephemeral' })
  assert.equal(p.output_config.format.type, 'json_schema')
  assert.equal(opts.timeout, LIMITS.timeoutMs)
  assert.equal(p.messages.length, 3); assert.equal(p.messages.at(-1).content, 'What is the CO2 limit?')
  assert.equal('temperature' in p, false)
})
test('handler: 502 on upstream error, refusal, max_tokens, non-JSON and empty text; no details leaked', async () => {
  const bad = [() => { throw Object.assign(new Error('secret sk-ant-123'), { status: 500 }) },
    () => ({ stop_reason: 'refusal', content: [] }), () => ({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{' }] }),
    () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }), () => ok({ covered: true, text: '', citations: [], actions: [] })]
  for (const f of bad) { const r = res(); await mk(mockClient(f))(req({ question: 'hi' }), r); assert.equal(r.statusCode, 502); assert.ok(!JSON.stringify(r.body).includes('sk-ant')) }
})
test('handler: 429 after the rate limit', async () => {
  const h = createHandler({ getClient: async () => mockClient(ok({ text: 'a', citations: [], actions: [] })), kb, env, limiter: makeLimiter({ perMinute: 1, perHour: 9, dailyCap: 9 }) })
  let r = res(); await h(req({ question: 'a' }), r); assert.equal(r.statusCode, 200)
  r = res(); await h(req({ question: 'a' }), r); assert.equal(r.statusCode, 429); assert.equal(r.headers['Retry-After'], '60')
})
