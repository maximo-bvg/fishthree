import * as THREE from 'three'
import { createTank, updateWaterSurface } from './scene/tank'
import { createCamera, updateParallax } from './scene/camera'

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

// Temporary light so we can see the tank
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

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
  renderer.render(scene, camera)
}

animate()
