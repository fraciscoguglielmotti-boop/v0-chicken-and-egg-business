"use client"

import React, { useEffect, useState, createContext, useContext, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"

interface AuthUser {
  id: string
  nombre: string
  usuario: string
  rol: string
}

interface AuthContextType {
  user: AuthUser | null
  loginActivo: boolean
  logout: () => void
  refreshAuth: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loginActivo: true,
  logout: () => {},
  refreshAuth: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

const AUTO_USER: AuthUser = { id: "auto", nombre: "Usuario", usuario: "auto", rol: "admin" }

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loginActivo, setLoginActivo] = useState(true)

  const checkAuth = useCallback(async () => {
    // Login page never blocks
    if (pathname === "/login") {
      setReady(true)
      return
    }

    try {
      const res = await fetch("/api/auth?action=check")
      if (!res.ok) throw new Error("API error")
      const data = await res.json()
      const isActive = data.loginActivo !== false

      setLoginActivo(isActive)

      if (!isActive) {
        // Login disabled - auto-authenticate
        setUser(AUTO_USER)
        setReady(true)
        return
      }

      // Login is active - check sessionStorage
      const stored = sessionStorage.getItem("avigest_user")
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser
        if (parsed && parsed.id && parsed.usuario) {
          setUser(parsed)
          setReady(true)
          return
        }
      }

      // No valid session - redirect to login
      router.replace("/login")
    } catch {
      // API failed - fall back to sessionStorage check
      const stored = sessionStorage.getItem("avigest_user")
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as AuthUser
          if (parsed && parsed.id) {
            setUser(parsed)
            setReady(true)
            return
          }
        } catch { /* invalid JSON */ }
      }

      // If session also has the old format (just logged_in flag)
      if (sessionStorage.getItem("avigest_logged_in") === "true") {
        setUser({ id: "legacy", nombre: "Admin", usuario: "admin", rol: "admin" })
        setReady(true)
        return
      }

      // Nothing works - redirect to login
      router.replace("/login")
    }
  }, [pathname, router])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const logout = useCallback(() => {
    sessionStorage.removeItem("avigest_user")
    sessionStorage.removeItem("avigest_logged_in")
    setUser(null)
    setReady(false)
    router.replace("/login")
  }, [router])

  const refreshAuth = useCallback(() => {
    setReady(false)
    checkAuth()
  }, [checkAuth])

  // Don't block login page
  if (pathname === "/login") {
    return (
      <AuthContext.Provider value={{ user, loginActivo, logout, refreshAuth }}>
        {children}
      </AuthContext.Provider>
    )
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando sesion...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, loginActivo, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}
