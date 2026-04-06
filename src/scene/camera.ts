import * as THREE from 'three'

const BASE_POSITION = new THREE.Vector3(0, 0.5, 14)
const PARALLAX_STRENGTH = 0.3
const PARALLAX_SMOOTHING = 0.05

const mouse = { x: 0, y: 0 }
const smoothMouse = { x: 0, y: 0 }

export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100)
  camera.position.copy(BASE_POSITION)

  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
  })

  return camera
}

export function updateParallax(camera: THREE.PerspectiveCamera): void {
  smoothMouse.x += (mouse.x - smoothMouse.x) * PARALLAX_SMOOTHING
  smoothMouse.y += (mouse.y - smoothMouse.y) * PARALLAX_SMOOTHING

  camera.position.x = BASE_POSITION.x + smoothMouse.x * PARALLAX_STRENGTH
  camera.position.y = BASE_POSITION.y + smoothMouse.y * PARALLAX_STRENGTH * 0.5
  camera.lookAt(0, 0, 0)
}
