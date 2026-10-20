import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { pb } from '../data/pb'
import { clearAllData, setMeta, getMeta } from '../data/db'
import { runSync, initSyncListeners } from '../data/sync'

interface User {
  id: string
  name: string
  email: string
  language: string
  theme: string
  verified: boolean
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, language: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refresh: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

function recordToUser(record: Record<string, unknown>): User {
  return {
    id: record.id as string,
    name: record.name as string,
    email: record.email as string,
    language: (record.language as string) || 'auto',
    theme: (record.theme as string) || 'auto',
    verified: record.verified as boolean,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      if (pb.authStore.isValid && pb.authStore.record) {
        setUser(recordToUser(pb.authStore.record as unknown as Record<string, unknown>))
        const cachedUser = JSON.stringify(recordToUser(pb.authStore.record as unknown as Record<string, unknown>))
        await setMeta('userCache', cachedUser)

        if (navigator.onLine) {
          try {
            const result = await pb.collection('mm_users').authRefresh()
            setUser(recordToUser(result.record as unknown as Record<string, unknown>))
          } catch {
            // token expired — stay with cached user for now
          }
        }

        initSyncListeners()
        runSync()
      } else {
        const cached = await getMeta('userCache')
        if (cached) {
          try {
            setUser(JSON.parse(cached) as User)
          } catch {
            // invalid cache
          }
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await pb.collection('mm_users').authWithPassword(email, password)
    const u = recordToUser(result.record as unknown as Record<string, unknown>)
    setUser(u)
    await setMeta('userCache', JSON.stringify(u))
    initSyncListeners()
    runSync()
  }, [])

  const register = useCallback(async (name: string, email: string, password: string, language: string) => {
    await pb.collection('mm_users').create({
      name,
      email,
      password,
      passwordConfirm: password,
      language,
    })
    await pb.collection('mm_users').requestVerification(email)
  }, [])

  const logout = useCallback(async () => {
    pb.authStore.clear()
    setUser(null)
    await clearAllData()
  }, [])

  const refresh = useCallback(async () => {
    if (pb.authStore.isValid) {
      try {
        const result = await pb.collection('mm_users').authRefresh()
        const u = recordToUser(result.record as unknown as Record<string, unknown>)
        setUser(u)
        await setMeta('userCache', JSON.stringify(u))
      } catch {
        // token invalid
      }
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
