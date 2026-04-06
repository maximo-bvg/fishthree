import { type SpeciesId, SPECIES } from '../fish/species'
import { type Fish } from '../fish/fish'
import { type HUD } from './hud'

export interface PanelCallbacks {
  onAddFish: (speciesId: SpeciesId, name: string) => void
  onRemoveFish: (index: number) => void
  onToggleCaustics: (on: boolean) => void
  onToggleBloom: (on: boolean) => void
  onSwayIntensity: (value: number) => void
  onScreenshot: () => void
}

export function showFishListPanel(hud: HUD, fishes: Fish[], callbacks: PanelCallbacks): void {
  let html = `
    <div class="panel-title">Fish in Tank</div>
    <button class="panel-close">&times;</button>
  `
  if (fishes.length === 0) {
    html += '<p style="opacity:0.6;font-size:13px;">No fish yet. Add some!</p>'
  }
  for (let i = 0; i < fishes.length; i++) {
    const fish = fishes[i]
    const color = '#' + fish.species.color.toString(16).padStart(6, '0')
    html += `
      <div class="fish-item">
        <div class="fish-item-color" style="background:${color}"></div>
        <span class="fish-item-name">${fish.name}</span>
        <span class="fish-item-species">${fish.species.name}</span>
        <button class="sidebar-btn" style="width:24px;height:24px;font-size:12px;margin-left:4px" data-remove="${i}">&times;</button>
      </div>
    `
  }

  hud.showPanel(html)

  const panel = hud.getPanel()
  panel.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).dataset.remove!, 10)
      callbacks.onRemoveFish(idx)
      showFishListPanel(hud, fishes, callbacks)
    })
  })
}

export function showAddFishPanel(hud: HUD, currentCount: number, maxCount: number, callbacks: PanelCallbacks): void {
  let html = `
    <div class="panel-title">Add Fish (${currentCount}/${maxCount})</div>
    <button class="panel-close">&times;</button>
  `

  if (currentCount >= maxCount) {
    html += '<p style="opacity:0.6;font-size:13px;">Tank is full!</p>'
    hud.showPanel(html)
    return
  }

  const descriptions: Record<SpeciesId, string> = {
    tetra: 'Tiny schooling fish',
    clownfish: 'Territorial, claims decorations',
    angelfish: 'Graceful wanderer',
    pufferfish: 'Shy, hides near rocks',
    barracuda: 'Large predator patrol',
    seahorse: 'Clings to plants',
    pleco: 'Slow bottom-dweller',
    danio: 'Fast schooling fish',
    jellyfish: 'Drifting, translucent',
    guppy: 'Playful surface swimmer',
  }

  for (const [id, species] of Object.entries(SPECIES)) {
    const color = '#' + species.color.toString(16).padStart(6, '0')
    html += `
      <div class="species-card" data-species="${id}">
        <div class="species-color" style="background:${color}"></div>
        <div class="species-info">
          <span class="species-info-name">${species.name}</span>
          <span class="species-info-desc">${descriptions[id as SpeciesId]}</span>
        </div>
      </div>
    `
  }

  hud.showPanel(html)

  const panel = hud.getPanel()
  panel.querySelectorAll('.species-card').forEach(card => {
    card.addEventListener('click', () => {
      const speciesId = (card as HTMLElement).dataset.species as SpeciesId
      const name = SPECIES[speciesId].name + ' ' + (currentCount + 1)
      callbacks.onAddFish(speciesId, name)
      hud.hidePanel()
    })
  })
}

export function showSettingsPanel(
  hud: HUD,
  settings: { caustics: boolean; bloom: boolean; swayIntensity: number },
  callbacks: PanelCallbacks,
): void {
  const html = `
    <div class="panel-title">Settings</div>
    <button class="panel-close">&times;</button>
    <div class="setting-row">
      <span class="setting-label">Caustics</span>
      <button class="setting-toggle${settings.caustics ? ' on' : ''}" data-setting="caustics"></button>
    </div>
    <div class="setting-row">
      <span class="setting-label">Bloom</span>
      <button class="setting-toggle${settings.bloom ? ' on' : ''}" data-setting="bloom"></button>
    </div>
    <div class="setting-row">
      <span class="setting-label">Camera Sway</span>
      <input type="range" class="setting-slider" min="0" max="100" value="${settings.swayIntensity * 100}" data-setting="sway" />
    </div>
  `

  hud.showPanel(html)

  const panel = hud.getPanel()
  panel.querySelectorAll('.setting-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('on')
      const setting = (btn as HTMLElement).dataset.setting
      const isOn = btn.classList.contains('on')
      if (setting === 'caustics') callbacks.onToggleCaustics(isOn)
      if (setting === 'bloom') callbacks.onToggleBloom(isOn)
    })
  })

  const slider = panel.querySelector('[data-setting="sway"]') as HTMLInputElement
  slider?.addEventListener('input', () => {
    callbacks.onSwayIntensity(parseInt(slider.value, 10) / 100)
  })
}
