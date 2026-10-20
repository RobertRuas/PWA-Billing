import { createContext, useContext, useCallback, useState, useRef, useEffect, type ReactNode } from 'react'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

function toUrl(path: string) {
  return BASE + path
}

interface Route {
  path: string
  params?: Record<string, string>
}

interface NavContextType {
  stack: Route[]
  push: (path: string, params?: Record<string, string>) => void
  pop: () => void
  replace: (path: string, params?: Record<string, string>) => void
  reset: (path: string) => void
}

const NavContext = createContext<NavContextType>({
  stack: [{ path: '/' }],
  push: () => {},
  pop: () => {},
  replace: () => {},
  reset: () => {},
})

export function useNav() {
  return useContext(NavContext)
}

interface StackNavProps {
  children: ReactNode
}

export function StackNavigator({ children }: StackNavProps) {
  const [stack, setStack] = useState<Route[]>([{ path: '/' }])
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchCurrentX = useRef(0)
  const swiping = useRef(false)

  useEffect(() => {
    function onPopState() {
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const push = useCallback((path: string, params?: Record<string, string>) => {
    setStack((s) => [...s, { path, params }])
    history.pushState(null, '', toUrl(path))
  }, [])

  const pop = useCallback(() => {
    setStack((s) => {
      if (s.length <= 1) return s
      history.back()
      return s.slice(0, -1)
    })
  }, [])

  const replace = useCallback((path: string, params?: Record<string, string>) => {
    setStack((s) => {
      const next = [...s]
      next[next.length - 1] = { path, params }
      history.replaceState(null, '', toUrl(path))
      return next
    })
  }, [])

  const reset = useCallback((path: string) => {
    setStack([{ path }])
    history.replaceState(null, '', toUrl(path))
  }, [])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (stack.length <= 1) return
    const touch = e.touches[0]!
    if (touch.clientX > 20) return
    touchStartX.current = touch.clientX
    touchCurrentX.current = 0
    swiping.current = true
  }, [stack.length])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return
    const dx = e.touches[0]!.clientX - touchStartX.current
    if (dx < 0) return
    touchCurrentX.current = dx
    if (containerRef.current) {
      const current = containerRef.current.lastElementChild as HTMLElement | null
      const prev = containerRef.current.children[containerRef.current.children.length - 2] as HTMLElement | undefined
      if (current) current.style.transform = `translateX(${dx}px)`
      if (prev) prev.style.transform = `translateX(${-100 + (dx / window.innerWidth) * 100}px)`
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!swiping.current) return
    swiping.current = false
    if (touchCurrentX.current > window.innerWidth * 0.35) {
      pop()
    }
    if (containerRef.current) {
      for (const child of containerRef.current.children) {
        (child as HTMLElement).style.transform = ''
      }
    }
  }, [pop])

  return (
    <NavContext.Provider value={{ stack, push, pop, replace, reset }}>
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        {children}
      </div>
    </NavContext.Provider>
  )
}

export function useRoute(): Route {
  const { stack } = useNav()
  return stack[stack.length - 1]!
}
