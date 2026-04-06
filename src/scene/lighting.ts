import * as THREE from 'three'
import { TANK } from './tank'

export interface Lights {
  ambient: THREE.AmbientLight
  hemi: THREE.HemisphereLight
  overhead: THREE.DirectionalLight
  fill: THREE.DirectionalLight
  leftFill: THREE.DirectionalLight
  rightFill: THREE.DirectionalLight
  causticLight: THREE.SpotLight
}

export function createLighting(scene: THREE.Scene): Lights {
  const ambient = new THREE.AmbientLight(0xaaddee, 4.0)
  scene.add(ambient)

  // Hemisphere light — bright from top, moderate from below, fills the whole tank
  const hemi = new THREE.HemisphereLight(0xffffff, 0x446688, 8.0)
  scene.add(hemi)

  const overhead = new THREE.DirectionalLight(0xffffff, 2.85)
  overhead.position.set(0, TANK.height, 0)
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
  const fill = new THREE.DirectionalLight(0x8899bb, 2.0)
  fill.position.set(0, 2, 10)
  scene.add(fill)

  // Side fill lights — prevent dark silhouettes on fish facing sideways
  const leftFill = new THREE.DirectionalLight(0x6688aa, 1.0)
  leftFill.position.set(-TANK.width / 2, 1, 0)
  scene.add(leftFill)

  const rightFill = new THREE.DirectionalLight(0x6688aa, 1.0)
  rightFill.position.set(TANK.width / 2, 1, 0)
  scene.add(rightFill)

  // Bottom light — shines upward from the floor
  const bottomLight = new THREE.DirectionalLight(0x88bbdd, 3.0)
  bottomLight.position.set(0, -TANK.height / 2, 0)
  bottomLight.target.position.set(0, TANK.height, 0)
  scene.add(bottomLight)
  scene.add(bottomLight.target)

  const causticLight = new THREE.SpotLight(0x66ccff, 0.8, 20, Math.PI / 4, 0.5)
  causticLight.position.set(0, TANK.height / 2 + 1, 0)
  causticLight.target.position.set(0, -TANK.height / 2, 0)
  scene.add(causticLight)
  scene.add(causticLight.target)

  return { ambient, hemi, overhead, fill, leftFill, rightFill, causticLight }
}

export function updateCaustics(lights: Lights, time: number): void {
  lights.causticLight.position.x = Math.sin(time * 0.4) * 2
  lights.causticLight.position.z = Math.cos(time * 0.3) * 1.5
}
