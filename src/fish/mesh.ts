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
  if (group.userData.hasGLB) {
    const inner = group.children[0]
    // Subtle whole-body roll (reduced — bones handle the main motion now)
    if (inner) {
      inner.rotation.z = Math.sin(time * tailFrequency * Math.PI) * 0.03 * speed
    }

    const bones = group.userData.bones as FishBones | undefined
    if (bones) {
      const { spineChain, finBones, restRotations } = bones
      const freq = tailFrequency * Math.PI

      // --- Spine undulation: S-wave traveling from head to tail ---
      const n = spineChain.length
      for (let i = 0; i < n; i++) {
        const bone = spineChain[i]
        const rest = restRotations.get(bone)!
        // t goes 0 (root) → 1 (tip)
        const t = i / Math.max(1, n - 1)
        // Amplitude ramps up toward the tail — exponential curve for a snappy tail
        const amp = (0.02 + t * t * 0.28) * speed
        // Phase offset creates the traveling wave
        const phase = t * Math.PI * 1.5
        bone.rotation.y = rest.y + Math.sin(time * freq + phase) * amp
      }

      // --- Fin flapping (side-aware from bone names) ---
      for (const bone of finBones) {
        const rest = restRotations.get(bone)!
        const name = bone.name.toLowerCase()

        // End bones are chain terminators — skip them
        if (name.includes('end')) continue

        // Detect side: R flaps opposite to L
        const isRight = name.includes('wingr') || name.includes('finr') || name.includes('right')
        const side = isRight ? 1 : -1

        // Base bones (attached to body) lead; outer bones follow with delay
        const isBase = name.includes('body')
        const amp = (isBase ? 0.18 : 0.10) * speed
        const phase = isBase ? 0 : 0.4

        bone.rotation.z = rest.z + Math.sin(time * freq * 0.7 + phase) * amp * side
      }
    }
    return
  }

  const tail = group.getObjectByName('tail')
  if (tail) {
    tail.rotation.y = Math.sin(time * tailFrequency * Math.PI * 2) * 0.3 * speed
  }

  const body = group.getObjectByName('body')
  if (body) {
    body.rotation.y = Math.sin(time * tailFrequency * Math.PI * 2 + 0.5) * 0.05 * speed
  }
}
