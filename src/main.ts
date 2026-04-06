import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { createTank, updateWaterSurface, TANK } from './scene/tank'
import { createCamera } from './scene/camera'
import { CameraController } from './scene/camera-modes'
import { createLighting, updateCaustics } from './scene/lighting'
import { DayNightCycle } from './scene/day-night'
import {
  createParticles, updateParticles,
  createLightRays, updateLightRays,
  initBubbles, updateBubbles,
  createCausticOverlays, updateCausticOverlays,
  createUnderwaterPass, updateUnderwaterPass,
} from './scene/underwater'
import { Fish, type StateContext } from './fish/fish'
import { type SpeciesId, SPECIES } from './fish/species'
import { preloadModels } from './fish/mesh'
import {
  updateWander, updateSchool, updateFlee, updateHide,
  updateTerritorial, updatePredatorPatrol, updateReact, updateFeed,
} from './fish/behaviors'
import { FlakeManager } from './feeding/flakes'
import { SlotManager, SLOT_DEFINITIONS } from './decorations/slots'
import { type DecorationId } from './decorations/catalog'
import { DecorationEffects } from './decorations/effects'
import { HUD } from './ui/hud'
import { EditModeUI } from './ui/edit-mode'
import { showFishListPanel, showAddFishPanel, showSettingsPanel, type PanelCallbacks } from './ui/panels'
import { saveState, loadState, DEFAULT_SETTINGS, type TankState, type TankSettings } from './utils/storage'

// --- Renderer setup ---
const app = document.getElementById('app')!
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
app.appendChild(renderer.domElement)

// --- Post-processing ---
const composer = new EffectComposer(renderer)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x2a7abb)
scene.fog = new THREE.FogExp2(0x1a7aaa, 0.05)

const camera = createCamera(window.innerWidth / window.innerHeight)
const cameraController = new CameraController(camera, renderer.domElement)
const tankMeshes = createTank(scene)
const lights = createLighting(scene)

// Underwater atmosphere
const lightRays = createLightRays(scene)
createParticles(scene)
initBubbles(scene)
createCausticOverlays(scene)

const renderPass = new RenderPass(scene, camera)
composer.addPass(renderPass)

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.3,  // strength
  0.4,  // radius
  0.85, // threshold
)
composer.addPass(bloomPass)

const underwaterPass = createUnderwaterPass()
composer.addPass(underwaterPass)

const dayNight = new DayNightCycle(lights, scene)
dayNight.setUnderwaterPass(underwaterPass)

// Depth-of-field disabled — was blurring fish at different depths
// const bokehPass = new BokehPass(scene, camera, {
//   focus: 14.0,
//   aperture: 0.002,
//   maxblur: 0.005,
// })
// composer.addPass(bokehPass)

const slotManager = new SlotManager()
const effects = new DecorationEffects(scene)
const flakeManager = new FlakeManager(scene)

// --- State ---
const fishes: Fish[] = []
let tankName = 'My Reef Tank'
let settings: TankSettings = { ...DEFAULT_SETTINGS }
let isEditMode = false
let editModeUI: EditModeUI | null = null
let selectedDecorationId: DecorationId | null = null

const MAX_FISH = 12
const MAX_DECOR = 20

// --- Mouse tracking ---
const raycaster = new THREE.Raycaster()
const mouseNDC = new THREE.Vector2(999, 999)
const mouseWorld = new THREE.Vector3()
const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

window.addEventListener('mousemove', (e) => {
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1
})

// --- Slot click detection ---
const slotIndicators: THREE.Mesh[] = []

function createSlotIndicators(): void {
  const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8)
  const mat = new THREE.MeshBasicMaterial({
    color: 0x22aa55,
    transparent: true,
    opacity: 0.2,
    wireframe: true,
  })
  for (const def of SLOT_DEFINITIONS) {
    const indicator = new THREE.Mesh(geo, mat.clone())
    indicator.position.copy(def.position)
    indicator.visible = false
    scene.add(indicator)
    slotIndicators.push(indicator)
  }
}
createSlotIndicators()

function showSlotIndicators(): void {
  slotIndicators.forEach((ind, i) => {
    const slot = slotManager.getSlot(i)
    ind.visible = true
    ;(ind.material as THREE.MeshBasicMaterial).color.setHex(
      slot.decorationId ? 0xff6644 : 0x22aa55
    )
  })
}

function hideSlotIndicators(): void {
  slotIndicators.forEach(ind => { ind.visible = false })
}

// --- Click handler for slot placement ---
window.addEventListener('click', (e) => {
  if (!isEditMode) return

  raycaster.setFromCamera(
    new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    ),
    camera,
  )

  const hits = raycaster.intersectObjects(slotIndicators)
  if (hits.length > 0) {
    const slotIndex = slotIndicators.indexOf(hits[0].object as THREE.Mesh)
    if (slotIndex === -1) return

    const slot = slotManager.getSlot(slotIndex)
    if (slot.decorationId) {
      const mesh = slotManager.remove(slotIndex)
      if (mesh) {
        effects.unregister(mesh)
        scene.remove(mesh)
      }
    } else if (selectedDecorationId) {
      if (slotManager.place(slotIndex, selectedDecorationId)) {
        const newSlot = slotManager.getSlot(slotIndex)
        if (newSlot.mesh) {
          scene.add(newSlot.mesh)
          effects.register(selectedDecorationId, newSlot.mesh)
        }
      }
    }

    showSlotIndicators()
    updateHUDCounts()
    persistState()
  }
})

