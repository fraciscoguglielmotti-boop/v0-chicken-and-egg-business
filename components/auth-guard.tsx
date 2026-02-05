"use client"

import React from "react"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === "/login") {
      setIsChecking(false)
      return
    }

    // Check if user is logged in
    const isLoggedIn = sessionStorage.getItem("avigest_logged_in") === "true"
    
    if (!isLoggedIn) {
      router.push("/login")
    } else {
      setIsChecking(false)
    }
  }, [pathname, router])

  if (isChecking && pathname !== "/login") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Verificando sesión...</p>
      </div>
    )
  }

  return <>{children}</>
}
