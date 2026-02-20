"use client"

import React, { useEffect, useState, createContext, useContext, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

interface AuthContextType {
  user: User | null
  logout: () => Promise<void>
  refreshAuth: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  logout: async () => {},
  refreshAuth: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  const checkAuth = useCallback(async () => {
    // Login/auth pages never block
    if (pathname?.startsWith("/auth/")) {
      setReady(true)
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.replace("/auth/login")
        return
      }

      setUser(session.user)
      setReady(true)
    } catch {
      router.replace("/auth/login")
    }
  }, [pathname, router, supabase])

  useEffect(() => {
    checkAuth()

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !pathname?.startsWith("/auth/")) {
        router.replace("/auth/login")
      } else if (session) {
        setUser(session.user)
        setReady(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [checkAuth, pathname, router, supabase])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setReady(false)
    router.replace("/auth/login")
  }, [router, supabase])

  const refreshAuth = useCallback(() => {
    setReady(false)
    checkAuth()
  }, [checkAuth])

  // Don't block auth pages
  if (pathname?.startsWith("/auth/")) {
    return (
      <AuthContext.Provider value={{ user, logout, refreshAuth }}>
        {children}
      </AuthContext.Provider>
    )
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}
