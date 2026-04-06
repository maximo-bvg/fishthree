import * as THREE from 'three'
import { createTank, updateWaterSurface } from './scene/tank'
import { createCamera, updateParallax } from './scene/camera'
import { createLighting, updateCaustics } from './scene/lighting'

const app = document.getElementById('app')!

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a3d6b)

const camera = createCamera(window.innerWidth / window.innerHeight)

const lights = createLighting(scene)

const tank = createTank(scene)

const clock = new THREE.Clock()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

function animate() {
  requestAnimationFrame(animate)
  const elapsed = clock.getElapsedTime()
  updateWaterSurface(tank.waterSurface, elapsed)
  updateParallax(camera)
  updateCaustics(lights, elapsed)
  renderer.render(scene, camera)
}

animate()
