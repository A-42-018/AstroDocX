import test from 'node:test'
import assert from 'node:assert/strict'
import { createListener } from '../../../landing/vita/listen.js'

class FakeSR {
  static all = []
  constructor() { FakeSR.all.push(this); this.started = false }
  start() { this.started = true }
  stop() { this.started = false; queueMicrotask(() => this.onend?.()) }
  abort() { this.stop() }
  say(text, isFinal = true) { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] }) }
}
const tick = () => new Promise((r) => setTimeout(r, 0))
function make() {
  FakeSR.all = []
  const log = { interim: [], final: [], states: [], errors: [] }
  const mic = createListener({ SR: FakeSR, wait: (f) => setTimeout(f, 0), onInterim: (t) => log.interim.push(t), onFinal: (t) => log.final.push(t), onState: (s) => log.states.push(s), onError: (c) => log.errors.push(c) })
  return { mic, log, cur: () => FakeSR.all.at(-1) }
}

test('once: interim then final, then it stops', async () => {
  const { mic, log, cur } = make()
  mic.once(); assert.equal(mic.state, 'listening')
  cur().say('open al', false); cur().say('open alerts')
  await tick()
  assert.deepEqual(log.interim, ['open al']); assert.deepEqual(log.final, ['open alerts']); assert.equal(mic.state, 'idle')
})

test('hands-free restarts after the recognizer ends', async () => {
  const { mic, cur } = make()
  mic.setHandsFree(true)
  const first = cur(); assert.equal(first.continuous, true)
  first.onend(); await tick(); await tick()
  assert.equal(FakeSR.all.length, 2); assert.equal(mic.state, 'listening')
})

test('a denied mic turns voice mode off and says so', async () => {
  const { mic, log, cur } = make()
  mic.setHandsFree(true)
  cur().onerror({ error: 'not-allowed' })
  assert.equal(mic.state, 'denied'); assert.deepEqual(log.errors, ['not-allowed'])
  cur().onend?.(); await tick(); assert.equal(FakeSR.all.length, 1)
})

test('no-speech is ignored', () => {
  const { mic, log, cur } = make()
  mic.setHandsFree(true); cur().onerror({ error: 'no-speech' })
  assert.deepEqual(log.errors, [])
})

test('pause drops the mic and ignores results; resume listens again', async () => {
  const { mic, log, cur } = make()
  mic.setHandsFree(true)
  const first = cur()
  mic.pause('speaking'); assert.equal(mic.state, 'paused')
  first.say('this is the guide talking'); await tick()
  assert.deepEqual(log.final, [])
  mic.resume('speaking'); assert.equal(mic.state, 'listening'); assert.equal(FakeSR.all.length, 2)
})

test('stop ends everything', () => {
  const { mic } = make()
  mic.setHandsFree(true); mic.stop(); assert.equal(mic.state, 'idle'); assert.equal(mic.handsFree, false)
})
