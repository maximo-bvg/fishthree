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
  private lightCones: THREE.Mesh[] = []
  private lightLenses: THREE.Mesh[] = []
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
        this.addSpotlight(mesh)
        break
      case 'brain_coral':
        this.swayingMeshes.push({ mesh, speed: 0.3, amplitude: 0.02 })
        break
      case 'kelp':
        this.swayingMeshes.push({ mesh, speed: 1.5, amplitude: 0.15 })
        break
      case 'volcano_bubbler':
        this.addBubbler(mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)))
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

  private addSpotlight(mesh: THREE.Group): void {
    const position = mesh.position

    // Strong spotlight that's visible at night
    const light = new THREE.SpotLight(0xffffaa, 3.0, 6, Math.PI / 5, 0.4)
    light.position.copy(position)
    light.target.position.set(position.x, position.y - 4, position.z)
    this.scene.add(light)
    this.scene.add(light.target)
    this.spotlights.push(light)

    // Visible volumetric light cone
    const coneHeight = 3.0
    const coneRadius = coneHeight * Math.tan(Math.PI / 5)
    const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 16, 1, true)
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const cone = new THREE.Mesh(coneGeo, coneMat)
    cone.position.copy(position)
    cone.position.y -= coneHeight / 2 + 0.1
    this.scene.add(cone)
    this.lightCones.push(cone)

    // Track the lens mesh for emissive modulation
    const lens = mesh.getObjectByName('tank_light_lens') as THREE.Mesh | undefined
    if (lens) {
      this.lightLenses.push(lens)
    }
  }

  /** Get spotlights for external modulation (e.g. day/night cycle) */
  getSpotlights(): THREE.SpotLight[] {
    return this.spotlights
  }

  /** Get light cones for external modulation */
  getLightCones(): THREE.Mesh[] {
    return this.lightCones
  }

  /** Get light lenses for external modulation */
  getLightLenses(): THREE.Mesh[] {
    return this.lightLenses
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
