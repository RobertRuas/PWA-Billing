import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './ui/tokens.css'
import './ui/components.css'

// Block zoom gestures on iOS (§6.3)
const blockGesture = (e: Event) => e.preventDefault()
document.addEventListener('gesturestart', blockGesture, { passive: false })
document.addEventListener('gesturechange', blockGesture, { passive: false })
document.addEventListener('gestureend', blockGesture, { passive: false })
document.addEventListener(
  'touchmove',
  (e) => { if (e.touches.length > 1) e.preventDefault() },
  { passive: false },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
