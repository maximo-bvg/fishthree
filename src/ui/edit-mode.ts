import './edit-mode.css'
import { DECORATIONS, type DecorationId, type DecorationCategory } from '../decorations/catalog'

const CATEGORY_ICONS: Record<DecorationCategory, string> = {
  plants: '\u{1F33F}',
  rocks: '\u{1FAA8}',
  accessories: '\u{2699}',
  fun: '\u{2B50}',
}

const ITEM_ICONS: Partial<Record<DecorationId, string>> = {
  seaweed: '\u{1F33F}',
  coral_fan: '\u{1FAB8}',
  anemone: '\u{1F338}',
  boulder: '\u{1FAA8}',
  rock_arch: '\u{1F3DB}',
  driftwood: '\u{1FAB5}',
  bubbler: '\u{1FAE7}',
  tank_light: '\u{1F4A1}',
  treasure_chest: '\u{1F4E6}',
  diver: '\u{1F93F}',
  sunken_ship: '\u{26F5}',
  brain_coral: '\u{1F9E0}',
  kelp: '\u{1F33F}',
  coral_cluster: '\u{1FAB8}',
  volcano_bubbler: '\u{1F30B}',
  treasure_map: '\u{1F5FA}',
  barrel: '\u{1F6E2}',
  cannon: '\u{1F4A3}',
  bottle: '\u{1F37E}',
  pirate_flag: '\u{1F3F4}',
  rock_pile: '\u{1FAA8}',
  stone_ring: '\u{2B55}',
  rock_cave: '\u{1F573}',
  bush: '\u{1F33F}',
}

export interface EditModeCallbacks {
  onSelectItem: (decorationId: DecorationId) => void
  onDone: () => void
  onRescale?: (slotIndex: number, newScale: number) => void
}

export class EditModeUI {
  private container: HTMLDivElement
  private dimOverlay: HTMLDivElement
  private scaleHint: HTMLDivElement
  private itemsContainer: HTMLDivElement
  private activeCategory: DecorationCategory = 'plants'
  private selectedItem: DecorationId | null = null
  private callbacks: EditModeCallbacks
  private scaleHintTimer: ReturnType<typeof setTimeout> | null = null
  onAudioTrigger: ((sound: string) => void) | null = null

  constructor(parent: HTMLElement, callbacks: EditModeCallbacks) {
    this.callbacks = callbacks

    this.dimOverlay = document.createElement('div')
    this.dimOverlay.className = 'edit-dim-overlay'

    this.scaleHint = document.createElement('div')
    this.scaleHint.className = 'edit-scale-hint'

    this.container = document.createElement('div')
    this.container.className = 'edit-mode-bottom'

    const tabs = document.createElement('div')
    tabs.className = 'edit-tabs'
    const categories: DecorationCategory[] = ['plants', 'rocks', 'accessories', 'fun']
    for (const cat of categories) {
      const tab = document.createElement('button')
      tab.className = `edit-tab${cat === this.activeCategory ? ' active' : ''}`
      tab.textContent = `${CATEGORY_ICONS[cat]} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`
      tab.addEventListener('click', () => {
        this.activeCategory = cat
        tabs.querySelectorAll('.edit-tab').forEach(t => t.classList.remove('active'))
        tab.classList.add('active')
        this.renderItems()
      })
      tabs.appendChild(tab)
    }

    const doneBtn = document.createElement('button')
    doneBtn.className = 'edit-done-btn'
    doneBtn.textContent = 'Done'
    doneBtn.addEventListener('click', callbacks.onDone)

    const topRow = document.createElement('div')
    topRow.style.display = 'flex'
    topRow.style.justifyContent = 'space-between'
    topRow.style.alignItems = 'center'
    topRow.appendChild(tabs)
    topRow.appendChild(doneBtn)
    this.container.appendChild(topRow)

    this.itemsContainer = document.createElement('div')
    this.itemsContainer.className = 'edit-items'
    this.container.appendChild(this.itemsContainer)

    this.renderItems()

    parent.appendChild(this.dimOverlay)
    parent.appendChild(this.scaleHint)
    parent.appendChild(this.container)
  }

  showScaleHint(scale: number): void {
    this.scaleHint.textContent = `Scale: ${Math.round(scale * 100)}% — scroll to resize`
    this.scaleHint.classList.add('visible')
    if (this.scaleHintTimer) clearTimeout(this.scaleHintTimer)
    this.scaleHintTimer = setTimeout(() => {
      this.scaleHint.classList.remove('visible')
    }, 1500)
  }

  private renderItems(): void {
    this.itemsContainer.innerHTML = ''
    for (const [id, def] of Object.entries(DECORATIONS)) {
      if (def.category !== this.activeCategory) continue
      const item = document.createElement('div')
      item.className = `edit-item${this.selectedItem === id ? ' selected' : ''}`
      item.innerHTML = `
        <span class="edit-item-icon">${ITEM_ICONS[id as DecorationId] || '?'}</span>
        <span class="edit-item-name">${def.name}</span>
      `
      item.addEventListener('click', () => {
        this.selectedItem = id as DecorationId
        this.renderItems()
        this.callbacks.onSelectItem(id as DecorationId)
        this.onAudioTrigger?.('decor-placed')
      })
      this.itemsContainer.appendChild(item)
    }
  }

  getSelectedItem(): DecorationId | null {
    return this.selectedItem
  }

  destroy(): void {
    if (this.scaleHintTimer) clearTimeout(this.scaleHintTimer)
    this.dimOverlay.remove()
    this.scaleHint.remove()
    this.container.remove()
  }
}
