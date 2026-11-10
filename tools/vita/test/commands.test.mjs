import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseCommand, SCREENS, CABIN_STOPS, LIBRARY } from '../../../landing/vita/commands.js'

const act = (t, where) => parseCommand(t, { where })?.action
const loc = (t, where) => { const c = parseCommand(t, { where }); return c?.type === 'local' ? c.name : null }

test('screens', () => {
  const cases = [
    ['open alerts', '/alerts'], ['take me to the alerts', '/alerts'], ['go to check-in', '/checkin'], ['Hey NOVA, open the status board', '/board'],
    ['please show me trends', '/trends'], ['simulator', '/simulator'], ['ground sync', '/sync'], ['open sync', '/sync'], ['ground view', '/ground'],
    ['nasa data', '/nasa'], ['can you open the crew doctor', '/doctor'], ['dashboard', '/board'],
  ]
  for (const [t, path] of cases) assert.deepEqual([t, act(t, 'home')?.target], [t, path])
  assert.equal(act('open alerts', 'home').kind, 'console')
})

test('questions are not commands', () => {
  for (const t of ['what do the alerts mean', 'why does co2 matter', 'tell me about trends', 'how does the simulator work', 'show me how alerts work', 'is radiation dangerous', ''])
    assert.equal(parseCommand(t), null, t)
})

test('cabin and library', () => {
  assert.deepEqual(act('walk the station', 'home'), { label: 'Walk the station', kind: 'cabin', target: '' })
  assert.equal(act('take me to the cabin window', 'home').target, 'window')
  assert.equal(act('window', 'cabin').target, 'window')
  assert.equal(act('alerts', 'cabin').kind, 'cabin')
  assert.equal(act('simulator', 'cabin').kind, 'console')
  assert.equal(act('open the radiation library', 'home').target, 'radiation')
  assert.equal(act('twins study library', 'home').target, 'twins-study')
  assert.deepEqual(act('nasa library', 'home'), { label: 'Open the NASA Library', kind: 'library', target: '' })
  assert.equal(act('leave the cabin', 'cabin').target, '/board')
  assert.equal(act('start the tour', 'home').kind, 'tour')
})

test('local commands', () => {
  const cases = [['go back', 'back'], ['scroll down', 'scroll-down'], ['stop', 'stop-talking'], ['stop listening', 'voice-off'], ['mute', 'sound-off'],
    ['yes', 'follow'], ['open it', 'follow'], ['pause', 'tour-pause'], ['skip', 'tour-skip'], ['skip intro', 'skip-intro'], ['exit tour', 'tour-exit'],
    ['next', 'next'], ['previous', 'previous'], ['close', 'close'], ['go home', 'home'], ['what can I say', 'help'], ['scroll to the top', 'scroll-top']]
  for (const [t, name] of cases) assert.deepEqual([t, loc(t)], [t, name])
  assert.equal(parseCommand('health twin', { where: 'story' }).arg, 'twin')
})

test('every action target passes ask.js cleanAction rules', () => {
  const ok = (a) => a.kind === 'tour' ? a.target === '' : a.kind === 'library' ? a.target === '' || a.target in LIBRARY : a.kind === 'cabin' ? /^[\w-]{0,24}$/.test(a.target) : /^\/[a-z]+(\?[\w=&.\-]*)?$/.test(a.target)
  for (const s of SCREENS) for (const al of s.aliases) { const a = act(`open ${al}`, 'home'); assert.ok(a && ok(a), al) }
  for (const s of SCREENS) assert.equal(act(`open ${s.aliases[0]}`, 'console')?.target, s.path, s.path)
  for (const k of Object.keys(CABIN_STOPS)) assert.ok(ok(act(`cabin ${CABIN_STOPS[k][0]}`, 'home')), k)
})

test('vocabulary matches the code it mirrors', () => {
  const nav = readFileSync(new URL('../../../app/src/shell/nav.ts', import.meta.url), 'utf8')
  for (const s of SCREENS) assert.ok(nav.includes(`path: '${s.path}'`), `nav.ts has ${s.path}`)
  const cabin = readFileSync(new URL('../../../app/src/cabin/CabinPage.tsx', import.meta.url), 'utf8')
  const shots = cabin.match(/const SHOTS[^{]*\{([^}]*)\}/)[1].split(',').map((p) => p.split(':')[0].trim()).filter(Boolean)
  for (const name of Object.keys(CABIN_STOPS)) assert.ok(shots.includes(name), `SHOTS has ${name}`)
  const ask = readFileSync(new URL('../../../landing/vita/ask.js', import.meta.url), 'utf8')
  for (const id of Object.keys(LIBRARY)) assert.ok(ask.includes(`'${id}'`), `ask.js has ${id}`)
})
