import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
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

/**
 * Preload all GLB models for the given species. Call once at startup.
 * Stores model data for later cloning. Falls back to procedural geometry on failure.
 */
export async function preloadModels(species: Record<string, SpeciesDefinition>): Promise<void> {
  const promises: Promise<void>[] = []
  for (const [id, def] of Object.entries(species)) {
    if (!def.modelPath || failedModels.has(id)) continue
    promises.push(
      loader.loadAsync(def.modelPath)
        .then((gltf) => {
          const scene = gltf.scene

          // Enable shadows on all meshes
          scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true
            }
          })

          // Compute bounding box for size normalization and centering
          const box = new THREE.Box3().setFromObject(scene)
          const nativeSize = new THREE.Vector3()
          box.getSize(nativeSize)
          const center = new THREE.Vector3()
          box.getCenter(center)

          const maxDim = Math.max(nativeSize.x, nativeSize.y, nativeSize.z)
          const targetSize = Math.max(def.bodyLength * 3, def.size * 5)
          const scale = maxDim > 0 ? targetSize / maxDim : 1

          const rotation: [number, number, number] = (def.modelRotation ?? [0, 0, 0]) as [number, number, number]

          modelCache.set(id, { scene, scale, rotation, center })
          console.log(`Loaded model: ${id} (native: ${nativeSize.x.toFixed(2)}x${nativeSize.y.toFixed(2)}x${nativeSize.z.toFixed(2)}, scale: ${scale.toFixed(3)})`)
        })
        .catch(() => {
          failedModels.add(id)
          console.log(`Model not found for ${id}, using procedural mesh`)
        })
    )
  }
  await Promise.all(promises)
}

/**
 * Create a fish mesh. Uses loaded GLB if available, falls back to procedural.
 * Each call builds a fresh group — no shared state between fish instances.
 */
export function createFishMesh(species: SpeciesDefinition, speciesId?: SpeciesId): THREE.Group {
  if (speciesId && modelCache.has(speciesId)) {
    return createGLBFishMesh(modelCache.get(speciesId)!)
  }
  return createProceduralFishMesh(species)
}

function createGLBFishMesh(data: ModelData): THREE.Group {
  const modelClone = data.scene.clone(true)

  // Center the model in native (unscaled) units
  modelClone.position.set(-data.center.x, -data.center.y, -data.center.z)

  // Apply axis correction rotation
  modelClone.rotation.set(data.rotation[0], data.rotation[1], data.rotation[2])

  // Wrapper group: Fish controls position (movement) and rotation (lookAt)
  // Scale goes on the wrapper so it doesn't interfere with centering
  const group = new THREE.Group()
  group.scale.setScalar(data.scale)
  group.add(modelClone)
  group.userData.hasGLB = true
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
 * For GLB models: gentle sway on the inner model (outer group controlled by lookAt).
 * For procedural: animates tail and body parts individually.
 */
export function animateFishMesh(group: THREE.Group, time: number, speed: number, tailFrequency: number): void {
  if (group.userData.hasGLB) {
    const inner = group.children[0]
    if (inner) {
      inner.rotation.z = Math.sin(time * tailFrequency * Math.PI) * 0.08 * speed
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
