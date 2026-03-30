"use client"

import { useMemo, useState } from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react"

interface Cobro { fecha: string; monto: number; metodo_pago: string }
interface Pago { fecha: string; monto: number }
interface Gasto { fecha: string; monto: number; categoria: string; medio_pago?: string; tarjeta?: string; fecha_pago?: string }

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
  const { data: gastos = [] } = useSupabase<Gasto>("gastos")

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [gastosExpanded, setGastosExpanded] = useState(false)

  const flujo = useMemo(() => {
    const prev = prevMonth(selectedMonth)

    // Para tarjeta con fecha_pago, usamos la fecha de pago (cuándo sale la plata)
    const fechaEfectiva = (g: Gasto) =>
      g.medio_pago === "Tarjeta Credito" && g.fecha_pago ? g.fecha_pago : g.fecha

    const cobrosFiltrados   = cobros.filter(c => c.fecha.startsWith(selectedMonth))
    const pagosFiltrados    = pagos.filter(p => p.fecha.startsWith(selectedMonth))
    const gastosFiltrados   = gastos.filter(g => fechaEfectiva(g).startsWith(selectedMonth))

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
    <div className="space-y-6 max-w-2xl">
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
  )
}
