import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { type SpeciesDefinition, type SpeciesId } from './species'
import { lowPolyMaterial, jitterVertices } from '../utils/geometry'

const loader = new GLTFLoader()

interface ModelData {
  scene: THREE.Group
  scale: number
  rotation: [number, number, number]
  center: THREE.Vector3
}

const modelCache = new Map<string, ModelData>()
const failedModels = new Set<string>()

/** Bone references discovered from a rigged GLB model */
interface FishBones {
  /** Spine chain ordered root-to-tip (longest bone chain in the skeleton) */
  spineChain: THREE.Bone[]
  /** Bones that branch off the spine (fins, jaw, etc.) */
  finBones: THREE.Bone[]
  /** Rest-pose rotations so we can animate additively */
  restRotations: Map<THREE.Bone, { x: number; y: number; z: number }>
}

/**
 * Walk the skeleton and categorise bones by topology:
 *  - The longest chain from the root bone = spine (head→tail)
 *  - Everything else = fin/appendage bones
 */
function discoverBones(model: THREE.Object3D): FishBones | null {
  const allBones: THREE.Bone[] = []
  model.traverse((child) => {
    if ((child as THREE.Bone).isBone) allBones.push(child as THREE.Bone)
  })
  if (allBones.length === 0) return null

  // Root = bone whose parent is NOT a bone
  const roots = allBones.filter(
    (b) => !b.parent || !(b.parent as THREE.Bone).isBone,
  )
  if (roots.length === 0) return null

  // Longest chain from root = spine
  function longestChain(bone: THREE.Bone): THREE.Bone[] {
    const kids = bone.children.filter((c) => (c as THREE.Bone).isBone) as THREE.Bone[]
    if (kids.length === 0) return [bone]
    let best: THREE.Bone[] = []
    for (const kid of kids) {
      const chain = longestChain(kid)
      if (chain.length > best.length) best = chain
    }
    return [bone, ...best]
  }

  const spineChain = longestChain(roots[0])
  const spineSet = new Set(spineChain)
  const finBones = allBones.filter((b) => !spineSet.has(b))

  // Store rest rotations
  const restRotations = new Map<THREE.Bone, { x: number; y: number; z: number }>()
  for (const bone of allBones) {
    restRotations.set(bone, { x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z })
  }

  console.log(
    `  bones: spine[${spineChain.map((b) => b.name).join('→')}] fins[${finBones.map((b) => b.name).join(',')}]`,
  )

  return { spineChain, finBones, restRotations }
}

/**
 * Preload all GLB models for the given species. Call once at startup.
 * Stores model data for later cloning. Falls back to procedural geometry on failure.
 */
export async function preloadModels(species: Record<string, SpeciesDefinition>): Promise<void> {
  // Load unique model paths only once, then create per-species entries with correct scale
  const loadedScenes = new Map<string, { scene: THREE.Group; nativeSize: THREE.Vector3; center: THREE.Vector3 }>()

  // First pass: load unique files
  const uniquePaths = new Set<string>()
  for (const def of Object.values(species)) {
    if (def.modelPath) uniquePaths.add(def.modelPath)
  }

  await Promise.all(
    [...uniquePaths].map(path =>
      loader.loadAsync(path)
        .then((gltf) => {
          const scene = gltf.scene
          scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true
            }
          })

          const box = new THREE.Box3().setFromObject(scene)
          const nativeSize = new THREE.Vector3()
          box.getSize(nativeSize)
          const center = new THREE.Vector3()
          box.getCenter(center)

          loadedScenes.set(path, { scene, nativeSize, center })
          console.log(`Loaded model: ${path} (native: ${nativeSize.x.toFixed(2)}x${nativeSize.y.toFixed(2)}x${nativeSize.z.toFixed(2)})`)
        })
        .catch(() => {
          console.log(`Model not found: ${path}`)
        })
    )
  )

  // Second pass: create per-species entries with correct scale
  for (const [id, def] of Object.entries(species)) {
    if (!def.modelPath) continue
    const loaded = loadedScenes.get(def.modelPath)
    if (!loaded) {
      failedModels.add(id)
      continue
    }

    const maxDim = Math.max(loaded.nativeSize.x, loaded.nativeSize.y, loaded.nativeSize.z)
    const targetSize = def.size * 3
    const scale = maxDim > 0 ? targetSize / maxDim : 1
    const rotation: [number, number, number] = (def.modelRotation ?? [0, 0, 0]) as [number, number, number]

    modelCache.set(id, { scene: loaded.scene, scale, rotation, center: loaded.center })
    console.log(`  → ${id}: scale ${scale.toFixed(3)}`)
  }
}

