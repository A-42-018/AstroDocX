import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ROUTERS, barsAt, stateOf } from './wifi'

const live = (hr: number, resp: number) => ({ live: { hr, resp, spo2: 97, co2: 2.4, dose: 25 }, status: 'nominal' as const })

describe('Wi-Fi view helpers', () => {
  it('reads a state from the live numbers', () => {
    expect(stateOf(live(62, 14))).toBe('Resting')
    expect(stateOf(live(95, 15))).toBe('Active')
    expect(stateOf(live(62, 24))).toBe('Elevated breathing')
    expect(stateOf({ ...live(62, 14), status: 'act' })).toBe('Elevated breathing')
  })

  it('signal bars fall with the distance to the nearest router', () => {
    const near = barsAt(ROUTERS[0].clone().add(new THREE.Vector3(1, -2, 0)))
    const far = barsAt(new THREE.Vector3(0, -2, 0.5 * 40))
    expect(near).toBe(4)
    expect(far).toBeLessThan(near)
    expect(far).toBeGreaterThanOrEqual(1)
  })
})
