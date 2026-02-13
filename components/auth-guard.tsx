"use client"

import React, { useEffect, useState, createContext, useContext, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"

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

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loginActivo, setLoginActivo] = useState(true)

  const checkAuth = useCallback(async () => {
    // Skip auth check for login page
    if (pathname === "/login") {
      setIsChecking(false)
      return
    }

    try {
      // Check if login is enabled
      const res = await fetch("/api/auth?action=check")
      const data = await res.json()
      const isLoginActive = data.loginActivo !== false

      setLoginActivo(isLoginActive)

      if (!isLoginActive) {
        // Login disabled - auto-authenticate with generic user
        setUser({ id: "auto", nombre: "Usuario", usuario: "auto", rol: "admin" })
        setIsChecking(false)
        return
      }

      // Login is active - check session
      const stored = sessionStorage.getItem("avigest_user")
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setUser(parsed)
          setIsChecking(false)
        } catch {
          sessionStorage.removeItem("avigest_user")
          sessionStorage.removeItem("avigest_logged_in")
          router.push("/login")
        }
      } else {
        router.push("/login")
      }
    } catch {
      // If API fails, fall back to session check
      const isLoggedIn = sessionStorage.getItem("avigest_logged_in") === "true"
      if (!isLoggedIn) {
        router.push("/login")
      } else {
        setIsChecking(false)
      }
    }
  }, [pathname, router])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const logout = useCallback(() => {
    sessionStorage.removeItem("avigest_user")
    sessionStorage.removeItem("avigest_logged_in")
    setUser(null)
    router.push("/login")
  }, [router])

  const refreshAuth = useCallback(() => {
    setIsChecking(true)
    checkAuth()
  }, [checkAuth])

  if (isChecking && pathname !== "/login") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Verificando sesion...</p>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, loginActivo, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}
