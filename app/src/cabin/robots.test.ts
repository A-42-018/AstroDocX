// @vitest-environment jsdom
import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { expect, it } from 'vitest'
import { createRobots } from './robots'

/** A stand-in for tars.glb: four slab nodes, one of them carrying the transparent face decal. */
function fakeLoader() {
  const scene = new THREE.Group()
  for (let k = 0; k < 4; k++) {
    const slab = new THREE.Group(); slab.name = `slab${k}`
    const mat = k === 2 ? new THREE.MeshStandardMaterial({ transparent: true, map: new THREE.Texture() }) : new THREE.MeshStandardMaterial()
    slab.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), mat))
    scene.add(slab)
  }
  return { loadAsync: async () => ({ scene }) } as unknown as GLTFLoader
}

const run = (r: ReturnType<typeof createRobots>, s: number) => { for (let i = 0; i < s * 60; i++) r.update(1 / 60, 1, i / 60) }

it('VITA stops and turns to face the camera while attending, then walks on; MEDI keeps walking', async () => {
  const scene = new THREE.Scene()
  const robots = createRobots(scene, fakeLoader(), '/models/')
  await robots.loaded
  robots.mount(null)
  const vita = robots.vita.object()!, medi = scene.children[1] as THREE.Object3D
  expect(vita.children[0].getObjectByProperty('isMesh', true)!.userData.vita).toBe(true)
  run(robots, 1)
  const z0 = vita.position.z, m0 = medi.position.z
  run(robots, 1)
  expect(vita.position.z).not.toBeCloseTo(z0, 2) // walking

  const cam = new THREE.Vector3(vita.position.x - 3, 0, vita.position.z)
  robots.vita.attend(cam)
  robots.vita.talk(true)
  run(robots, 2)
  const held = vita.position.clone()
  run(robots, 1)
  expect(vita.position.distanceTo(held)).toBeLessThan(1e-6) // stands still
  const want = Math.atan2(-(cam.z - vita.position.z), cam.x - vita.position.x)
  expect(Math.cos(vita.rotation.y - want)).toBeGreaterThan(0.999) // faces the camera
  expect(medi.position.z).not.toBeCloseTo(m0, 2) // MEDI does not stop

  robots.vita.talk(false)
  robots.vita.release()
  run(robots, 4)
  expect(vita.position.distanceTo(held)).toBeGreaterThan(0.05) // back on its route
})
