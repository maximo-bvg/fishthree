import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const loader = new GLTFLoader()

interface DecorationModel {
  scene: THREE.Group
  nativeSize: THREE.Vector3
  center: THREE.Vector3
}

const modelCache = new Map<string, DecorationModel>()

export async function preloadDecorationModels(paths: string[]): Promise<void> {
  const unique = [...new Set(paths)]
  await Promise.all(
    unique.map(path =>
      loader.loadAsync(path)
        .then(gltf => {
          const scene = gltf.scene
          scene.traverse(child => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })
          const box = new THREE.Box3().setFromObject(scene)
          const nativeSize = new THREE.Vector3()
          box.getSize(nativeSize)
          const center = new THREE.Vector3()
          box.getCenter(center)
          modelCache.set(path, { scene, nativeSize, center })
          console.log(`Loaded decoration: ${path} (${nativeSize.x.toFixed(2)}x${nativeSize.y.toFixed(2)}x${nativeSize.z.toFixed(2)})`)
        })
        .catch(() => {
          console.warn(`Decoration model not found: ${path}`)
        })
    )
  )
}

export function cloneDecorationModel(
  path: string,
  targetSize: number,
  rotation?: [number, number, number],
): THREE.Group | null {
  const data = modelCache.get(path)
  if (!data) return null

  const clone = data.scene.clone(true)
  clone.traverse(child => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh
      const fixMat = (m: THREE.Material): THREE.MeshStandardMaterial => {
        // Kenney models often use MeshBasicMaterial which ignores lighting
        // and renders full-brightness white. Convert everything to Standard.
        const color = (m as any).color ? (m as any).color.clone() : new THREE.Color(0x888888)
        const map = (m as any).map ?? null
        // Darken bright colors so they don't blow out under scene lighting + bloom
        const lum = color.r * 0.299 + color.g * 0.587 + color.b * 0.114
        if (lum > 0.4) {
          const scale = 0.4 / lum
          color.r *= scale
          color.g *= scale
          color.b *= scale
        }
        const mat = new THREE.MeshStandardMaterial({
          color,
          map,
          roughness: 0.85,
          metalness: 0.0,
          flatShading: true,
        })
        // Also handle vertex colors if the geometry uses them
        if ((m as any).vertexColors) {
          mat.vertexColors = true
        }
        return mat
      }
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(fixMat)
      } else {
        mesh.material = fixMat(mesh.material)
      }
      // Darken vertex colors if present — Kenney models store bright colors here
      const geo = mesh.geometry
      const colorAttr = geo.getAttribute('color')
      if (colorAttr) {
        const arr = colorAttr.array as Float32Array
        for (let i = 0; i < arr.length; i += colorAttr.itemSize) {
          const r = arr[i], g = arr[i + 1], b = arr[i + 2]
          const lum = r * 0.299 + g * 0.587 + b * 0.114
          if (lum > 0.4) {
            const s = 0.4 / lum
            arr[i] *= s
            arr[i + 1] *= s
            arr[i + 2] *= s
          }
        }
        colorAttr.needsUpdate = true
      }
    }
  })

  // Center the model
  clone.position.set(-data.center.x, -data.center.y, -data.center.z)

  if (rotation) {
    clone.rotation.set(rotation[0], rotation[1], rotation[2])
  }

  const maxDim = Math.max(data.nativeSize.x, data.nativeSize.y, data.nativeSize.z)
  const scale = maxDim > 0 ? targetSize / maxDim : 1

  const group = new THREE.Group()
  group.scale.setScalar(scale)
  group.add(clone)
  group.userData.hasGLB = true

  return group
}