// --- Fish click + feed handler ---
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TANK.height / 2)
const waterIntersect = new THREE.Vector3()

window.addEventListener('click', (e) => {
  if (isEditMode) return

  raycaster.setFromCamera(
    new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1,
    ),
    camera,
  )

  // Try fish click first (camera follow)
  const fishMeshes = fishes.map(f => f.mesh)
  const hits = raycaster.intersectObjects(fishMeshes, true)
  if (hits.length > 0) {
    const hitObj = hits[0].object
    const fish = fishes.find(f => {
      let obj: THREE.Object3D | null = hitObj
      while (obj) {
        if (obj === f.mesh) return true
        obj = obj.parent
      }
      return false
    })
    if (fish) {
      cameraController.toFollow(fish.mesh)
      return
    }
  }

  // If in follow mode, clicking empty space returns to default
  if (cameraController.mode === 'follow') {
    cameraController.toDefault()
    return
  }

  // Otherwise, try feeding — click water surface to spawn flakes
  if (raycaster.ray.intersectPlane(waterPlane, waterIntersect)) {
    if (
      Math.abs(waterIntersect.x) < TANK.width / 2 &&
      Math.abs(waterIntersect.z) < TANK.depth / 2
    ) {
      flakeManager.spawnCluster(waterIntersect.clone())
    }
  }
})

// --- Fish management ---
function addFish(speciesId: SpeciesId, name: string): void {
  if (fishes.length >= MAX_FISH) return
  const fish = new Fish(speciesId, name)
  fishes.push(fish)
  scene.add(fish.mesh)
  updateHUDCounts()
  persistState()
}

function removeFish(index: number): void {
  if (index < 0 || index >= fishes.length) return
  const fish = fishes.splice(index, 1)[0]
  scene.remove(fish.mesh)
  cameraController.onFollowTargetRemoved()
  updateHUDCounts()
  persistState()
}

// --- HUD ---
const panelCallbacks: PanelCallbacks = {
  onAddFish: (speciesId, name) => { addFish(speciesId, name) },
  onRemoveFish: (index) => { removeFish(index) },
  onToggleCaustics: (on) => {
    settings.caustics = on
    lights.causticLight.visible = on
    persistState()
  },
  onToggleBloom: (on) => {
    settings.bloom = on
    persistState()
  },
  onSwayIntensity: (value) => {
    settings.swayIntensity = value
    persistState()
  },
  onScreenshot: () => {
    composer.render()
    const link = document.createElement('a')
    link.download = 'fishtank.png'
    link.href = renderer.domElement.toDataURL('image/png')
    link.click()
  },
}

const hud = new HUD(app, {
  onEditTank: () => enterEditMode(),
  onFishList: () => showFishListPanel(hud, fishes, panelCallbacks),
  onAddFish: () => showAddFishPanel(hud, fishes.length, MAX_FISH, panelCallbacks),
  onScreenshot: panelCallbacks.onScreenshot,
  onOrbitToggle: () => cameraController.toOrbit(),
  onResetCamera: () => cameraController.toDefault(),
  onSettings: () => showSettingsPanel(hud, settings, panelCallbacks),
  onTankNameChange: (name) => {
    tankName = name
    persistState()
  },
})

function updateHUDCounts(): void {
  hud.updateCounts(fishes.length, MAX_FISH, slotManager.getOccupied().length, MAX_DECOR)
}

// --- Edit mode ---
function enterEditMode(): void {
  isEditMode = true
  selectedDecorationId = null
  showSlotIndicators()
  hud.getBottomBar().style.display = 'none'

  editModeUI = new EditModeUI(app, {
    onSelectItem: (id) => { selectedDecorationId = id },
    onDone: () => exitEditMode(),
  })
}

function exitEditMode(): void {
  isEditMode = false
  hideSlotIndicators()
  hud.getBottomBar().style.display = ''
  editModeUI?.destroy()
  editModeUI = null
}

// --- Persistence ---
function persistState(): void {
  const state: TankState = {
    tankName,
    fishes: fishes.map(f => ({ speciesId: f.speciesId, name: f.name })),
    decorations: slotManager.serialize(),
    settings,
  }
  saveState(state)
}

function restoreState(): void {
  const state = loadState()
  if (!state) {
    addFish('tetra', 'Neon 1')
    addFish('tetra', 'Neon 2')
    addFish('tetra', 'Neon 3')
    addFish('clownfish', 'Nemo')
    addFish('angelfish', 'Grace')
    addFish('pufferfish', 'Puff')
    addFish('barracuda', 'Cuda')
    addFish('seahorse', 'Coral')
    return
  }

  tankName = state.tankName
  hud.setTankName(tankName)
  settings = { ...DEFAULT_SETTINGS, ...state.settings }
  lights.causticLight.visible = settings.caustics

  for (const fishSave of state.fishes) {
    addFish(fishSave.speciesId, fishSave.name)
  }

  const meshes = slotManager.deserialize(state.decorations)
  for (let i = 0; i < state.decorations.length; i++) {
    const mesh = meshes[i]
    if (mesh) {
      scene.add(mesh)
      effects.register(state.decorations[i].decorationId, mesh)
    }
  }

  updateHUDCounts()
}

