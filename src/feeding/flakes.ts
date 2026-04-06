import * as THREE from 'three'
import { TANK } from '../scene/tank'

const MAX_FLAKES = 30
const CLUSTER_SIZE_MIN = 4
const CLUSTER_SIZE_MAX = 6
const SINK_SPEED_MIN = 0.3
const SINK_SPEED_MAX = 0.5
const WOBBLE_AMP = 0.02
const MAX_LIFE = 8
const FADE_START = 6 // start fading at 6s
const FLOOR_DISSOLVE_TIME = 3
const FLAKE_RADIUS = 0.06
const FLAKE_COLORS = [0xcc6633, 0xdd8844, 0xbb5522, 0xeea055]

interface Flake {
  id: number
  mesh: THREE.Mesh
  speed: number
  wobbleOffset: number
  life: number
  onFloor: boolean
  consumed: boolean
}

let nextId = 0

export class FlakeManager {
  private flakes: Flake[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  spawnCluster(center: THREE.Vector3): void {
    const count = CLUSTER_SIZE_MIN + Math.floor(Math.random() * (CLUSTER_SIZE_MAX - CLUSTER_SIZE_MIN + 1))
    for (let i = 0; i < count; i++) {
      if (this.flakes.length >= MAX_FLAKES) break

      const geo = new THREE.CircleGeometry(FLAKE_RADIUS, 5)
      const color = FLAKE_COLORS[Math.floor(Math.random() * FLAKE_COLORS.length)]
      const mat = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geo, mat)

      // Scatter around center
      mesh.position.set(
        center.x + (Math.random() - 0.5) * 0.5,
        TANK.height / 2 - 0.1,
        center.z + (Math.random() - 0.5) * 0.5,
      )
      // Random rotation for variety
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      )

      this.scene.add(mesh)
      this.flakes.push({
        id: nextId++,
        mesh,
        speed: SINK_SPEED_MIN + Math.random() * (SINK_SPEED_MAX - SINK_SPEED_MIN),
        wobbleOffset: Math.random() * Math.PI * 2,
        life: 0,
        onFloor: false,
        consumed: false,
      })
    }
  }

  getActiveFlakes(): { position: THREE.Vector3; id: number }[] {
    return this.flakes
      .filter(f => !f.consumed)
      .map(f => ({ position: f.mesh.position, id: f.id }))
  }

  consume(id: number): boolean {
    const flake = this.flakes.find(f => f.id === id)
    if (!flake || flake.consumed) return false
    flake.consumed = true
    this.scene.remove(flake.mesh)
    flake.mesh.geometry.dispose()
    ;(flake.mesh.material as THREE.MeshStandardMaterial).dispose()
    return true
  }

  update(dt: number): void {
    const floorY = -TANK.height / 2

    for (let i = this.flakes.length - 1; i >= 0; i--) {
      const f = this.flakes[i]
      if (f.consumed) {
        this.flakes.splice(i, 1)
        continue
      }

      f.life += dt

      if (!f.onFloor) {
        // Sink
        f.mesh.position.y -= f.speed * dt
        // Wobble
        f.mesh.position.x += Math.sin(f.life * 2 + f.wobbleOffset) * WOBBLE_AMP * dt
        f.mesh.position.z += Math.cos(f.life * 1.5 + f.wobbleOffset) * WOBBLE_AMP * dt

        // Hit floor
        if (f.mesh.position.y <= floorY) {
          f.mesh.position.y = floorY + 0.02
          f.onFloor = true
          f.life = MAX_LIFE - FLOOR_DISSOLVE_TIME // start dissolving immediately
        }
      }

      // Fade out
      const mat = f.mesh.material as THREE.MeshStandardMaterial
      if (f.life > FADE_START) {
        const fadeProgress = (f.life - FADE_START) / (MAX_LIFE - FADE_START)
        mat.opacity = Math.max(0, 1 - fadeProgress)
      }

      // Remove expired
      if (f.life >= MAX_LIFE) {
        this.scene.remove(f.mesh)
        f.mesh.geometry.dispose()
        mat.dispose()
        this.flakes.splice(i, 1)
      }
    }
  }
}
