"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Shield, Check, X, Loader2, ChevronDown, ChevronRight,
  AlertTriangle, Users, UserPlus, KeyRound, Activity,
  Circle, Clock, Calendar,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/use-permissions"
import { cn } from "@/lib/utils"

// ─── Secciones disponibles ────────────────────────────────────────────────────

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

const ALL_HREFS = SECCIONES.flatMap((s) => s.items.map((i) => i.href))

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Usuario {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string
}

interface Permiso {
  user_id: string
  email: string
  display_name: string | null
  allowed_sections: string[] | null
}

interface PresenciaUsuario {
  id: string
  email: string
  display_name: string | null
  last_sign_in_at: string | null
  last_seen_at: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000 // 5 min
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—"
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return "hace menos de 1 min"
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// ─── Tab: Permisos ────────────────────────────────────────────────────────────

function TabPermisos({ usuarios, toast }: { usuarios: Usuario[]; toast: any }) {
  const [permisos, setPermisos] = useState<Permiso[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Set<string> | null>>({})

  const loadPermisos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/permisos")
      if (!res.ok) throw new Error("Error al cargar permisos")
      const perms: Permiso[] = await res.json()
      setPermisos(perms)
      const d: Record<string, Set<string> | null> = {}
      for (const u of usuarios) {
        const p = perms.find((x) => x.user_id === u.id)
        d[u.id] = p ? (p.allowed_sections ? new Set(p.allowed_sections) : null) : null
      }
      setDrafts(d)
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [usuarios, toast])

  useEffect(() => { loadPermisos() }, [loadPermisos])

  const toggleHref = (userId: string, href: string) => {
    setDrafts((prev) => {
      const current = prev[userId]
      if (current === null) {
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

  const savePermisos = async (u: Usuario) => {
    setSavingId(u.id)
    try {
      const draft = drafts[u.id]
      const allowed_sections = draft === null ? null : Array.from(draft)
      const res = await fetch("/api/admin/permisos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: u.id, email: u.email, allowed_sections }),
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

  if (loading) return <div className="space-y-3">{[0,1,2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>

  return (
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
                {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
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
                <div className="flex items-center gap-2 mb-4 mt-4">
                  <Button variant={isFullAccess ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1.5" onClick={() => setDrafts((p) => ({ ...p, [u.id]: null }))}>
                    <Check className="h-3 w-3" />Acceso total
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setDrafts((p) => ({ ...p, [u.id]: new Set() }))}>
                    <X className="h-3 w-3" />Sin acceso
                  </Button>
                  <span className="text-xs text-muted-foreground ml-1">
                    {isFullAccess ? "Sin restricciones" : `${allowedCount} secciones habilitadas`}
                  </span>
                </div>
                <div className="space-y-4">
                  {SECCIONES.map((sec) => (
                    <div key={sec.id}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">{sec.label}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {sec.items.map((item) => {
                          const checked = draft === null || draft.has(item.href)
                          return (
                            <button key={item.href} onClick={() => toggleHref(u.id, item.href)}
                              className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left",
                                checked ? "bg-primary/10 text-primary hover:bg-primary/15" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                              )}>
                              <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border",
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
                <div className="flex justify-end mt-4 pt-3 border-t">
                  <Button size="sm" onClick={() => savePermisos(u)} disabled={isSaving} className="gap-2">
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
  )
}

// ─── Tab: Cuentas ─────────────────────────────────────────────────────────────

function TabCuentas({ usuarios, onUsuariosChange, toast }: {
  usuarios: Usuario[]
  onUsuariosChange: () => void
  toast: any
}) {
  const [creando, setCreando] = useState(false)
  const [cambiandoId, setCambiandoId] = useState<string | null>(null)
  const [nuevaEmail, setNuevaEmail] = useState("")
  const [nuevaPass, setNuevaPass] = useState("")
  const [nuevaNombre, setNuevaNombre] = useState("")
  const [nuevaPassConfirm, setNuevaPassConfirm] = useState("")
  const [pwdUsuarioId, setPwdUsuarioId] = useState("")
  const [pwdNueva, setPwdNueva] = useState("")
  const [pwdConfirm, setPwdConfirm] = useState("")

  const crearCuenta = async () => {
    if (!nuevaEmail || !nuevaPass) return
    if (nuevaPass !== nuevaPassConfirm) {
      toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" })
      return
    }
    setCreando(true)
    try {
      const res = await fetch("/api/admin/cuentas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nuevaEmail, password: nuevaPass, display_name: nuevaNombre || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Error")
      toast({ title: "Cuenta creada", description: `${nuevaEmail} fue creado correctamente.` })
      setNuevaEmail(""); setNuevaPass(""); setNuevaPassConfirm(""); setNuevaNombre("")
      onUsuariosChange()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setCreando(false)
    }
  }

  const cambiarPassword = async () => {
    if (!pwdUsuarioId || !pwdNueva) return
    if (pwdNueva !== pwdConfirm) {
      toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" })
      return
    }
    setCambiandoId(pwdUsuarioId)
    try {
      const res = await fetch("/api/admin/cuentas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: pwdUsuarioId, password: pwdNueva }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Error")
      toast({ title: "Contraseña actualizada", description: "La contraseña fue cambiada correctamente." })
      setPwdUsuarioId(""); setPwdNueva(""); setPwdConfirm("")
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setCambiandoId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Crear cuenta */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            Crear nueva cuenta
          </CardTitle>
          <CardDescription>El usuario podrá ingresar con email y contraseña.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nueva-email">Email</Label>
              <Input id="nueva-email" type="email" placeholder="usuario@ejemplo.com"
                value={nuevaEmail} onChange={(e) => setNuevaEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nueva-nombre">Nombre (opcional)</Label>
              <Input id="nueva-nombre" placeholder="Ej: Juan Pérez"
                value={nuevaNombre} onChange={(e) => setNuevaNombre(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nueva-pass">Contraseña</Label>
              <Input id="nueva-pass" type="password" placeholder="Mínimo 8 caracteres"
                value={nuevaPass} onChange={(e) => setNuevaPass(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nueva-pass-confirm">Repetir contraseña</Label>
              <Input id="nueva-pass-confirm" type="password" placeholder="Repetir contraseña"
                value={nuevaPassConfirm} onChange={(e) => setNuevaPassConfirm(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={crearCuenta} disabled={creando || !nuevaEmail || !nuevaPass} className="gap-2">
              {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Crear cuenta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cambiar contraseña */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Cambiar contraseña
          </CardTitle>
          <CardDescription>Elegí el usuario y establecé una nueva contraseña.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pwd-usuario">Usuario</Label>
            <select
              id="pwd-usuario"
              value={pwdUsuarioId}
              onChange={(e) => setPwdUsuarioId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Seleccioná un usuario...</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.email}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pwd-nueva">Nueva contraseña</Label>
              <Input id="pwd-nueva" type="password" placeholder="Mínimo 8 caracteres"
                value={pwdNueva} onChange={(e) => setPwdNueva(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd-confirm">Repetir contraseña</Label>
              <Input id="pwd-confirm" type="password" placeholder="Repetir contraseña"
                value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={cambiarPassword} disabled={!!cambiandoId || !pwdUsuarioId || !pwdNueva} className="gap-2">
              {cambiandoId ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Cambiar contraseña
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Tab: Actividad ───────────────────────────────────────────────────────────

function TabActividad({ toast }: { toast: any }) {
  const [usuarios, setUsuarios] = useState<PresenciaUsuario[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/presence")
      if (!res.ok) throw new Error("Error al cargar actividad")
      setUsuarios(await res.json())
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { cargar() }, [cargar])

  // Auto-refresh each 30s
  useEffect(() => {
    const interval = setInterval(cargar, 30_000)
    return () => clearInterval(interval)
  }, [cargar])

  const onlineCount = usuarios.filter((u) => isOnline(u.last_seen_at)).length

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="relative flex h-2 w-2">
              {onlineCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
              <span className={cn("relative inline-flex rounded-full h-2 w-2", onlineCount > 0 ? "bg-green-500" : "bg-slate-300")} />
            </span>
            <span className="font-medium">{onlineCount} en línea</span>
            <span className="text-muted-foreground">· {usuarios.length} usuarios en total</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={cargar} disabled={loading} className="gap-2 h-8 text-xs">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
          Actualizar
        </Button>
      </div>

      {loading && usuarios.length === 0 ? (
        <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : (
        <div className="space-y-2">
          {[...usuarios].sort((a, b) => {
            const ao = isOnline(a.last_seen_at) ? 1 : 0
            const bo = isOnline(b.last_seen_at) ? 1 : 0
            return bo - ao
          }).map((u) => {
            const online = isOnline(u.last_seen_at)
            return (
              <Card key={u.id} className={cn("transition-colors", online && "border-green-200 dark:border-green-900/50 bg-green-50/30 dark:bg-green-950/10")}>
                <div className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      {online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
                      <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", online ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600")} />
                    </span>
                    <div className="min-w-0">
                      {u.display_name && <p className="text-sm font-medium truncate">{u.display_name}</p>}
                      <p className={cn("truncate", u.display_name ? "text-xs text-muted-foreground" : "text-sm font-medium")}>{u.email}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <div className="flex items-center justify-end gap-1.5 text-xs">
                      <Circle className={cn("h-2 w-2", online ? "fill-green-500 text-green-500" : "fill-slate-300 text-slate-300 dark:fill-slate-600 dark:text-slate-600")} />
                      <span className={online ? "text-green-700 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                        {online ? "En línea" : u.last_seen_at ? formatRelative(u.last_seen_at) : "Nunca visto"}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Último login: {formatRelative(u.last_sign_in_at)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Creado: {formatDate(u.created_at)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">* "En línea" = activo en los últimos 5 minutos. Se actualiza automáticamente cada 30 segundos.</p>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function PermisosContent() {
  const { isOwner, isLoading: permsLoading } = usePermissions()
  const { toast } = useToast()
  const [tab, setTab] = useState<"permisos" | "cuentas" | "actividad">("permisos")
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)

  const cargarUsuarios = useCallback(async () => {
    setLoadingUsuarios(true)
    try {
      const res = await fetch("/api/admin/usuarios")
      if (!res.ok) throw new Error("Error al cargar usuarios")
      setUsuarios(await res.json())
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoadingUsuarios(false)
    }
  }, [toast])

  useEffect(() => {
    if (!permsLoading && isOwner) cargarUsuarios()
  }, [permsLoading, isOwner, cargarUsuarios])

  if (permsLoading) {
    return <div className="space-y-4">{[0,1,2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
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

  const TABS = [
    { id: "permisos" as const, label: "Permisos de acceso", icon: Shield },
    { id: "cuentas" as const, label: "Gestión de cuentas", icon: Users },
    { id: "actividad" as const, label: "Actividad", icon: Activity },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Tab bar */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              tab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab description */}
      {tab === "permisos" && (
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
      )}

      {/* Content */}
      {loadingUsuarios ? (
        <div className="space-y-3">{[0,1,2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : usuarios.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            No se encontraron usuarios. Verificá que SUPABASE_SERVICE_ROLE_KEY esté configurada.
          </CardContent>
        </Card>
      ) : (
        <>
          {tab === "permisos" && <TabPermisos usuarios={usuarios} toast={toast} />}
          {tab === "cuentas" && <TabCuentas usuarios={usuarios} onUsuariosChange={cargarUsuarios} toast={toast} />}
          {tab === "actividad" && <TabActividad toast={toast} />}
        </>
      )}
    </div>
  )
}
