import { useEffect } from 'react'
import { useAuth } from './AuthContext'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  useEffect(() => {
    const theme = user?.theme || 'auto'
    if (theme === 'auto') {
      delete document.documentElement.dataset.theme
      try { localStorage.removeItem('mm-theme') } catch {}
    } else {
      document.documentElement.dataset.theme = theme
      try { localStorage.setItem('mm-theme', theme) } catch {}
    }

    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    const meta = document.querySelector('meta[name="theme-color"]:not([media])')
    if (meta) meta.setAttribute('content', themeColor)
  }, [user?.theme])

  return <>{children}</>
}
