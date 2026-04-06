import * as THREE from 'three'
import { type DecorationId } from './catalog'
import { type SlotZone } from './slots'
import { TANK } from '../scene/tank'

interface BubbleParticle {
  mesh: THREE.Mesh
  speed: number
  offset: number
}

interface LightSetup {
  spotlight: THREE.SpotLight
  pointLight: THREE.PointLight
  cone: THREE.Mesh
  lens: THREE.Mesh | null
}

export class DecorationEffects {
  private swayingMeshes: { mesh: THREE.Group; speed: number; amplitude: number }[] = []
  private bubblers: { origin: THREE.Vector3; particles: BubbleParticle[] }[] = []
  private lightSetups: Map<THREE.Group, LightSetup> = new Map()
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  register(decorationId: DecorationId, mesh: THREE.Group, zone?: SlotZone): void {
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
        this.addSpotlight(mesh, zone)
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

    const setup = this.lightSetups.get(mesh)
    if (setup) {
      this.scene.remove(setup.spotlight)
      this.scene.remove(setup.spotlight.target)
      this.scene.remove(setup.pointLight)
      this.scene.remove(setup.cone)
      setup.spotlight.dispose()
      setup.pointLight.dispose()
      setup.cone.geometry.dispose()
      ;(setup.cone.material as THREE.Material).dispose()
      this.lightSetups.delete(mesh)
    }
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

  private addSpotlight(mesh: THREE.Group, zone?: SlotZone): void {
    const position = mesh.position
    const isFloor = zone === 'floor_back' || zone === 'floor_front'
    const isWall = zone === 'wall_upper' || zone === 'wall_lower'
    // Direction: floor points up, wall points forward, ceiling points down
    const dirY = isFloor ? 1 : -1
    const dirZ = isWall ? 1 : 0

    // Rotate the decoration mesh to face the right way
    if (isFloor) {
      mesh.rotation.x = Math.PI // flip upside down so lens faces up
    }

    // Directional spotlight — no distance decay so it actually reaches surfaces
    const light = new THREE.SpotLight(0xffffaa, 150.0, 0, Math.PI / 4, 0.3)
    light.decay = 0
    light.position.copy(position)
    light.target.position.set(
      position.x,
      position.y + dirY * 4,
      position.z + dirZ * 4,
    )
    this.scene.add(light)
    this.scene.add(light.target)

    // Point light for omnidirectional fill around the light fixture
    const fill = new THREE.PointLight(0xffffaa, 60.0, 0)
    fill.decay = 2
    fill.position.copy(position)
    this.scene.add(fill)

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
    if (isWall) {
      cone.rotation.x = Math.PI / 2 // rotate cone to point forward (+Z)
      cone.position.z += coneHeight / 2 + 0.1
    } else if (isFloor) {
      cone.rotation.x = Math.PI // flip cone to point up
      cone.position.y += coneHeight / 2 + 0.1
    } else {
      cone.position.y -= coneHeight / 2 + 0.1
    }
    this.scene.add(cone)

    // Track the lens mesh for emissive modulation
    const lens = mesh.getObjectByName('tank_light_lens') as THREE.Mesh | undefined

    this.lightSetups.set(mesh, {
      spotlight: light,
      pointLight: fill,
      cone,
      lens: lens ?? null,
    })
  }

  /** Get all light setups for external modulation (e.g. day/night cycle) */
  getLightSetups(): LightSetup[] {
    return Array.from(this.lightSetups.values())
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