/**
 * Create a fish mesh. Uses loaded GLB if available, falls back to procedural.
 * Each call builds a fresh group — no shared state between fish instances.
 */
export function createFishMesh(species: SpeciesDefinition, speciesId?: SpeciesId): THREE.Group {
  if (speciesId === 'jellyfish') {
    return createJellyfishMesh(species)
  }
  if (speciesId && modelCache.has(speciesId)) {
    return createGLBFishMesh(modelCache.get(speciesId)!, species)
  }
  return createProceduralFishMesh(species)
}

function createGLBFishMesh(data: ModelData, species: SpeciesDefinition): THREE.Group {
  // Use SkeletonUtils.clone for rigged models — regular clone() breaks skinned meshes
  const modelClone = SkeletonUtils.clone(data.scene) as THREE.Group

  // Center the model in native (unscaled) units
  modelClone.position.set(-data.center.x, -data.center.y, -data.center.z)

  // Apply axis correction rotation
  modelClone.rotation.set(data.rotation[0], data.rotation[1], data.rotation[2])

  // Tint all meshes with the species color
  const speciesColor = new THREE.Color(species.color)
  modelClone.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh
      // Clone the material so each fish has its own color
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(m => {
          const mat = m.clone() as THREE.MeshStandardMaterial
          if (mat.color) mat.color.multiply(speciesColor)
          return mat
        })
      } else {
        mesh.material = mesh.material.clone()
        ;(mesh.material as THREE.MeshStandardMaterial).color.multiply(speciesColor)
      }
    }
  })

  // Wrapper group: Fish controls position (movement) and rotation (yaw/pitch)
  // Scale goes on the wrapper so it doesn't interfere with centering
  const group = new THREE.Group()
  group.scale.setScalar(data.scale)
  group.add(modelClone)
  group.userData.hasGLB = true

  // Discover skeleton bones for procedural animation
  const bones = discoverBones(modelClone)
  if (bones) group.userData.bones = bones

  return group
}

function createJellyfishMesh(species: SpeciesDefinition): THREE.Group {
  const group = new THREE.Group()

  // Bell — half-sphere
  const bellGeo = new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)
  const bellMat = new THREE.MeshStandardMaterial({
    color: species.color,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  })
  const bell = new THREE.Mesh(bellGeo, bellMat)
  bell.name = 'bell'
  bell.castShadow = true
  group.add(bell)

  // Tentacles — 8 thin cylinders
  const tentacleCount = 8
  const tentacleMat = new THREE.MeshStandardMaterial({
    color: species.color,
    transparent: true,
    opacity: 0.4,
  })
  for (let i = 0; i < tentacleCount; i++) {
    const angle = (i / tentacleCount) * Math.PI * 2
    const radius = 0.15
    const tentacle = new THREE.Group()
    tentacle.name = `tentacle_${i}`

    // 3 segments per tentacle for sway
    for (let s = 0; s < 3; s++) {
      const segGeo = new THREE.CylinderGeometry(0.015, 0.01, 0.2, 4)
      const seg = new THREE.Mesh(segGeo, tentacleMat)
      seg.position.y = -s * 0.18
      seg.name = `seg_${s}`
      tentacle.add(seg)
    }

    tentacle.position.set(
      Math.cos(angle) * radius,
      -0.05,
      Math.sin(angle) * radius,
    )
    group.add(tentacle)
  }

  group.userData.isJellyfish = true
  return group
}

