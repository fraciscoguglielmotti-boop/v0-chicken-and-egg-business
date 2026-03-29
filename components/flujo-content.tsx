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
interface Gasto { fecha: string; monto: number; categoria: string }

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

    const cobrosFiltrados   = cobros.filter(c => c.fecha.startsWith(selectedMonth))
    const pagosFiltrados    = pagos.filter(p => p.fecha.startsWith(selectedMonth))
    const gastosFiltrados   = gastos.filter(g => g.fecha.startsWith(selectedMonth))

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

    const prevIngresos         = cobros.filter(c => c.fecha.startsWith(prev)).reduce((s, c) => s + Number(c.monto), 0)
    const prevPagosProveedores = pagos.filter(p => p.fecha.startsWith(prev)).reduce((s, p) => s + Number(p.monto), 0)
    const prevGastosPagados    = gastos.filter(g => g.fecha.startsWith(prev)).reduce((s, g) => s + g.monto, 0)
    const prevResultado        = prevIngresos - prevPagosProveedores - prevGastosPagados

    return {
      totalIngresos, cobrosEfectivo, cobrosTransferencia,
      pagosProveedores, gastosPagados, gastosPorCategoria, resultado,
      prevIngresos, prevPagosProveedores, prevGastosPagados, prevResultado,
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
