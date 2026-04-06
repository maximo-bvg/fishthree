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
}

export interface EditModeCallbacks {
  onSelectItem: (decorationId: DecorationId) => void
  onDone: () => void
}

export class EditModeUI {
  private container: HTMLDivElement
  private dimOverlay: HTMLDivElement
  private itemsContainer: HTMLDivElement
  private activeCategory: DecorationCategory = 'plants'
  private selectedItem: DecorationId | null = null
  private callbacks: EditModeCallbacks

  constructor(parent: HTMLElement, callbacks: EditModeCallbacks) {
    this.callbacks = callbacks

    this.dimOverlay = document.createElement('div')
    this.dimOverlay.className = 'edit-dim-overlay'

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
    parent.appendChild(this.container)
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
      })
      this.itemsContainer.appendChild(item)
    }
  }

  getSelectedItem(): DecorationId | null {
    return this.selectedItem
  }

  destroy(): void {
    this.dimOverlay.remove()
    this.container.remove()
  }
}
