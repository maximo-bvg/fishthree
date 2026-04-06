import * as THREE from 'three'
import { type DecorationId } from './catalog'
import { TANK } from '../scene/tank'

interface BubbleParticle {
  mesh: THREE.Mesh
  speed: number
  offset: number
}

export class DecorationEffects {
  private swayingMeshes: { mesh: THREE.Group; speed: number; amplitude: number }[] = []
  private bubblers: { origin: THREE.Vector3; particles: BubbleParticle[] }[] = []
  private spotlights: THREE.SpotLight[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  register(decorationId: DecorationId, mesh: THREE.Group): void {
    switch (decorationId) {
      case 'seaweed':
        this.swayingMeshes.push({ mesh, speed: 1.5, amplitude: 0.1 })
        break
      case 'coral_fan':
        this.swayingMeshes.push({ mesh, speed: 0.8, amplitude: 0.05 })
        break
      case 'anemone':
        this.swayingMeshes.push({ mesh, speed: 2.0, amplitude: 0.06 })
        break
      case 'bubbler':
        this.addBubbler(mesh.position.clone().add(new THREE.Vector3(0, 0.15, 0)))
        break
      case 'tank_light':
        this.addSpotlight(mesh.position)
        break
    }
  }

  unregister(mesh: THREE.Group): void {
    this.swayingMeshes = this.swayingMeshes.filter(s => s.mesh !== mesh)
  }

  private addBubbler(origin: THREE.Vector3): void {
    const particles: BubbleParticle[] = []
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.4,
    })
    for (let i = 0; i < 6; i++) {
      const size = 0.02 + Math.random() * 0.03
      const geo = new THREE.SphereGeometry(size, 4, 4)
      const mesh = new THREE.Mesh(geo, bubbleMat)
      mesh.position.copy(origin)
      mesh.visible = false
      this.scene.add(mesh)
      particles.push({
        mesh,
        speed: 0.5 + Math.random() * 0.5,
        offset: Math.random() * Math.PI * 2,
      })
    }
    this.bubblers.push({ origin, particles })
  }

  private addSpotlight(position: THREE.Vector3): void {
    const light = new THREE.SpotLight(0xffffaa, 0.6, 5, Math.PI / 6, 0.5)
    light.position.copy(position)
    light.target.position.set(position.x, position.y - 3, position.z)
    this.scene.add(light)
    this.scene.add(light.target)
    this.spotlights.push(light)
  }

  update(time: number): void {
    for (const { mesh, speed, amplitude } of this.swayingMeshes) {
      mesh.children.forEach((child, i) => {
        child.rotation.z = Math.sin(time * speed + i * 0.5) * amplitude * (i + 1)
      })
    }

    const waterY = TANK.height / 2
    for (const bubbler of this.bubblers) {
      for (const particle of bubbler.particles) {
        if (!particle.mesh.visible) {
          if (Math.random() < 0.02) {
            particle.mesh.visible = true
            particle.mesh.position.copy(bubbler.origin)
          }
          continue
        }
        particle.mesh.position.y += particle.speed * 0.016
        particle.mesh.position.x = bubbler.origin.x + Math.sin(time * 2 + particle.offset) * 0.05
        particle.mesh.position.z = bubbler.origin.z + Math.cos(time * 1.5 + particle.offset) * 0.03

        if (particle.mesh.position.y > waterY) {
          particle.mesh.visible = false
        }
      }
    }
  }
}