/**
 * Create a fish mesh from Three.js primitives (original procedural approach).
 */
function createProceduralFishMesh(species: SpeciesDefinition): THREE.Group {
  const group = new THREE.Group()
  const mat = lowPolyMaterial(species.color)

  // Body — elongated icosahedron
  const bodyGeo = new THREE.IcosahedronGeometry(1, 1)
  bodyGeo.scale(species.bodyWidth, species.bodyHeight, species.bodyLength)
  jitterVertices(bodyGeo, 0.02)
  const body = new THREE.Mesh(bodyGeo, mat)
  body.castShadow = true
  body.name = 'body'
  group.add(body)

  // Tail fin — cone pointing backward
  const tailGeo = new THREE.ConeGeometry(species.bodyHeight * 0.8, species.bodyLength * 0.6, 4)
  tailGeo.rotateX(Math.PI / 2)
  const tail = new THREE.Mesh(tailGeo, mat)
  tail.position.z = species.bodyLength * 0.8
  tail.name = 'tail'
  group.add(tail)

  // Dorsal fin — small triangle on top
  const dorsalGeo = new THREE.ConeGeometry(species.bodyHeight * 0.3, species.bodyHeight * 0.5, 3)
  const dorsal = new THREE.Mesh(dorsalGeo, mat)
  dorsal.position.y = species.bodyHeight * 0.7
  dorsal.position.z = -species.bodyLength * 0.1
  dorsal.name = 'dorsal'
  group.add(dorsal)

  // Pectoral fins — two small triangles on sides
  const pectoralGeo = new THREE.ConeGeometry(species.bodyWidth * 0.4, species.bodyHeight * 0.4, 3)
  pectoralGeo.rotateZ(Math.PI / 2)

  const leftFin = new THREE.Mesh(pectoralGeo, mat)
  leftFin.position.set(-species.bodyWidth * 0.8, -species.bodyHeight * 0.1, 0)
  leftFin.name = 'leftFin'
  group.add(leftFin)

  const rightFin = new THREE.Mesh(pectoralGeo.clone(), mat)
  rightFin.position.set(species.bodyWidth * 0.8, -species.bodyHeight * 0.1, 0)
  rightFin.rotation.z = Math.PI
  rightFin.name = 'rightFin'
  group.add(rightFin)

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(species.size * 0.15, 6, 6)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff })
  const pupilGeo = new THREE.SphereGeometry(species.size * 0.08, 6, 6)
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 })

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat)
    eye.position.set(species.bodyWidth * 0.6 * side, species.bodyHeight * 0.25, -species.bodyLength * 0.5)
    group.add(eye)

    const pupil = new THREE.Mesh(pupilGeo, pupilMat)
    pupil.position.set(species.bodyWidth * 0.75 * side, species.bodyHeight * 0.25, -species.bodyLength * 0.55)
    group.add(pupil)
  }

  return group
}

/**
 * Animates the fish mesh. Call every frame.
 * For GLB models: drives skeleton bones — spine undulation + fin flapping.
 * For procedural: animates tail and body parts individually.
 */
