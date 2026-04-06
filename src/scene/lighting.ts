import * as THREE from 'three'
import { TANK } from './tank'

export interface Lights {
  ambient: THREE.AmbientLight
  overhead: THREE.DirectionalLight
  causticLight: THREE.SpotLight
}

export function createLighting(scene: THREE.Scene): Lights {
  const ambient = new THREE.AmbientLight(0x88bbdd, 1.5)
  scene.add(ambient)

  const overhead = new THREE.DirectionalLight(0xffffff, 2.0)
  overhead.position.set(0, TANK.height, 2)
  overhead.target.position.set(0, -TANK.height / 2, 0)
  overhead.castShadow = true
  overhead.shadow.mapSize.width = 1024
  overhead.shadow.mapSize.height = 1024
  overhead.shadow.camera.left = -TANK.width / 2
  overhead.shadow.camera.right = TANK.width / 2
  overhead.shadow.camera.top = TANK.depth / 2
  overhead.shadow.camera.bottom = -TANK.depth / 2
  overhead.shadow.camera.near = 1
  overhead.shadow.camera.far = TANK.height * 3
  scene.add(overhead)
  scene.add(overhead.target)

  // Front fill light — brightens fish facing the camera
  const fill = new THREE.DirectionalLight(0x8899bb, 0.8)
  fill.position.set(0, 2, 10)
  scene.add(fill)

  const causticLight = new THREE.SpotLight(0x66ccff, 0.8, 20, Math.PI / 4, 0.5)
  causticLight.position.set(0, TANK.height / 2 + 1, 0)
  causticLight.target.position.set(0, -TANK.height / 2, 0)
  scene.add(causticLight)
  scene.add(causticLight.target)

  return { ambient, overhead, causticLight }
}

export function updateCaustics(lights: Lights, time: number): void {
  lights.causticLight.position.x = Math.sin(time * 0.4) * 2
  lights.causticLight.position.z = Math.cos(time * 0.3) * 1.5
}
