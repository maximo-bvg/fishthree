import { type SpeciesId, SPECIES } from '../fish/species'
import { type Fish } from '../fish/fish'
import { type HUD } from './hud'
import { SPECIES_ECONOMY } from '../game/economy'

export interface PanelCallbacks {
  onAddFish: (speciesId: SpeciesId, name: string) => void
  onRemoveFish: (index: number) => void
  onRenameFish: (index: number, name: string) => void
  onToggleCaustics: (on: boolean) => void
  onToggleBloom: (on: boolean) => void
  onToggleDayNight: (on: boolean) => void
  onSwayIntensity: (value: number) => void
  onScreenshot: () => void
  onMasterVolume: (value: number) => void
  onAmbientVolume: (value: number) => void
  onSfxVolume: (value: number) => void
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
        <input class="fish-item-name-input" value="${fish.name}" data-rename="${i}" style="background:transparent;border:1px solid transparent;color:inherit;font:inherit;padding:2px 4px;border-radius:3px;width:80px;cursor:pointer;" onfocus="this.style.borderColor='rgba(255,255,255,0.3)';this.style.background='rgba(255,255,255,0.1)'" onblur="this.style.borderColor='transparent';this.style.background='transparent'" />
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

  panel.querySelectorAll('[data-rename]').forEach(input => {
    input.addEventListener('change', () => {
      const idx = parseInt((input as HTMLInputElement).dataset.rename!, 10)
      const newName = (input as HTMLInputElement).value.trim()
      if (newName) callbacks.onRenameFish(idx, newName)
    })
  })
}

