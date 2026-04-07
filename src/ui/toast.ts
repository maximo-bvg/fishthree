import './hud.css'

let toastContainer: HTMLDivElement | null = null

function ensureContainer(): HTMLDivElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.className = 'toast-container'
    document.getElementById('hud')?.appendChild(toastContainer)
  }
  return toastContainer
}

export function showToast(message: string, duration = 3000): void {
  const container = ensureContainer()
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  container.appendChild(toast)

  // Force reflow then animate in
  toast.offsetHeight
  toast.classList.add('visible')

  setTimeout(() => {
    toast.classList.remove('visible')
    toast.addEventListener('transitionend', () => toast.remove())
  }, duration)
}