// Preload GLB models, then restore state (spawns fish)
preloadModels(SPECIES).then(() => {
  restoreState()
})

// --- Fish behavior update ---
function getDecorationPositions(): THREE.Vector3[] {
  return slotManager.getOccupied().map(({ index }) => SLOT_DEFINITIONS[index].position)
}

function getRockPositions(): THREE.Vector3[] {
  return slotManager.getOccupied()
    .filter(({ state }) => {
      const id = state.decorationId
      return id === 'boulder' || id === 'rock_arch' || id === 'driftwood'
    })
    .map(({ index }) => SLOT_DEFINITIONS[index].position)
}

function getPlantPositions(): THREE.Vector3[] {
  return slotManager.getOccupied()
    .filter(({ state }) => {
      const id = state.decorationId
      return id === 'seaweed' || id === 'coral_fan' || id === 'anemone'
    })
    .map(({ index }) => SLOT_DEFINITIONS[index].position)
}

function updateFishBehaviors(dt: number): void {
  raycaster.setFromCamera(mouseNDC, camera)
  raycaster.ray.intersectPlane(mousePlane, mouseWorld)

  const decorPositions = getDecorationPositions()
  const rockPositions = getRockPositions()
  const plantPositions = getPlantPositions()
  const activeFlakes = flakeManager.getActiveFlakes()

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
    const shelters = rockPositions
    const homes = fish.species.behaviorType === 'anchorer' ? plantPositions : decorPositions

    let nearestHomeDist = Infinity
    let nearestHomePos: THREE.Vector3 | null = null
    for (const pos of homes) {
      const d = fish.position.distanceTo(pos)
      if (d < nearestHomeDist) {
        nearestHomeDist = d
        nearestHomePos = pos
      }
    }

    let nearestFlakeDist = Infinity
    let nearestFlakePos: THREE.Vector3 | null = null
    let nearestFlakeId: number | null = null
    for (const flake of activeFlakes) {
      const d = fish.position.distanceTo(flake.position)
      if (d < nearestFlakeDist) {
        nearestFlakeDist = d
        nearestFlakePos = flake.position
        nearestFlakeId = flake.id
      }
    }

    const ctx: StateContext = {
      threats: threats.map(t => ({ distance: fish.position.distanceTo(t) })),
      shelters: shelters.map(s => ({ distance: fish.position.distanceTo(s) })),
      school: school.map(s => ({ distance: fish.position.distanceTo(s.position) })),
      mouse: mouseDist < 3.0 ? { distance: mouseDist } : null,
      homeDecor: nearestHomePos ? { distance: nearestHomeDist } : null,
      nearestFlake: nearestFlakePos ? { distance: nearestFlakeDist } : null,
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
        updateHide(fish, shelters, dt)
        break
      case 'territorial':
        if (nearestHomePos) {
          updateTerritorial(fish, nearestHomePos, intruders, dt)
        } else {
          updateWander(fish, dt)
        }
        break
      case 'react':
        updateReact(fish, mouseWorld, dt)
        break
      case 'feed':
        if (nearestFlakePos && nearestFlakeId !== null) {
          fish.targetFlakeId = nearestFlakeId
          updateFeed(fish, nearestFlakePos, dt)
          // Check if fish reached the flake
          if (nearestFlakeDist < 0.3) {
            flakeManager.consume(nearestFlakeId)
            fish.targetFlakeId = null
          }
        } else {
          fish.targetFlakeId = null
          updateWander(fish, dt)
        }
        break
    }

    fish.update(dt)
  }
}

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
})

// --- Render loop ---
const clock = new THREE.Clock()
let lastTimeOfDay = ''

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const elapsed = clock.getElapsedTime()

  dayNight.update(dt)
  if (dayNight.timeOfDay !== lastTimeOfDay) {
    lastTimeOfDay = dayNight.timeOfDay
    hud.updateTimeIcon(lastTimeOfDay)
  }
  for (const fish of fishes) {
    fish.speedMultiplier = dayNight.speedMultiplier
  }
  updateFishBehaviors(dt)
  updateWaterSurface(tankMeshes, dt, elapsed)
  if (settings.caustics) updateCaustics(lights, elapsed)
  cameraController.update(dt)
  effects.update(elapsed)
  flakeManager.update(dt)
  updateParticles(elapsed, dt)
  updateLightRays(lightRays, elapsed)
  updateBubbles(elapsed, dt, camera)
  updateCausticOverlays(elapsed)
  updateUnderwaterPass(underwaterPass, elapsed)

  bloomPass.enabled = settings.bloom
  composer.render()
}

animate()
