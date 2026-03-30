"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  RefreshCw,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface MovimientoMP {
  id: string
  fecha: string
  tipo: "ingreso" | "egreso"
  monto: number
  descripcion?: string
  referencia?: string
  pagador_nombre?: string
  pagador_email?: string
  estado: "sin_verificar" | "verificado" | "sospechoso"
}

interface ComprobanteMP {
  id: string
  movimiento_id?: string
  monto_comprobante?: number
  fecha_comprobante?: string
  referencia_comprobante?: string
  remitente?: string
  estado: "verificado" | "sospechoso" | "sin_match"
  notas?: string
  created_at: string
}

interface VerifyResult {
  extracted: {
    monto: number | null
    fecha: string | null
    referencia: string | null
    remitente: string | null
    destino_cvu: string | null
  }
  matched?: MovimientoMP
  estado: "verificado" | "sospechoso" | "sin_match"
  notas: string
}

const ESTADO_MOVIMIENTO = {
  sin_verificar: { label: "Sin verificar", variant: "secondary" as const },
  verificado: { label: "Verificado", variant: "default" as const },
  sospechoso: { label: "Sospechoso", variant: "destructive" as const },
}

const ESTADO_COMPROBANTE = {
  verificado: {
    label: "Verificado ✓",
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
  },
  sospechoso: {
    label: "Sospechoso ⚠",
    icon: AlertTriangle,
    color: "text-yellow-600",
    bg: "bg-yellow-50 border-yellow-200",
  },
  sin_match: {
    label: "No encontrado ✗",
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
  },
}

