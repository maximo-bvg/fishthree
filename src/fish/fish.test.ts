import { describe, it, expect } from 'vitest'
import { FishStateMachine, type FishState } from './fish'

describe('FishStateMachine', () => {
  it('starts in idle state', () => {
    const sm = new FishStateMachine('wanderer')
    expect(sm.current).toBe('idle')
  })

  it('transitions from idle to wander after timer', () => {
    const sm = new FishStateMachine('wanderer')
    sm.update(2.0, { threats: [], shelters: [], school: [], mouse: null, homeDecor: null, nearestFlake: null })
    expect(sm.current).toBe('wander')
  })

  it('transitions to flee when threat is near', () => {
    const sm = new FishStateMachine('wanderer')
    sm.current = 'wander' as FishState
    sm.update(0.1, {
      threats: [{ distance: 1.5 }],
      shelters: [],
      school: [],
      mouse: null,
      homeDecor: null,
    })
    expect(sm.current).toBe('flee')
  })

  it('schooling type enters school state with neighbors', () => {
    const sm = new FishStateMachine('schooling')
    sm.current = 'idle' as FishState
    sm.update(0.1, {
      threats: [],
      shelters: [],
      school: [{ distance: 1.0 }, { distance: 2.0 }],
      mouse: null,
      homeDecor: null,
      nearestFlake: null,
    })
    expect(sm.current).toBe('school')
  })

  it('shy type enters hide when threatened', () => {
    const sm = new FishStateMachine('shy')
    sm.current = 'wander' as FishState
    sm.update(0.1, {
      threats: [{ distance: 2.0 }],
      shelters: [{ distance: 1.0 }],
      school: [],
      mouse: null,
      homeDecor: null,
    })
    expect(sm.current).toBe('hide')
  })

  it('reacts to mouse when close', () => {
    const sm = new FishStateMachine('wanderer')
    sm.current = 'wander' as FishState
    sm.update(0.1, {
      threats: [],
      shelters: [],
      school: [],
      mouse: { distance: 1.0 },
      homeDecor: null,
    })
    expect(sm.current).toBe('react')
  })
})
