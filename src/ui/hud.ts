import './hud.css'

export interface HUDCallbacks {
  onEditTank: () => void
  onFishList: () => void
  onAddFish: () => void
  onScreenshot: () => void
  onOrbitToggle: () => void
  onResetCamera: () => void
  onSettings: () => void
  onLeaderboard: () => void
  onTankNameChange: (name: string) => void
}

export class HUD {
  private container: HTMLDivElement
  private tankNameInput: HTMLInputElement
  private timeIconEl: HTMLSpanElement
  private fishCountEl: HTMLSpanElement
  private decorCountEl: HTMLSpanElement
  private coinCountEl: HTMLSpanElement
  private bottomBar: HTMLDivElement
  private decorThumbnails: HTMLDivElement
  private editBtn: HTMLButtonElement
  private panelOverlay: HTMLDivElement
  onAudioTrigger: ((sound: string) => void) | null = null

  constructor(parent: HTMLElement, callbacks: HUDCallbacks) {
    this.container = document.createElement('div')
    this.container.id = 'hud'

    const top = document.createElement('div')
    top.className = 'hud-top'

    this.tankNameInput = document.createElement('input')
    this.tankNameInput.className = 'tank-name'
    this.tankNameInput.value = 'My Reef Tank'
    this.tankNameInput.addEventListener('change', () => callbacks.onTankNameChange(this.tankNameInput.value))
    top.appendChild(this.tankNameInput)

    this.timeIconEl = document.createElement('span')
    this.timeIconEl.className = 'time-icon'
    this.timeIconEl.textContent = '\u2600\uFE0F' // sun
    this.timeIconEl.title = 'Noon'
    top.appendChild(this.timeIconEl)

    const stats = document.createElement('div')
    stats.className = 'hud-stats'
    this.fishCountEl = document.createElement('span')
    this.fishCountEl.textContent = '0/12 Fish'
    this.decorCountEl = document.createElement('span')
    this.decorCountEl.textContent = '0/20 Decor'
    stats.appendChild(this.fishCountEl)
    stats.appendChild(this.decorCountEl)
    this.coinCountEl = document.createElement('span')
    this.coinCountEl.className = 'coin-count'
    this.coinCountEl.textContent = '0 Coins'
    stats.appendChild(this.coinCountEl)
    top.appendChild(stats)

    this.container.appendChild(top)

    const sidebar = document.createElement('div')
    sidebar.className = 'hud-sidebar'

    const buttons: { icon: string; action: () => void; title: string }[] = [
      { icon: '\u{1F41F}', action: callbacks.onFishList, title: 'Fish List' },
      { icon: '\u{2795}',  action: callbacks.onAddFish,  title: 'Add Fish' },
      { icon: '\u{1F4F7}', action: callbacks.onScreenshot, title: 'Screenshot' },
      { icon: '\u{1F504}', action: callbacks.onOrbitToggle, title: 'Orbit Camera (O)' },
      { icon: '\u{1F3E0}', action: callbacks.onResetCamera, title: 'Reset Camera (1)' },
      { icon: '\u{2699}',  action: callbacks.onSettings, title: 'Settings' },
      { icon: '\u{1F3C6}', action: callbacks.onLeaderboard, title: 'Leaderboard' },
    ]

    for (const btn of buttons) {
      const el = document.createElement('button')
      el.className = 'sidebar-btn'
      el.textContent = btn.icon
      el.title = btn.title
      el.addEventListener('click', btn.action)
      el.addEventListener('click', () => this.onAudioTrigger?.('button-click'))
      sidebar.appendChild(el)
    }

    this.container.appendChild(sidebar)

    this.bottomBar = document.createElement('div')
    this.bottomBar.className = 'hud-bottom'

    this.decorThumbnails = document.createElement('div')
    this.decorThumbnails.className = 'decor-thumbnails'
    this.bottomBar.appendChild(this.decorThumbnails)

    this.editBtn = document.createElement('button')
    this.editBtn.className = 'edit-btn'
    this.editBtn.textContent = 'Edit Tank'
    this.editBtn.addEventListener('click', callbacks.onEditTank)
    this.bottomBar.appendChild(this.editBtn)

    this.container.appendChild(this.bottomBar)

    this.panelOverlay = document.createElement('div')
    this.panelOverlay.className = 'panel-overlay'
    this.container.appendChild(this.panelOverlay)

    parent.appendChild(this.container)
  }

  setTankName(name: string): void {
    this.tankNameInput.value = name
  }

  updateTimeIcon(timeOfDay: string): void {
    const icons: Record<string, { icon: string; label: string }> = {
      midnight: { icon: '\uD83C\uDF19', label: 'Midnight' },
      dawn: { icon: '\uD83C\uDF05', label: 'Dawn' },
      noon: { icon: '\u2600\uFE0F', label: 'Noon' },
      dusk: { icon: '\uD83C\uDF07', label: 'Dusk' },
      night: { icon: '\uD83C\uDF19', label: 'Night' },
    }
    const info = icons[timeOfDay] || icons.noon
    this.timeIconEl.textContent = info.icon
    this.timeIconEl.title = info.label
  }

  updateCounts(fishCount: number, maxFish: number, decorCount: number, maxDecor: number): void {
    this.fishCountEl.textContent = `${fishCount}/${maxFish} Fish`
    this.decorCountEl.textContent = `${decorCount}/${maxDecor} Decor`
  }

  updateCoins(coins: number): void {
    this.coinCountEl.textContent = `${Math.floor(coins)} Coins`
  }

  showCoinAnimation(amount: number): void {
    const el = document.createElement('span')
    el.className = 'coin-anim'
    el.textContent = amount > 0 ? `+${amount}` : `${amount}`
    el.style.color = amount > 0 ? '#44dd66' : '#ff6644'
    this.coinCountEl.parentElement!.appendChild(el)
    el.addEventListener('animationend', () => el.remove())
  }

  getBottomBar(): HTMLDivElement {
    return this.bottomBar
  }

  getPanel(): HTMLDivElement {
    return this.panelOverlay
  }

  showPanel(html: string): void {
    this.onAudioTrigger?.('panel-open')
    this.panelOverlay.innerHTML = html
    this.panelOverlay.classList.add('open')

    const closeBtn = this.panelOverlay.querySelector('.panel-close')
    closeBtn?.addEventListener('click', () => this.hidePanel())
  }

  hidePanel(): void {
    this.onAudioTrigger?.('panel-close')
    this.panelOverlay.classList.remove('open')
  }

  updateDecorationThumbnails(decorations: { id: string; icon: string }[]): void {
    this.decorThumbnails.innerHTML = ''
    for (const d of decorations) {
      const thumb = document.createElement('div')
      thumb.className = 'decor-thumb'
      thumb.textContent = d.icon
      thumb.title = d.id
      this.decorThumbnails.appendChild(thumb)
    }
  }
}
