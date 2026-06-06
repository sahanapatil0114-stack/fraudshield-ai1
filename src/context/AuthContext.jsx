import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { authAPI, saveToken, clearToken } from '../api/backend'

const AuthContext = createContext(null)
const SESSION_KEY = 'fraudshield_user'

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authAPI.me()
      .then((res) => {
        const u = res.data.data
        setUser(u)
        localStorage.setItem(SESSION_KEY, JSON.stringify(u))
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          clearToken()
          localStorage.removeItem(SESSION_KEY)
          setUser(null)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password })
    const u = res.data.data
    if (u.token) saveToken(u.token)
    const { token, ...userData } = u
    setUser(userData)
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData))
    return userData
  }, [])

  const register = useCallback(async (name, email, password, phone) => {
    const res = await authAPI.register({ name, email, password, phone })
    return res.data
  }, [])

  const logout = useCallback(async () => {
    await authAPI.logout().catch(() => {})
    clearToken()
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout, register, setUser }),
    [user, loading, login, logout, register]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
