import * as THREE from 'three'
import { createTank, updateWaterSurface } from './scene/tank'
import { createCamera, updateParallax } from './scene/camera'
import { createLighting, updateCaustics } from './scene/lighting'
import { Fish, type StateContext } from './fish/fish'
import { type SpeciesId } from './fish/species'
import {
  updateWander, updateSchool, updateFlee, updateHide,
  updateTerritorial, updatePredatorPatrol, updateReact,
} from './fish/behaviors'

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
const tank = createTank(scene)
const lights = createLighting(scene)

// Mouse world position (projected onto z=0 plane)
const raycaster = new THREE.Raycaster()
const mouseNDC = new THREE.Vector2(999, 999)
const mouseWorld = new THREE.Vector3()
const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

window.addEventListener('mousemove', (e) => {
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1
})

// Spawn initial fish
const fishes: Fish[] = []

function addFish(speciesId: SpeciesId, name: string): Fish {
  const fish = new Fish(speciesId, name)
  fishes.push(fish)
  scene.add(fish.mesh)
  return fish
}

// Default tank population
addFish('tetra', 'Neon 1')
addFish('tetra', 'Neon 2')
addFish('tetra', 'Neon 3')
addFish('clownfish', 'Nemo')
addFish('angelfish', 'Grace')
addFish('pufferfish', 'Puff')
addFish('barracuda', 'Cuda')
addFish('seahorse', 'Coral')

const clock = new THREE.Clock()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

function updateFishBehaviors(dt: number): void {
  raycaster.setFromCamera(mouseNDC, camera)
  raycaster.ray.intersectPlane(mousePlane, mouseWorld)

  for (const fish of fishes) {
    const threats: THREE.Vector3[] = []
    const school: Fish[] = []
    const intruders: Fish[] = []

    for (const other of fishes) {
      if (other === fish) continue
      const dist = fish.position.distanceTo(other.position)
      if (other.species.behaviorType === 'predator' && dist < 3.0) {
        threats.push(other.position)
      }
      if (other.speciesId === fish.speciesId && dist < 3.0) {
        school.push(other)
      }
      if (dist < 2.0) {
        intruders.push(other)
      }
    }

    const mouseDist = fish.position.distanceTo(mouseWorld)

    const ctx: StateContext = {
      threats: threats.map(t => ({ distance: fish.position.distanceTo(t) })),
      shelters: [],
      school: school.map(s => ({ distance: fish.position.distanceTo(s.position) })),
      mouse: mouseDist < 3.0 ? { distance: mouseDist } : null,
      homeDecor: null,
    }

    fish.stateMachine.update(dt, ctx)

    switch (fish.stateMachine.current) {
      case 'wander':
      case 'idle':
        if (fish.species.behaviorType === 'predator') {
          updatePredatorPatrol(fish, dt)
        } else {
          updateWander(fish, dt)
        }
        break
      case 'school':
        updateSchool(fish, school, dt)
        break
      case 'flee':
        updateFlee(fish, threats, dt)
        break
      case 'hide':
        updateHide(fish, [], dt)
        break
      case 'territorial':
        updateTerritorial(fish, new THREE.Vector3(0, -2, 0), intruders, dt)
        break
      case 'react':
        updateReact(fish, mouseWorld, dt)
        break
    }

    fish.update(dt)
  }
}

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const elapsed = clock.getElapsedTime()

  updateFishBehaviors(dt)
  updateWaterSurface(tank.waterSurface, elapsed)
  updateCaustics(lights, elapsed)
  updateParallax(camera)

  renderer.render(scene, camera)
}

animate()