export function showAddFishPanel(
  hud: HUD,
  currentCount: number,
  maxCount: number,
  coins: number,
  callbacks: PanelCallbacks,
): void {
  let html = `
    <div class="panel-title">Fish Shop (${currentCount}/${maxCount})</div>
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
    pleco: 'Slow bottom-dweller',
    danio: 'Fast schooling fish',
    jellyfish: 'Drifting, translucent',
    guppy: 'Playful surface swimmer',
  }

  for (const [id, species] of Object.entries(SPECIES)) {
    const color = '#' + species.color.toString(16).padStart(6, '0')
    const price = SPECIES_ECONOMY[id as SpeciesId].cost
    const canAfford = coins >= price
    html += `
      <div class="species-card${canAfford ? '' : ' disabled'}" data-species="${id}">
        <div class="species-color" style="background:${color}"></div>
        <div class="species-info">
          <span class="species-info-name">${species.name}</span>
          <span class="species-info-desc">${descriptions[id as SpeciesId]}</span>
        </div>
        <span class="species-price${canAfford ? '' : ' insufficient'}">${price} coins</span>
      </div>
    `
  }

  hud.showPanel(html)

  const panel = hud.getPanel()
  panel.querySelectorAll('.species-card:not(.disabled)').forEach(card => {
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
  settings: { caustics: boolean; bloom: boolean; dayNightCycle: boolean; swayIntensity: number; masterVolume: number; ambientVolume: number; sfxVolume: number },
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
      <span class="setting-label">Day/Night Cycle</span>
      <button class="setting-toggle${settings.dayNightCycle ? ' on' : ''}" data-setting="dayNight"></button>
    </div>
    <div class="setting-row">
      <span class="setting-label">Camera Sway</span>
      <input type="range" class="setting-slider" min="0" max="100" value="${settings.swayIntensity * 100}" data-setting="sway" />
    </div>
    <div class="setting-row">
      <span class="setting-label">Master Volume</span>
      <input type="range" class="setting-slider" min="0" max="100" value="${settings.masterVolume * 100}" data-setting="masterVolume" />
    </div>
    <div class="setting-row">
      <span class="setting-label">Ambient Volume</span>
      <input type="range" class="setting-slider" min="0" max="100" value="${settings.ambientVolume * 100}" data-setting="ambientVolume" />
    </div>
    <div class="setting-row">
      <span class="setting-label">SFX Volume</span>
      <input type="range" class="setting-slider" min="0" max="100" value="${settings.sfxVolume * 100}" data-setting="sfxVolume" />
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
      if (setting === 'dayNight') callbacks.onToggleDayNight(isOn)
    })
  })

  const slider = panel.querySelector('[data-setting="sway"]') as HTMLInputElement
  slider?.addEventListener('input', () => {
    callbacks.onSwayIntensity(parseInt(slider.value, 10) / 100)
  })

  const masterSlider = panel.querySelector('[data-setting="masterVolume"]') as HTMLInputElement
  masterSlider?.addEventListener('input', () => {
    callbacks.onMasterVolume(parseInt(masterSlider.value, 10) / 100)
  })

  const ambientSlider = panel.querySelector('[data-setting="ambientVolume"]') as HTMLInputElement
  ambientSlider?.addEventListener('input', () => {
    callbacks.onAmbientVolume(parseInt(ambientSlider.value, 10) / 100)
  })

  const sfxSlider = panel.querySelector('[data-setting="sfxVolume"]') as HTMLInputElement
  sfxSlider?.addEventListener('input', () => {
    callbacks.onSfxVolume(parseInt(sfxSlider.value, 10) / 100)
  })
}

export function showLeaderboardPanel(
  hud: HUD,
  playerName: string | null,
  totalCoinsEarned: number,
  onSubmit: (name: string) => void,
): void {
  let html = `
    <div class="panel-title">Leaderboard</div>
    <button class="panel-close">&times;</button>
    <div id="leaderboard-list" style="font-size:13px;opacity:0.6;">Loading...</div>
    <div class="leaderboard-submit" style="margin-top:12px;border-top:1px solid rgba(100,180,255,0.2);padding-top:12px;">
      <div style="font-size:12px;opacity:0.6;margin-bottom:6px;">Your score: ${Math.floor(totalCoinsEarned)} coins</div>
      <div style="display:flex;gap:8px;">
        <input id="lb-name" class="tank-name" placeholder="Your name" value="${playerName || ''}" style="flex:1;font-size:13px;" maxlength="20" />
        <button class="edit-btn" id="lb-submit" style="padding:6px 14px;font-size:13px;">Submit</button>
      </div>
      <div id="lb-status" style="font-size:11px;margin-top:4px;opacity:0.6;"></div>
    </div>
  `

  hud.showPanel(html)

  // Fetch scores
  fetch('/api/scores')
    .then(r => r.json())
    .then((entries: { rank: number; playerName: string; totalCoinsEarned: number }[]) => {
      const listEl = document.getElementById('leaderboard-list')
      if (!listEl) return
      if (entries.length === 0) {
        listEl.innerHTML = '<p style="opacity:0.6;">No scores yet. Be the first!</p>'
        return
      }
      listEl.innerHTML = entries.map(e =>
        `<div class="lb-row${e.playerName === playerName ? ' lb-self' : ''}">
          <span class="lb-rank">#${e.rank}</span>
          <span class="lb-name">${e.playerName}</span>
          <span class="lb-score">${Math.floor(e.totalCoinsEarned)}</span>
        </div>`
      ).join('')
    })
    .catch(() => {
      const listEl = document.getElementById('leaderboard-list')
      if (listEl) listEl.innerHTML = '<p style="opacity:0.6;">Could not load leaderboard.</p>'
    })

  // Submit handler
  const panel = hud.getPanel()
  const submitBtn = panel.querySelector('#lb-submit')
  submitBtn?.addEventListener('click', () => {
    const nameInput = panel.querySelector('#lb-name') as HTMLInputElement
    const name = nameInput?.value.trim()
    if (!name) return
    onSubmit(name)

    const statusEl = panel.querySelector('#lb-status')
    if (statusEl) statusEl.textContent = 'Submitting...'

    fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: name, totalCoinsEarned }),
    })
      .then(r => {
        if (r.ok) {
          if (statusEl) statusEl.textContent = 'Score submitted!'
        } else {
          return r.json().then(d => {
            if (statusEl) statusEl.textContent = d.error || 'Failed to submit.'
          })
        }
      })
      .catch(() => {
        if (statusEl) statusEl.textContent = 'Network error. Try again.'
      })
  })
}