export function animateFishMesh(group: THREE.Group, time: number, speed: number, tailFrequency: number): void {
  if (group.userData.isJellyfish) {
    // Bell pulsing
    const bell = group.getObjectByName('bell')
    if (bell) {
      bell.scale.y = 0.9 + Math.sin(time * tailFrequency * Math.PI * 2) * 0.1
    }
    // Tentacle sway
    for (const child of group.children) {
      if (child.name.startsWith('tentacle_')) {
        const idx = parseInt(child.name.split('_')[1])
        for (const seg of child.children) {
          const s = parseInt(seg.name.split('_')[1])
          seg.rotation.x = Math.sin(time * 1.5 + idx * 0.8 + s * 0.5) * 0.15 * (s + 1)
          seg.rotation.z = Math.cos(time * 1.2 + idx * 0.6 + s * 0.3) * 0.1 * (s + 1)
        }
      }
    }
    return
  }

  if (group.userData.hasGLB) {
    const inner = group.children[0]
    const bones = group.userData.bones as FishBones | undefined
    const freq = tailFrequency * Math.PI

    // --- Whole-body sway: lateral shift + roll that follows the swim stroke ---
    if (inner) {
      // Roll tilts the body into the stroke — a gentle banking motion
      inner.rotation.z = Math.sin(time * freq) * 0.06 * speed
      // Subtle pitch bob — fish undulate vertically as they push through water
      inner.rotation.x = Math.sin(time * freq * 2) * 0.015 * speed
    }

    if (bones) {
      const { spineChain, finBones, restRotations } = bones
      const n = spineChain.length

      // --- Spine undulation: realistic S-wave traveling head → tail ---
      // Real fish keep their head nearly still while the wave amplifies toward
      // the tail. We use a cubic ramp so the first ~30% of the body barely moves
      // and the tail whips hard. A secondary harmonic adds organic asymmetry.
      for (let i = 0; i < n; i++) {
        const bone = spineChain[i]
        const rest = restRotations.get(bone)!
        const t = i / Math.max(1, n - 1) // 0 = head, 1 = tail tip

        // Primary S-wave — cubic amplitude ramp for a snappy tail
        const primaryAmp = (0.01 + t * t * t * 0.55) * speed
        const primaryPhase = t * Math.PI * 1.8
        const primary = Math.sin(time * freq + primaryPhase) * primaryAmp

        // Secondary harmonic — adds organic irregularity (half the speed, offset phase)
        const secondaryAmp = t * t * 0.08 * speed
        const secondary = Math.sin(time * freq * 0.5 + t * Math.PI * 2.5) * secondaryAmp

        // Head counter-rotation: first bone slightly opposes the wave
        // so the head stays more stable while the body bends — like a real fish
        const headCompensation = i === 0 ? -Math.sin(time * freq + Math.PI * 0.3) * 0.04 * speed : 0

        bone.rotation.y = rest.y + primary + secondary + headCompensation

        // Lateral tilt along the spine — each vertebra rolls slightly into the bend,
        // giving a more 3D feel rather than a flat side-to-side wave
        const rollAmp = t * t * 0.12 * speed
        bone.rotation.z = rest.z + Math.cos(time * freq + primaryPhase) * rollAmp

        // Very subtle pitch variation along spine — prevents "flat plane" look
        const pitchAmp = t * 0.03 * speed
        bone.rotation.x = rest.x + Math.sin(time * freq * 1.3 + t * Math.PI) * pitchAmp
      }

      // --- Fin animation: sculling/rowing motion ---
      for (const bone of finBones) {
        const rest = restRotations.get(bone)!
        const name = bone.name.toLowerCase()

        if (name.includes('end')) continue

        const isRight = name.includes('wingr') || name.includes('finr') || name.includes('right')
        const side = isRight ? 1 : -1

        const isBase = name.includes('body')
        // Pectoral fins row with a figure-8 motion: flap + sweep
        const flapAmp = (isBase ? 0.25 : 0.15) * speed
        const sweepAmp = (isBase ? 0.12 : 0.06) * speed
        const phase = isBase ? 0 : 0.5

        // Main flap (Z rotation — up/down or side-to-side depending on rig)
        bone.rotation.z = rest.z + Math.sin(time * freq * 0.7 + phase) * flapAmp * side
        // Forward/back sweep adds a rowing feel (Y rotation)
        bone.rotation.y = rest.y + Math.cos(time * freq * 0.7 + phase) * sweepAmp
      }
    }
    return
  }

  const freq = tailFrequency * Math.PI * 2
  const tail = group.getObjectByName('tail')
  if (tail) {
    tail.rotation.y = Math.sin(time * freq) * 0.4 * speed
    tail.rotation.z = Math.cos(time * freq) * 0.08 * speed
  }

  const body = group.getObjectByName('body')
  if (body) {
    body.rotation.y = Math.sin(time * freq + 0.6) * 0.08 * speed
    body.rotation.z = Math.sin(time * freq) * 0.03 * speed
  }
}
