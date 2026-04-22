"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Shield, Check, X, Loader2, ChevronDown, ChevronRight, AlertTriangle, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/use-permissions"
import { cn } from "@/lib/utils"

// ─── Secciones disponibles (sincronizado con app-sidebar) ─────────────────────

const SECCIONES = [
  { id: "principal", label: "Principal", items: [
    { href: "/", name: "Dashboard" },
    { href: "/minorista", name: "Minorista" },
    { href: "/ventas", name: "Ventas" },
    { href: "/resumen-ventas", name: "Resumen de Ventas" },
    { href: "/produccion", name: "Producción" },
    { href: "/pedidos", name: "Toma de Pedidos" },
    { href: "/cobros", name: "Cobros" },
    { href: "/compras", name: "Compras" },
    { href: "/pagos", name: "Pagos" },
    { href: "/facturas", name: "Prep. Facturas" },
    { href: "/offline", name: "Modo Offline (Agroaves)" },
  ]},
  { id: "gestion", label: "Gestión", items: [
    { href: "/clientes", name: "Clientes" },
    { href: "/proveedores", name: "Proveedores" },
    { href: "/cuentas", name: "Cuentas Corrientes" },
    { href: "/ranking", name: "Ranking de Clientes" },
    { href: "/vendedores", name: "Vendedores" },
    { href: "/stock", name: "Inventario" },
    { href: "/vehiculos", name: "Vehiculos" },
    { href: "/asesor", name: "Asesor (Federico)" },
  ]},
  { id: "finanzas", label: "Finanzas", items: [
    { href: "/gastos", name: "Gastos" },
    { href: "/caja", name: "Caja" },
    { href: "/mercadopago", name: "MercadoPago" },
    { href: "/eerr", name: "EERR" },
    { href: "/presupuestos", name: "Presupuestos" },
    { href: "/flujo", name: "Flujo de Fondos" },
    { href: "/kpis", name: "KPIs Ejecutivos" },
    { href: "/reportes-ejecutivos", name: "Reportes Ejecutivos" },
  ]},
]

const ALL_HREFS = SECCIONES.flatMap((s) => s.items.map((i) => i.href)  )

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface Usuario { id: string; email: string; created_at: string; last_sign_in_at: string }
interface Permiso { user_id: string; email: string; display_name: string | null; allowed_sections: string[] | null }

// ─── Componente ────────────────────────────────────────────────────────────────

export function PermisosContent() {
  const { isOwner, isLoading: permsLoading } = usePermissions()
  const { toast } = useToast()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [permisos, setPermisos] = useState<Permiso[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Local draft state: user_id → set of allowed hrefs (null = all)
  const [drafts, setDrafts] = useState<Record<string, Set<string> | null>>({})

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [resUsers, resPerms] = await Promise.all([
        fetch("/api/admin/usuarios"),
        fetch("/api/admin/permisos"),
      ])
      if (!resUsers.ok) throw new Error("Error al cargar usuarios")
      if (!resPerms.ok) throw new Error("Error al cargar permisos")
      const users: Usuario[] = await resUsers.json()
      const perms: Permiso[] = await resPerms.json()
      setUsuarios(users)
      setPermisos(perms)

      // Initialize drafts from existing permissions
      const d: Record<string, Set<string> | null> = {}
      for (const u of users) {
        const p = perms.find((x) => x.user_id === u.id)
        d[u.id] = p ? (p.allowed_sections ? new Set(p.allowed_sections) : null) : null
      }
      setDrafts(d)
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!permsLoading && isOwner) loadData()
  }, [permsLoading, isOwner, loadData])

  const toggleHref = (userId: string, href: string) => {
    setDrafts((prev) => {
      const current = prev[userId]
      if (current === null) {
        // Full access → restrict to all except this href
        const next = new Set(ALL_HREFS)
        next.delete(href)
        return { ...prev, [userId]: next }
      }
      const next = new Set(current)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return { ...prev, [userId]: next }
    })
  }

  const setFullAccess = (userId: string) => {
    setDrafts((prev) => ({ ...prev, [userId]: null }))
  }

  const setNoAccess = (userId: string) => {
    setDrafts((prev) => ({ ...prev, [userId]: new Set() }))
  }

  const savePermisos = async (u: Usuario) => {
    setSavingId(u.id)
    try {
      const draft = drafts[u.id]
      const allowed_sections = draft === null ? null : Array.from(draft)
      const res = await fetch("/api/admin/permisos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: u.id,
          email: u.email,
          allowed_sections,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? "Error al guardar")
      }
      toast({ title: "Permisos guardados", description: `Permisos de ${u.email} actualizados.` })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setSavingId(null)
    }
  }

  if (permsLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    )
  }

  if (!isOwner) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex items-center gap-3 pt-6">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="text-sm">No tenés permisos para acceder a esta sección.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Control de Acceso por Usuario
          </CardTitle>
          <CardDescription>
            Elegí a qué secciones puede acceder cada usuario. Los usuarios sin restricciones tienen acceso total.
          </CardDescription>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : usuarios.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            No se encontraron usuarios. Verificá que SUPABASE_SERVICE_ROLE_KEY esté configurada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {usuarios.map((u) => {
            const draft = drafts[u.id]
            const isExpanded = expandedId === u.id
            const isFullAccess = draft === null
            const allowedCount = draft === null ? ALL_HREFS.length : draft.size
            const isSaving = savingId === u.id
            const lastLogin = u.last_sign_in_at
              ? new Date(u.last_sign_in_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
              : "—"

            return (
              <Card key={u.id}>
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg"
                  onClick={() => setExpandedId(isExpanded ? null : u.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    }
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.email}</p>
                      <p className="text-xs text-muted-foreground">Último acceso: {lastLogin}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {isFullAccess
                      ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-0">Acceso total</Badge>
                      : <Badge variant="secondary">{allowedCount} / {ALL_HREFS.length} secciones</Badge>
                    }
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4 border-t">
                    {/* Quick actions */}
                    <div className="flex items-center gap-2 mb-4 mt-4">
                      <Button
                        variant={isFullAccess ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => setFullAccess(u.id)}
                      >
                        <Check className="h-3 w-3" />
                        Acceso total
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => setNoAccess(u.id)}
                      >
                        <X className="h-3 w-3" />
                        Sin acceso
                      </Button>
                      <span className="text-xs text-muted-foreground ml-1">
                        {isFullAccess ? "Sin restricciones" : `${allowedCount} secciones habilitadas`}
                      </span>
                    </div>

                    {/* Section checkboxes */}
                    <div className="space-y-4">
                      {SECCIONES.map((sec) => (
                        <div key={sec.id}>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
                            {sec.label}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {sec.items.map((item) => {
                              const checked = draft === null || draft.has(item.href)
                              return (
                                <button
                                  key={item.href}
                                  onClick={() => toggleHref(u.id, item.href)}
                                  className={cn(
                                    "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left",
                                    checked
                                      ? "bg-primary/10 text-primary hover:bg-primary/15"
                                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                  )}
                                >
                                  <span className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                    checked ? "bg-primary border-primary text-primary-foreground" : "border-input"
                                  )}>
                                    {checked && <Check className="h-2.5 w-2.5" />}
                                  </span>
                                  <span className="truncate">{item.name}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Save button */}
                    <div className="flex justify-end mt-4 pt-3 border-t">
                      <Button
                        size="sm"
                        onClick={() => savePermisos(u)}
                        disabled={isSaving}
                        className="gap-2"
                      >
                        {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Guardar permisos
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
