import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BASE_POSITION, LOOK_AT, updateParallax } from './camera'

export type CameraMode = 'default' | 'follow' | 'orbit' | 'preset'

interface CameraPreset {
  position: THREE.Vector3
  lookAt: THREE.Vector3
}

export const PRESETS: Record<string, CameraPreset> = {
  front:    { position: new THREE.Vector3(0, 0.5, 14),   lookAt: new THREE.Vector3(0, 0, 0) },
  topDown:  { position: new THREE.Vector3(0, 14, 0.1),   lookAt: new THREE.Vector3(0, 0, 0) },
  leftSide: { position: new THREE.Vector3(-14, 0.5, 0),  lookAt: new THREE.Vector3(0, 0, 0) },
  rightSide:{ position: new THREE.Vector3(14, 0.5, 0),   lookAt: new THREE.Vector3(0, 0, 0) },
}

const TRANSITION_SPEED = 0.05
const FOLLOW_DISTANCE = 3.0
const FOLLOW_HEIGHT = 0.5
const SNAP_THRESHOLD = 0.01

export class CameraController {
  mode: CameraMode = 'default'
  private camera: THREE.PerspectiveCamera
  private orbitControls: OrbitControls
  private followTarget: THREE.Object3D | null = null
  private transitioning = false
  private targetPosition = new THREE.Vector3()
  private targetLookAt = new THREE.Vector3()
  private currentLookAt = new THREE.Vector3()
  private onModeChange: ((mode: CameraMode) => void) | null = null

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera
    this.currentLookAt.copy(LOOK_AT)

    this.orbitControls = new OrbitControls(camera, domElement)
    this.orbitControls.target.copy(LOOK_AT)
    this.orbitControls.minDistance = 8
    this.orbitControls.maxDistance = 25
    this.orbitControls.minPolarAngle = 0.2
    this.orbitControls.maxPolarAngle = Math.PI / 2
    this.orbitControls.enableDamping = true
    this.orbitControls.dampingFactor = 0.05
    this.orbitControls.enabled = false

    this.setupKeyboard()
  }

  setModeChangeCallback(cb: (mode: CameraMode) => void): void {
    this.onModeChange = cb
  }

  private setMode(mode: CameraMode): void {
    this.mode = mode
    this.onModeChange?.(mode)
  }

  toDefault(): void {
    this.orbitControls.enabled = false
    this.followTarget = null
    this.startTransition(BASE_POSITION, LOOK_AT)
    this.setMode('default')
  }

  toFollow(target: THREE.Object3D): void {
    this.orbitControls.enabled = false
    this.followTarget = target
    this.transitioning = false
    this.setMode('follow')
  }

  toOrbit(): void {
    if (this.mode === 'orbit') {
      this.toDefault()
      return
    }
    this.followTarget = null
    this.orbitControls.target.copy(LOOK_AT)
    this.orbitControls.enabled = true
    this.transitioning = false
    this.setMode('orbit')
  }

  toPreset(name: string): void {
    const preset = PRESETS[name]
    if (!preset) return
    this.orbitControls.enabled = false
    this.followTarget = null
    this.startTransition(preset.position, preset.lookAt)
    this.setMode('preset')
  }

  /** Called when the followed fish is removed from the scene */
  onFollowTargetRemoved(): void {
    if (this.mode === 'follow') {
      this.toDefault()
    }
  }

  private startTransition(position: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.targetPosition.copy(position)
    this.targetLookAt.copy(lookAt)
    this.transitioning = true
  }

  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      // Don't capture keys when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case '1': this.toDefault(); break
        case '2': this.toPreset('topDown'); break
        case '3': this.toPreset('leftSide'); break
        case '4': this.toPreset('rightSide'); break
        case 'o': case 'O': this.toOrbit(); break
        case 'Escape': this.toDefault(); break
      }
    })
  }

  update(dt: number): void {
    if (this.transitioning) {
      this.camera.position.lerp(this.targetPosition, TRANSITION_SPEED)
      this.currentLookAt.lerp(this.targetLookAt, TRANSITION_SPEED)
      this.camera.lookAt(this.currentLookAt)

      if (
        this.camera.position.distanceTo(this.targetPosition) < SNAP_THRESHOLD &&
        this.currentLookAt.distanceTo(this.targetLookAt) < SNAP_THRESHOLD
      ) {
        this.camera.position.copy(this.targetPosition)
        this.currentLookAt.copy(this.targetLookAt)
        this.camera.lookAt(this.currentLookAt)
        this.transitioning = false
      }
      return
    }

    switch (this.mode) {
      case 'default':
        updateParallax(this.camera)
        break

      case 'follow':
        if (this.followTarget) {
          const fishPos = this.followTarget.position
          const fishDir = new THREE.Vector3(0, 0, -1)
          this.followTarget.getWorldDirection(fishDir)

          const desiredPos = fishPos.clone()
            .sub(fishDir.multiplyScalar(FOLLOW_DISTANCE))
            .add(new THREE.Vector3(0, FOLLOW_HEIGHT, 0))

          this.camera.position.lerp(desiredPos, TRANSITION_SPEED)
          this.currentLookAt.lerp(fishPos, TRANSITION_SPEED)
          this.camera.lookAt(this.currentLookAt)
        }
        break

      case 'orbit':
        this.orbitControls.update()
        break

      case 'preset':
        // Static — camera is already at the preset position after transition
        break
    }
  }

  dispose(): void {
    this.orbitControls.dispose()
  }
}