export function MercadoPagoContent() {
  const { toast } = useToast()
  const {
    data: movimientos = [],
    isLoading: loadingMovimientos,
    mutate: mutateMovimientos,
  } = useSupabase<MovimientoMP>("movimientos_mp")
  const {
    data: comprobantes = [],
    mutate: mutateComprobantes,
  } = useSupabase<ComprobanteMP>("comprobantes_mp")

  const [syncing, setSyncing] = useState(false)
  const [daysBack, setDaysBack] = useState("30")
  const [tipoFiltro, setTipoFiltro] = useState("todos")
  const [estadoFiltro, setEstadoFiltro] = useState("todos")
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [saldo, setSaldo] = useState<number | null>(null)
  const [loadingSaldo, setLoadingSaldo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Saldo en tiempo real ────────────────────────────────────────────────────

  const fetchSaldo = useCallback(async () => {
    setLoadingSaldo(true)
    try {
      const res = await fetch("/api/mp/balance")
      const data = await res.json()
      if (res.ok) setSaldo(data.available_balance ?? null)
    } catch {
      // silencioso — no interrumpir la UI si falla
    } finally {
      setLoadingSaldo(false)
    }
  }, [])

  useEffect(() => {
    fetchSaldo()
    const interval = setInterval(fetchSaldo, 60_000) // refresca cada 1 minuto
    return () => clearInterval(interval)
  }, [fetchSaldo])

  // ── Sync ────────────────────────────────────────────────────────────────────

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/mp/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysBack: parseInt(daysBack) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await mutateMovimientos()
      await fetchSaldo()
      toast({
        title: "Sincronización exitosa",
        description: data.synced > 0
          ? `${data.synced} movimientos — ${data.ingresos ?? 0} ingresos, ${data.egresos ?? 0} egresos`
          : "No hay movimientos nuevos.",
      })
    } catch (err: any) {
      toast({ title: "Error al sincronizar", description: err.message, variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }

  // ── Verify comprobante ───────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setVerifying(true)
    setVerifyResult(null)

    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/mp/verify-comprobante", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setVerifyResult(data)
      await mutateComprobantes()
    } catch (err: any) {
      toast({ title: "Error al verificar", description: err.message, variant: "destructive" })
    } finally {
      setVerifying(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // ── Filtered movements ───────────────────────────────────────────────────────

  const filteredMovimientos = movimientos.filter((m) => {
    const matchTipo = tipoFiltro === "todos" || m.tipo === tipoFiltro
    const matchEstado = estadoFiltro === "todos" || m.estado === estadoFiltro
    return matchTipo && matchEstado
  })

  const totalIngresos = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((s, m) => s + m.monto, 0)
  const totalEgresos = movimientos
    .filter((m) => m.tipo === "egreso")
    .reduce((s, m) => s + m.monto, 0)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Saldo real en tiempo real */}
        <div className="rounded-lg border bg-card p-4 border-primary/30">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">Saldo disponible MP</p>
            <button onClick={fetchSaldo} className="ml-auto text-muted-foreground hover:text-foreground">
              <RefreshCw className={`h-3 w-3 ${loadingSaldo ? "animate-spin" : ""}`} />
            </button>
          </div>
          {saldo === null
            ? <p className="text-xl font-bold text-muted-foreground mt-1">{loadingSaldo ? "…" : "No disponible"}</p>
            : <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(saldo)}</p>
          }
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Ingresos sincronizados</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Egresos sincronizados</p>
          <p className="text-2xl font-bold text-destructive mt-1">{formatCurrency(totalEgresos)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Balance neto</p>
          <p className={`text-2xl font-bold mt-1 ${totalIngresos - totalEgresos >= 0 ? "text-green-600" : "text-destructive"}`}>
            {formatCurrency(totalIngresos - totalEgresos)}
          </p>
        </div>
      </div>

      <Tabs defaultValue="movimientos">
        <TabsList>
          <TabsTrigger value="movimientos">Movimientos ({movimientos.length})</TabsTrigger>
          <TabsTrigger value="comprobantes">Verificar Comprobantes</TabsTrigger>
          <TabsTrigger value="historial">Historial ({comprobantes.length})</TabsTrigger>
        </TabsList>

        {/* ── TAB: MOVIMIENTOS ── */}
        <TabsContent value="movimientos" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ingreso">Ingresos</SelectItem>
                  <SelectItem value="egreso">Egresos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="sin_verificar">Sin verificar</SelectItem>
                  <SelectItem value="verificado">Verificados</SelectItem>
                  <SelectItem value="sospechoso">Sospechosos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Select value={daysBack} onValueChange={setDaysBack}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 días</SelectItem>
                  <SelectItem value="30">Últimos 30 días</SelectItem>
                  <SelectItem value="60">Últimos 60 días</SelectItem>
                  <SelectItem value="90">Últimos 90 días</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sincronizar
              </Button>
            </div>
          </div>

          {loadingMovimientos ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Cargando movimientos...</span>
            </div>
          ) : filteredMovimientos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed text-muted-foreground">
              <p className="font-medium">Sin movimientos</p>
              <p className="text-sm mt-1">Sincronizá tu cuenta de MercadoPago para ver los movimientos</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-semibold">Fecha</th>
                    <th className="text-left p-3 font-semibold">Tipo</th>
                    <th className="text-left p-3 font-semibold">De / Para</th>
                    <th className="text-left p-3 font-semibold">Descripción</th>
                    <th className="text-right p-3 font-semibold">Monto</th>
                    <th className="text-left p-3 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovimientos.map((m) => (
                    <tr key={m.id} className="border-t hover:bg-muted/20">
                      <td className="p-3 whitespace-nowrap text-muted-foreground">
                        {formatDate(new Date(m.fecha))}
                      </td>
                      <td className="p-3">
                        {m.tipo === "ingreso" ? (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <ArrowDownCircle className="h-4 w-4" /> Ingreso
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-destructive font-medium">
                            <ArrowUpCircle className="h-4 w-4" /> Egreso
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div>
                          {m.pagador_nombre && (
                            <p className="font-medium">{m.pagador_nombre}</p>
                          )}
                          {m.pagador_email && (
                            <p className="text-xs text-muted-foreground">{m.pagador_email}</p>
                          )}
                          {!m.pagador_nombre && !m.pagador_email && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate">
                        {m.descripcion || "-"}
                      </td>
                      <td className={`p-3 text-right font-semibold ${m.tipo === "ingreso" ? "text-green-600" : "text-destructive"}`}>
                        {m.tipo === "ingreso" ? "+" : "-"}{formatCurrency(m.monto)}
                      </td>
                      <td className="p-3">
                        <Badge variant={ESTADO_MOVIMIENTO[m.estado]?.variant ?? "secondary"}>
                          {ESTADO_MOVIMIENTO[m.estado]?.label ?? m.estado}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── TAB: VERIFICAR COMPROBANTE ── */}
        <TabsContent value="comprobantes" className="space-y-6">
          <div>
            <h3 className="font-semibold mb-1">Verificar comprobante de pago</h3>
            <p className="text-sm text-muted-foreground">
              Subí la foto o PDF del comprobante que te mandó el cliente. Claude extrae los datos y
              los cruza con los movimientos reales de tu cuenta MP.
            </p>
          </div>

          <div
            className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/25 p-14 cursor-pointer hover:border-muted-foreground/50 transition-colors"
            onClick={() => !verifying && fileInputRef.current?.click()}
          >
            {verifying ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Analizando comprobante con IA...</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">Subir comprobante</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    JPG, PNG o PDF — foto de pantalla o archivo
                  </p>
                </div>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={verifying}
          />

          {/* Result */}
          {verifyResult && (
            <div className={`rounded-lg border-2 p-5 space-y-4 ${ESTADO_COMPROBANTE[verifyResult.estado].bg}`}>
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = ESTADO_COMPROBANTE[verifyResult.estado].icon
                  return (
                    <Icon className={`h-6 w-6 shrink-0 ${ESTADO_COMPROBANTE[verifyResult.estado].color}`} />
                  )
                })()}
                <div>
                  <p className={`font-bold text-lg ${ESTADO_COMPROBANTE[verifyResult.estado].color}`}>
                    {ESTADO_COMPROBANTE[verifyResult.estado].label}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{verifyResult.notas}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-current/10">
                <div>
                  <p className="text-xs text-muted-foreground">Monto del comprobante</p>
                  <p className="font-semibold">
                    {verifyResult.extracted.monto
                      ? formatCurrency(verifyResult.extracted.monto)
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-semibold">{verifyResult.extracted.fecha ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Remitente</p>
                  <p className="font-semibold">{verifyResult.extracted.remitente ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Referencia</p>
                  <p className="font-semibold text-xs">{verifyResult.extracted.referencia ?? "-"}</p>
                </div>
              </div>

              {verifyResult.matched && (
                <div className="pt-2 border-t border-current/10">
                  <p className="text-xs text-muted-foreground mb-1">Movimiento MP coincidente</p>
                  <p className="text-sm">
                    <span className="font-medium">{formatCurrency(verifyResult.matched.monto)}</span>
                    {" · "}
                    {formatDate(new Date(verifyResult.matched.fecha))}
                    {verifyResult.matched.pagador_nombre && ` · ${verifyResult.matched.pagador_nombre}`}
                    {" · "}
                    <span className="text-muted-foreground">ID MP: {verifyResult.matched.id}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: HISTORIAL ── */}
        <TabsContent value="historial">
          {comprobantes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed text-muted-foreground">
              <p className="font-medium">Sin historial</p>
              <p className="text-sm mt-1">Los comprobantes verificados aparecerán aquí</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-semibold">Fecha verificación</th>
                    <th className="text-left p-3 font-semibold">Remitente</th>
                    <th className="text-right p-3 font-semibold">Monto</th>
                    <th className="text-left p-3 font-semibold">Fecha comp.</th>
                    <th className="text-left p-3 font-semibold">Referencia</th>
                    <th className="text-left p-3 font-semibold">Resultado</th>
                    <th className="text-left p-3 font-semibold">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {comprobantes.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/20">
                      <td className="p-3 whitespace-nowrap text-muted-foreground">
                        {formatDate(new Date(c.created_at))}
                      </td>
                      <td className="p-3 font-medium">{c.remitente ?? "-"}</td>
                      <td className="p-3 text-right font-semibold">
                        {c.monto_comprobante ? formatCurrency(c.monto_comprobante) : "-"}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {c.fecha_comprobante ?? "-"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {c.referencia_comprobante ?? "-"}
                      </td>
                      <td className="p-3">
                        <span className={`font-medium ${ESTADO_COMPROBANTE[c.estado].color}`}>
                          {ESTADO_COMPROBANTE[c.estado].label}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[240px]">
                        {c.notas ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
