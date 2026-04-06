import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { type SpeciesDefinition, type SpeciesId } from './species'
import { lowPolyMaterial, jitterVertices } from '../utils/geometry'

const loader = new GLTFLoader()
const modelCache = new Map<string, THREE.Group>()
const failedModels = new Set<string>()

/**
 * Preload all GLB models for the given species. Call once at startup.
 * Models that fail to load will silently fall back to procedural geometry.
 * Each model is auto-normalized so its largest dimension matches the species target size.
 */
export async function preloadModels(species: Record<string, SpeciesDefinition>): Promise<void> {
  const promises: Promise<void>[] = []
  for (const [id, def] of Object.entries(species)) {
    if (!def.modelPath || failedModels.has(id)) continue
    promises.push(
      loader.loadAsync(def.modelPath)
        .then((gltf) => {
          const model = gltf.scene

          // Enable shadows on all meshes
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true
            }
          })

          // Auto-normalize: scale so the model's largest dimension matches the procedural fish size
          // Procedural fish bodies are ~bodyLength*2 + tail, so we target bodyLength * 3
          const box = new THREE.Box3().setFromObject(model)
          const nativeSize = new THREE.Vector3()
          box.getSize(nativeSize)
          const maxDim = Math.max(nativeSize.x, nativeSize.y, nativeSize.z)
          if (maxDim > 0) {
            const targetSize = Math.max(def.bodyLength * 3, def.size * 5)
            const normalizeScale = targetSize / maxDim
            model.scale.setScalar(normalizeScale)
          }

          // Center the model on its bounding box
          const centeredBox = new THREE.Box3().setFromObject(model)
          const center = new THREE.Vector3()
          centeredBox.getCenter(center)
          model.position.sub(center)

          // Wrap in a group so the position offset stays local
          const wrapper = new THREE.Group()
          wrapper.add(model)

          modelCache.set(id, wrapper)
          console.log(`Loaded model: ${id} (native size: ${nativeSize.x.toFixed(2)} x ${nativeSize.y.toFixed(2)} x ${nativeSize.z.toFixed(2)}, scaled to ${(def.size * 2).toFixed(2)})`)
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
 * Create a fish mesh — uses loaded GLB if available, falls back to procedural.
 */
export function createFishMesh(species: SpeciesDefinition, speciesId?: SpeciesId): THREE.Group {
  if (speciesId && modelCache.has(speciesId)) {
    const source = modelCache.get(speciesId)!
    const clone = source.clone(true) // recursive clone
    clone.userData.hasGLB = true
    return clone
  }

  return createProceduralFishMesh(species)
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
 * Animates the fish tail and body wiggle. Call every frame.
 * For GLB models, this is a gentle whole-body sway (the model handles its own shape).
 * For procedural meshes, animates tail and body parts individually.
 */
export function animateFishMesh(group: THREE.Group, time: number, speed: number, tailFrequency: number): void {
  if (group.userData.hasGLB) {
    // Gentle whole-body sway for loaded models
    group.rotation.z = Math.sin(time * tailFrequency * Math.PI) * 0.04 * speed
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
