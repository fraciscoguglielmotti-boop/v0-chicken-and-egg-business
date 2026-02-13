"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Egg, Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [usuario, setUsuario] = useState("")
  const [contrasena, setContrasena] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [checkingLogin, setCheckingLogin] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        // If already logged in, go to dashboard
        const stored = sessionStorage.getItem("avigest_user")
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed?.id && parsed?.usuario) {
            router.replace("/")
            return
          }
        }

        // Check if login is disabled
        const res = await fetch("/api/auth?action=check")
        if (res.ok) {
          const data = await res.json()
          if (data.loginActivo === false) {
            sessionStorage.setItem("avigest_logged_in", "true")
            sessionStorage.setItem("avigest_user", JSON.stringify({
              id: "auto", nombre: "Usuario", usuario: "auto", rol: "admin"
            }))
            router.replace("/")
            return
          }
        }
      } catch {
        // API not available yet, show login form
      }
      if (!cancelled) setCheckingLogin(false)
    }
    check()
    return () => { cancelled = true }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: usuario.trim(), contrasena }),
      })

      const data = await res.json()

      if (data.success && data.user) {
        sessionStorage.setItem("avigest_logged_in", "true")
        sessionStorage.setItem("avigest_user", JSON.stringify(data.user))
        router.replace("/")
      } else {
        setError(data.error || "Usuario o contrasena incorrectos")
      }
    } catch {
      setError("Error de conexion. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  if (checkingLogin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
            <Egg className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AviGest</h1>
          <p className="text-sm text-muted-foreground">Ingresa tus credenciales para continuar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="usuario">Usuario</Label>
            <Input
              id="usuario"
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ingresa tu usuario"
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrasena">Contrasena</Label>
            <Input
              id="contrasena"
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="Ingresa tu contrasena"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              "Ingresar"
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Por defecto: admin / admin
        </p>
      </div>
    </div>
  )
}
