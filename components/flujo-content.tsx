"use client"

import { useMemo, useState } from "react"
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatCurrency } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Cobro { fecha: string; monto: number; metodo_pago: string }
interface Pago { fecha: string; monto: number }
interface Gasto { id: string; fecha: string; monto: number; categoria: string; descripcion?: string; medio_pago?: string; tarjeta?: string; fecha_pago?: string; pagado?: boolean }
interface MovimientoMP { fecha: string; tipo: string; monto: number; descripcion?: string }
interface GastoProyectado {
  id: string
  nombre: string
  categoria?: string
  monto: number
  periodicidad: "mensual" | "unico"
  mes?: string
  activo: boolean
}

// ── Helpers proyección ────────────────────────────────────────────────────────
function getProximosMeses(n: number): { label: string; value: string }[] {
  const result = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    result.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value })
  }
  return result
}

function gastosRealesMes(gastos: Gasto[], movimientosMp: MovimientoMP[], mes: string): number {
  const realGastos = gastos
    .filter(g => {
      const m = g.medio_pago === "Tarjeta Credito" && g.fecha_pago ? g.fecha_pago.slice(0, 7) : g.fecha.slice(0, 7)
      return m === mes
    })
    .reduce((s, g) => s + g.monto, 0)
  const realMP = movimientosMp
    .filter(m => m.tipo?.toLowerCase() === "egreso" && !(m.descripcion?.toLowerCase() ?? "").startsWith("transferencia") && m.fecha.slice(0, 7) === mes)
    .reduce((s, m) => s + m.monto, 0)
  return realGastos + realMP
}

function itemsProyectadosMes(proyectados: GastoProyectado[], mes: string): GastoProyectado[] {
  return proyectados.filter(g => {
    if (!g.activo) return false
    return g.periodicidad === "mensual" || (g.periodicidad === "unico" && g.mes === mes)
  })
}

function CashRow({ label, value, sub = false, sign = "", onClick, expandable, expanded }: {
  label: string; value: number; sub?: boolean; sign?: string
  onClick?: () => void; expandable?: boolean; expanded?: boolean
}) {
  const inner = (
    <div className={`flex items-center justify-between py-2.5 border-b border-border/40 ${sub ? "pl-5" : ""} ${onClick ? "hover:bg-muted/30 rounded transition-colors" : ""}`}>
      <span className={`text-sm flex items-center gap-1 ${sub ? "text-xs text-muted-foreground" : "text-muted-foreground"}`}>
        {expandable && (expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)}
        {label}
      </span>
      <span className={`text-sm font-medium tabular-nums ${sign === "-" ? "text-red-500" : sign === "+" ? "text-green-600" : ""}`}>
        {sign === "-" ? "−" : ""}{formatCurrency(value)}
      </span>
    </div>
  )
  return onClick ? <button className="w-full text-left" onClick={onClick}>{inner}</button> : inner
}

function CashTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className={`flex items-center justify-between py-3 px-4 rounded-lg my-2 ${value >= 0 ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
      <span className="font-semibold text-sm">{label}</span>
      <span className={`font-bold text-base tabular-nums ${value >= 0 ? "text-green-600" : "text-red-600"}`}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}

function Delta({ actual, prev }: { actual: number; prev: number }) {
  if (prev === 0) return <span className="text-xs text-muted-foreground">—</span>
  const pct = ((actual - prev) / Math.abs(prev)) * 100
  const up = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-green-600" : "text-red-600"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{pct.toFixed(1)}%
    </span>
  )
}

function prevMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

export function FlujoContent() {
  const { data: cobros = [] } = useSupabase<Cobro>("cobros")
  const { data: pagos = [] } = useSupabase<Pago>("pagos")
  const { data: gastos = [], mutate: mutateGastos } = useSupabase<Gasto>("gastos")
  const { data: movimientosMp = [] } = useSupabase<MovimientoMP>("movimientos_mp")
  const { data: proyectados = [], mutate: mutateProyectados } = useSupabase<GastoProyectado>("gastos_proyectados")
  const { data: categorias = [] } = useSupabase<{ id: string; nombre: string }>("categorias_gastos")
  const { toast } = useToast()

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [gastosExpanded, setGastosExpanded] = useState(false)

  // ── Estado proyección ────────────────────────────────────────────────────
  const meses = useMemo(() => getProximosMeses(6), [])
  const mesActual = meses[0].value
  const [expandedMes, setExpandedMes] = useState<string | null>(mesActual)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre: "", categoria: "", monto: "",
    periodicidad: "mensual" as "mensual" | "unico",
    mes: mesActual, activo: true,
  })
  const resetForm = () => setForm({ nombre: "", categoria: "", monto: "", periodicidad: "mensual", mes: mesActual, activo: true })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      nombre: form.nombre.trim(),
      categoria: form.categoria || null,
      monto: parseFloat(form.monto),
      periodicidad: form.periodicidad,
      mes: form.periodicidad === "unico" ? form.mes : null,
      activo: form.activo,
    }
    try {
      if (editingId) {
        await updateRow("gastos_proyectados", editingId, data)
        toast({ title: "Gasto actualizado" })
      } else {
        await insertRow("gastos_proyectados", data)
        toast({ title: "Gasto fijo agregado" })
      }
      await mutateProyectados()
      setDialogOpen(false); setEditingId(null); resetForm()
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    }
  }

  const handleEdit = (g: GastoProyectado) => {
    setForm({ nombre: g.nombre, categoria: g.categoria || "", monto: g.monto.toString(), periodicidad: g.periodicidad, mes: g.mes || mesActual, activo: g.activo })
    setEditingId(g.id); setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este gasto fijo?")) return
    try { await deleteRow("gastos_proyectados", id); await mutateProyectados() }
    catch (err: any) { toast({ title: "Error", description: err?.message, variant: "destructive" }) }
  }

  const handleToggle = async (g: GastoProyectado) => {
    try { await updateRow("gastos_proyectados", g.id, { activo: !g.activo }); await mutateProyectados() }
    catch (err: any) { toast({ title: "Error", description: err?.message, variant: "destructive" }) }
  }

  const categoriaNombres = categorias.map(c => c.nombre)

  // Pagos pendientes (gastos con pagado=false), ordenados por fecha ascendente (más urgentes primero)
  const gastosPendientes = useMemo(() =>
    gastos.filter(g => g.pagado === false).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [gastos]
  )

  const handleMarcarPagado = async (g: Gasto) => {
    try {
      await updateRow("gastos", g.id, { pagado: true })
      await mutateGastos()
      toast({ title: "Pago registrado", description: `${g.categoria} — ${formatCurrency(g.monto)}` })
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    }
  }

  const flujo = useMemo(() => {
    const prev = prevMonth(selectedMonth)

    // Para tarjeta con fecha_pago, usamos la fecha de pago (cuándo sale la plata)
    const fechaEfectiva = (g: Gasto) =>
      g.medio_pago === "Tarjeta Credito" && g.fecha_pago ? g.fecha_pago : g.fecha

    const cobrosFiltrados   = cobros.filter(c => c.fecha.startsWith(selectedMonth))
    const pagosFiltrados    = pagos.filter(p => p.fecha.startsWith(selectedMonth))
    const gastosFiltrados   = gastos.filter(g => g.pagado !== false && fechaEfectiva(g).startsWith(selectedMonth))

    const totalIngresos      = cobrosFiltrados.reduce((s, c) => s + Number(c.monto), 0)
    const cobrosEfectivo     = cobrosFiltrados.filter(c => c.metodo_pago === "efectivo").reduce((s, c) => s + Number(c.monto), 0)
    const cobrosTransferencia = totalIngresos - cobrosEfectivo
    const pagosProveedores   = pagosFiltrados.reduce((s, p) => s + Number(p.monto), 0)
    const gastosPagados      = gastosFiltrados.reduce((s, g) => s + g.monto, 0)
    const resultado          = totalIngresos - pagosProveedores - gastosPagados

    const gastosPorCategoria = gastosFiltrados.reduce((acc, g) => {
      const cat = g.categoria || "Sin categoría"
      acc[cat] = (acc[cat] || 0) + g.monto
      return acc
    }, {} as Record<string, number>)

    // Vencimientos de tarjeta: gastos con fecha_pago agrupados por fecha
    const hoy = new Date().toISOString().slice(0, 10)
    const vencimientosTarjeta = gastos
      .filter(g => g.fecha_pago && g.medio_pago === "Tarjeta Credito")
      .reduce((acc, g) => {
        const key = g.fecha_pago!
        if (!acc[key]) acc[key] = { fecha: key, total: 0, tarjetas: new Map<string, number>() }
        acc[key].total += g.monto
        const t = g.tarjeta || "Sin tarjeta"
        acc[key].tarjetas.set(t, (acc[key].tarjetas.get(t) || 0) + g.monto)
        return acc
      }, {} as Record<string, { fecha: string; total: number; tarjetas: Map<string, number> }>)
    const vencimientosOrdenados = Object.values(vencimientosTarjeta)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    const proximos = vencimientosOrdenados.filter(v => v.fecha >= hoy)
    const vencidos = vencimientosOrdenados.filter(v => v.fecha < hoy)

    const prevIngresos         = cobros.filter(c => c.fecha.startsWith(prev)).reduce((s, c) => s + Number(c.monto), 0)
    const prevPagosProveedores = pagos.filter(p => p.fecha.startsWith(prev)).reduce((s, p) => s + Number(p.monto), 0)
    const prevGastosPagados    = gastos.filter(g => fechaEfectiva(g).startsWith(prev)).reduce((s, g) => s + g.monto, 0)
    const prevResultado        = prevIngresos - prevPagosProveedores - prevGastosPagados

    return {
      totalIngresos, cobrosEfectivo, cobrosTransferencia,
      pagosProveedores, gastosPagados, gastosPorCategoria, resultado,
      prevIngresos, prevPagosProveedores, prevGastosPagados, prevResultado,
      proximos, vencidos,
    }
  }, [cobros, pagos, gastos, selectedMonth])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="proyeccion">
        <TabsList>
          <TabsTrigger value="proyeccion">Proyección</TabsTrigger>
          <TabsTrigger value="cashflow">Cashflow real</TabsTrigger>
          <TabsTrigger value="fijos">Gastos Fijos</TabsTrigger>
        </TabsList>

        {/* ── Tab: Proyección ─────────────────────────────────────────── */}
        <TabsContent value="proyeccion" className="space-y-3 mt-4">
          <p className="text-sm text-muted-foreground">
            Próximos 6 meses. Los gastos fijos mensuales se proyectan automáticamente.
          </p>
          {meses.map(({ label, value: mes }, idx) => {
            const isActual = idx === 0
            const real = isActual ? gastosRealesMes(gastos, movimientosMp, mes) : 0
            const items = itemsProyectadosMes(proyectados, mes)
            const totalProy = items.reduce((s, g) => s + g.monto, 0)
            const totalMes = isActual ? real + totalProy : totalProy
            const isOpen = expandedMes === mes
            return (
              <div key={mes} className="rounded-lg border overflow-hidden">
                <button
                  className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => setExpandedMes(isOpen ? null : mes)}
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <span className="font-semibold">{label}</span>
                    {isActual && <Badge variant="secondary" className="text-xs">Mes actual</Badge>}
                    <span className="text-sm text-muted-foreground">{items.length} fijo{items.length !== 1 ? "s" : ""}</span>
                  </div>
                  <span className="font-bold text-destructive tabular-nums">{formatCurrency(totalMes)}</span>
                </button>
                {isOpen && (
                  <div className="border-t bg-muted/10">
                    {isActual && real > 0 && (
                      <div className="px-4 py-3 border-b flex justify-between items-center">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gastos reales hasta hoy</p>
                        <p className="text-sm font-semibold text-destructive">{formatCurrency(real)}</p>
                      </div>
                    )}
                    {items.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/20">
                            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Concepto</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Categoría</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Tipo</th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(g => (
                            <tr key={g.id} className="border-b last:border-0">
                              <td className="px-4 py-2.5 font-medium">{g.nombre}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">{g.categoria || "—"}</td>
                              <td className="px-4 py-2.5">
                                <Badge variant={g.periodicidad === "mensual" ? "secondary" : "outline"} className="text-xs">
                                  {g.periodicidad === "mensual" ? "Mensual" : "Único"}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-destructive tabular-nums">{formatCurrency(g.monto)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          {isActual ? (
                            <>
                              <tr className="bg-muted/20 border-t">
                                <td colSpan={3} className="px-4 py-2 text-xs text-muted-foreground">Total fijos</td>
                                <td className="px-4 py-2 text-right font-semibold text-destructive tabular-nums">{formatCurrency(totalProy)}</td>
                              </tr>
                              <tr className="bg-muted/40 border-t">
                                <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Total del mes (real + fijos)</td>
                                <td className="px-4 py-2 text-right font-bold text-destructive tabular-nums">{formatCurrency(totalMes)}</td>
                              </tr>
                            </>
                          ) : (
                            <tr className="bg-muted/30 border-t">
                              <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Total proyectado</td>
                              <td className="px-4 py-2 text-right font-bold text-destructive tabular-nums">{formatCurrency(totalProy)}</td>
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    ) : (
                      <p className="px-4 py-4 text-sm text-muted-foreground italic">Sin gastos fijos proyectados para este mes.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </TabsContent>

        {/* ── Tab: Cashflow real ──────────────────────────────────────── */}
        <TabsContent value="cashflow">
        <div className="space-y-6 max-w-2xl mt-4">
          <div>
            <Label>Período</Label>
            <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-auto mt-1" />
          </div>

      <Card className="p-6">
        <h3 className="font-semibold text-base mb-1">Cashflow — Resultado por lo Percibido</h3>
        <p className="text-xs text-muted-foreground mb-5">Sobre lo que efectivamente se cobró y pagó</p>

        <div className="space-y-0">
          <CashRow label="(+) Cobros recibidos" value={flujo.totalIngresos} sign="+" />
          <CashRow label="Efectivo" value={flujo.cobrosEfectivo} sub />
          <CashRow label="Transferencias" value={flujo.cobrosTransferencia} sub />

          <CashRow label="(−) Pagos a proveedores" value={flujo.pagosProveedores} sign="-" />

          <CashRow
            label="(−) Gastos"
            value={flujo.gastosPagados}
            sign="-"
            expandable
            expanded={gastosExpanded}
            onClick={() => setGastosExpanded(v => !v)}
          />
          {gastosExpanded && (
            <div className="pl-4 ml-2 border-l-2 border-border/30 mb-1">
              {Object.entries(flujo.gastosPorCategoria)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, total]) => (
                  <div key={cat} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-muted-foreground">{cat}</span>
                    <span className="tabular-nums text-muted-foreground">{formatCurrency(total)}</span>
                  </div>
                ))}
              {Object.keys(flujo.gastosPorCategoria).length === 0 && (
                <p className="py-2 text-xs text-muted-foreground italic">Sin gastos en este período</p>
              )}
            </div>
          )}

          <CashTotal label="= Resultado de Caja" value={flujo.resultado} />
        </div>
      </Card>

      {/* Pagos a Realizar */}
      {gastosPendientes.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-base">Pagos a Realizar</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {gastosPendientes.length} pendiente{gastosPendientes.length !== 1 ? "s" : ""} · Total: <span className="font-semibold text-destructive">{formatCurrency(gastosPendientes.reduce((s, g) => s + g.monto, 0))}</span>
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {gastosPendientes.map(g => {
              const hoy = new Date().toISOString().slice(0, 10)
              const vencido = g.fecha < hoy
              const dias = Math.ceil((new Date(g.fecha).getTime() - new Date(hoy).getTime()) / (1000 * 60 * 60 * 24))
              return (
                <div key={g.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${vencido ? "border-red-400/40 bg-red-500/5" : dias <= 7 ? "border-amber-400/40 bg-amber-500/5" : "border-border bg-muted/10"}`}>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{g.categoria}</span>
                      {g.descripcion && <span className="text-xs text-muted-foreground truncate">{g.descripcion}</span>}
                    </div>
                    <span className={`text-xs font-medium ${vencido ? "text-red-600" : dias <= 7 ? "text-amber-600" : "text-muted-foreground"}`}>
                      {vencido ? `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""}` : dias === 0 ? "Hoy" : `En ${dias} día${dias !== 1 ? "s" : ""}`} · {new Date(g.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                    </span>
                    {g.medio_pago && <span className="text-xs text-muted-foreground">{g.medio_pago}</span>}
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <span className="font-bold text-destructive tabular-nums">{formatCurrency(g.monto)}</span>
                    <Button size="sm" variant="outline" className="text-green-700 border-green-400 hover:bg-green-50 h-8 text-xs" onClick={() => handleMarcarPagado(g)}>
                      ✓ Pagar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Vencimientos de tarjetas */}
      {(flujo.proximos.length > 0 || flujo.vencidos.length > 0) && (
        <Card className="p-6">
          <h3 className="font-semibold text-base mb-4">Vencimientos de tarjetas</h3>
          <div className="space-y-3">
            {flujo.vencidos.map(v => (
              <div key={v.fecha} className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-red-600 uppercase tracking-wide">Vencido</span>
                    <p className="font-semibold">{new Date(v.fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Array.from(v.tarjetas.entries()).map(([t, monto]) => (
                        <span key={t} className="text-xs text-muted-foreground">{t}: {formatCurrency(monto)}</span>
                      ))}
                    </div>
                  </div>
                  <span className="font-bold text-red-600 text-lg tabular-nums">{formatCurrency(v.total)}</span>
                </div>
              </div>
            ))}
            {flujo.proximos.map(v => {
              const dias = Math.ceil((new Date(v.fecha).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              const urgente = dias <= 7
              return (
                <div key={v.fecha} className={`rounded-lg border px-4 py-3 ${urgente ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-muted/20"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-xs font-medium uppercase tracking-wide ${urgente ? "text-amber-600" : "text-muted-foreground"}`}>
                        {dias === 0 ? "Hoy" : `En ${dias} día${dias !== 1 ? "s" : ""}`}
                      </span>
                      <p className="font-semibold">{new Date(v.fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {Array.from(v.tarjetas.entries()).map(([t, monto]) => (
                          <span key={t} className="text-xs text-muted-foreground">{t}: {formatCurrency(monto)}</span>
                        ))}
                      </div>
                    </div>
                    <span className={`font-bold text-lg tabular-nums ${urgente ? "text-amber-600" : ""}`}>{formatCurrency(v.total)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Comparativa mes anterior */}
      <Card className="p-6">
        <h3 className="font-semibold text-base mb-4">Comparativa vs mes anterior</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-normal text-muted-foreground">Concepto</th>
                <th className="text-right py-2 font-normal text-muted-foreground">Mes actual</th>
                <th className="text-right py-2 font-normal text-muted-foreground">Mes anterior</th>
                <th className="text-right py-2 font-normal text-muted-foreground">Variación</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Cobros",             actual: flujo.totalIngresos,      prev: flujo.prevIngresos },
                { label: "Pagos proveedores",  actual: flujo.pagosProveedores,   prev: flujo.prevPagosProveedores },
                { label: "Gastos",             actual: flujo.gastosPagados,      prev: flujo.prevGastosPagados },
              ].map(row => (
                <tr key={row.label} className="border-b">
                  <td className="py-2.5 text-muted-foreground">{row.label}</td>
                  <td className="py-2.5 text-right font-medium tabular-nums">{formatCurrency(row.actual)}</td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatCurrency(row.prev)}</td>
                  <td className="py-2.5 text-right"><Delta actual={row.actual} prev={row.prev} /></td>
                </tr>
              ))}
              <tr className="border-t-2 font-semibold">
                <td className="py-2.5">Resultado</td>
                <td className={`py-2.5 text-right tabular-nums ${flujo.resultado >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(flujo.resultado)}</td>
                <td className={`py-2.5 text-right tabular-nums ${flujo.prevResultado >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(flujo.prevResultado)}</td>
                <td className="py-2.5 text-right"><Delta actual={flujo.resultado} prev={flujo.prevResultado} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
        </div>
        </TabsContent>

        {/* ── Tab: Gastos Fijos ──────────────────────────────────────── */}
        <TabsContent value="fijos" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {proyectados.filter(g => g.activo).length} activos · {proyectados.filter(g => !g.activo).length} inactivos ·{" "}
              <span className="font-medium text-destructive">
                {formatCurrency(proyectados.filter(g => g.activo && g.periodicidad === "mensual").reduce((s, g) => s + g.monto, 0))} / mes
              </span>
            </p>
            <Button onClick={() => { resetForm(); setEditingId(null); setDialogOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo gasto fijo
            </Button>
          </div>

          {proyectados.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="text-muted-foreground text-sm">Agregá alquileres, sueldos, servicios y otros gastos recurrentes.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Concepto</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Categoría</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mes</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Monto</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Activo</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {[...proyectados]
                    .sort((a, b) => (a.activo === b.activo ? a.nombre.localeCompare(b.nombre) : a.activo ? -1 : 1))
                    .map(g => (
                      <tr key={g.id} className={`border-b last:border-0 transition-opacity ${!g.activo ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3 font-medium">{g.nombre}</td>
                        <td className="px-4 py-3 text-muted-foreground">{g.categoria || "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={g.periodicidad === "mensual" ? "secondary" : "outline"} className="text-xs">
                            {g.periodicidad === "mensual" ? "Mensual" : "Único"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{g.periodicidad === "unico" && g.mes ? g.mes : "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-destructive tabular-nums">{formatCurrency(g.monto)}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleToggle(g)} className="text-muted-foreground hover:text-foreground transition-colors">
                            {g.activo ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(g)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(g.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog alta/edición gastos fijos */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setEditingId(null); resetForm() } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar gasto fijo" : "Nuevo gasto fijo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Concepto</Label>
              <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Alquiler depósito" required autoFocus />
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin categoría</SelectItem>
                  {categoriaNombres.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monto</Label>
              <Input type="number" step="0.01" min="0" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} required />
            </div>
            <div>
              <Label>Periodicidad</Label>
              <div className="flex gap-2 mt-1">
                {(["mensual", "unico"] as const).map(p => (
                  <button key={p} type="button"
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${form.periodicidad === p ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
                    onClick={() => setForm({ ...form, periodicidad: p })}
                  >
                    {p === "mensual" ? "Mensual (fijo)" : "Único"}
                  </button>
                ))}
              </div>
            </div>
            {form.periodicidad === "unico" && (
              <div>
                <Label>Mes</Label>
                <Input type="month" value={form.mes} onChange={e => setForm({ ...form, mes: e.target.value })} required />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? "Guardar cambios" : "Agregar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
