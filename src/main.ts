import * as THREE from 'three'
import { createTank, updateWaterSurface } from './scene/tank'
import { createCamera, updateParallax } from './scene/camera'
import { createLighting, updateCaustics } from './scene/lighting'
import { SPECIES } from './fish/species'
import { createFishMesh, animateFishMesh } from './fish/mesh'

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

// Test fish — remove later
const testFish = createFishMesh(SPECIES.clownfish)
testFish.position.set(0, 0, 0)
scene.add(testFish)

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
  animateFishMesh(testFish, elapsed, 1.0, SPECIES.clownfish.tailFrequency)
  renderer.render(scene, camera)
}

animate()
