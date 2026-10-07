/// <reference types="node" />
import 'fake-indexeddb/auto'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { ConsoleDB } from './db'
import { computeDemo, exportDemo, seedDemo } from './demo'
import snapshot from './demo-snapshot.json'

/**
 * The shipped snapshot must equal what the engine computes today. After changing the engine, the
 * generator or the demo options, regenerate it with `npm run demo:snapshot`.
 */
it('demo-snapshot.json matches a fresh engine run, and the fast seed equals the computed seed', async () => {
  const computed = new ConsoleDB('demo-computed')
  await computeDemo(computed)
  const expected = await exportDemo(computed)
  if (process.env.UPDATE_DEMO_SNAPSHOT) {
    writeFileSync(fileURLToPath(new URL('./demo-snapshot.json', import.meta.url)), JSON.stringify(expected) + '\n')
    return
  }
  expect(snapshot).toEqual(JSON.parse(JSON.stringify(expected)))

  const fast = new ConsoleDB('demo-fast')
  await seedDemo(undefined, fast)
  expect(await exportDemo(fast)).toEqual(expected)
  expect(await fast.readings.toArray()).toEqual(await computed.readings.toArray())
  expect(await fast.crew.toArray()).toEqual(await computed.crew.toArray())
}, 120_000)
