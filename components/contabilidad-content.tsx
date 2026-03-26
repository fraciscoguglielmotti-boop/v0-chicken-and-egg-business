"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const CATEGORIAS_SUELDOS = ["Comisiones", "Sueldos", "Sueldo"]

interface Venta { fecha: string; cantidad: number; precio_unitario: number }
interface Compra { fecha: string; total: number; cantidad: number; precio_unitario: number }
interface Gasto { fecha: string; monto: number; categoria: string }

function EERRRow({ label, value, indent = false }: { label: string; value: number; indent?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-border/40 ${indent ? "pl-5" : ""}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{formatCurrency(value)}</span>
    </div>
  )
}

function EERRTotal({ label, value, pct }: { label: string; value: number; pct?: number }) {
  return (
    <div className={`flex items-center justify-between py-3 px-4 rounded-lg my-2 ${value >= 0 ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
      <span className="font-semibold text-sm">
        {label}
        {pct !== undefined && <span className="ml-2 text-xs font-normal opacity-60">({pct.toFixed(1)}%)</span>}
      </span>
      <span className={`font-bold text-base tabular-nums ${value >= 0 ? "text-green-600" : "text-red-600"}`}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export function ContabilidadContent() {
  const { data: ventas = [] } = useSupabase<Venta>("ventas")
  const { data: compras = [] } = useSupabase<Compra>("compras")
  const { data: gastos = [] } = useSupabase<Gasto>("gastos")

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [gastosExpanded, setGastosExpanded] = useState(false)

  const eerr = useMemo(() => {
    const ventasFiltradas = ventas.filter(v => v.fecha.startsWith(selectedMonth))
    const comprasFiltradas = compras.filter(c => c.fecha.startsWith(selectedMonth))
    const gastosFiltrados = gastos.filter(g => g.fecha.startsWith(selectedMonth))

    const totalVentas = ventasFiltradas.reduce((s, v) => s + v.cantidad * v.precio_unitario, 0)

    const totalCMV = comprasFiltradas.reduce((s, c) => {
      const total = c.total > 0 ? c.total : c.cantidad * c.precio_unitario
      return s + total
    }, 0)

    const margenBruto = totalVentas - totalCMV
    const margenPct = totalVentas > 0 ? (margenBruto / totalVentas) * 100 : 0

    const gastosOp = gastosFiltrados.filter(g => !CATEGORIAS_SUELDOS.includes(g.categoria))
    const gastosSueldos = gastosFiltrados.filter(g => CATEGORIAS_SUELDOS.includes(g.categoria))

    const totalGastosOp = gastosOp.reduce((s, g) => s + g.monto, 0)
    const totalSueldos = gastosSueldos.reduce((s, g) => s + g.monto, 0)

    const desglose: Record<string, number> = {}
    gastosOp.forEach(g => {
      const cat = g.categoria || "Sin categoría"
      desglose[cat] = (desglose[cat] || 0) + g.monto
    })

    const resultadoOp = margenBruto - totalGastosOp
    const resultadoOpPct = totalVentas > 0 ? (resultadoOp / totalVentas) * 100 : 0
    const resultadoBruto = resultadoOp - totalSueldos
    const resultadoBrutoPct = totalVentas > 0 ? (resultadoBruto / totalVentas) * 100 : 0

    return { totalVentas, totalCMV, margenBruto, margenPct, totalGastosOp, desglose, totalSueldos, resultadoOp, resultadoOpPct, resultadoBruto, resultadoBrutoPct }
  }, [ventas, compras, gastos, selectedMonth])

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Label>Período</Label>
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-auto mt-1"
        />
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-base mb-5">Estado de Resultados</h3>

        <div className="space-y-0">
          <EERRRow label="(+) Ventas" value={eerr.totalVentas} />
          <EERRRow label="(−) Costo de mercadería vendida" value={eerr.totalCMV} />
          <EERRTotal label="= Margen Bruto" value={eerr.margenBruto} pct={eerr.margenPct} />

          {/* Gastos operativos expandibles */}
          <button
            onClick={() => setGastosExpanded(!gastosExpanded)}
            className="flex items-center justify-between w-full py-2.5 border-b border-border/40 text-left hover:bg-muted/30 rounded transition-colors"
          >
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              {gastosExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              (−) Gastos Operativos
            </span>
            <span className="text-sm font-medium tabular-nums">{formatCurrency(eerr.totalGastosOp)}</span>
          </button>

          {gastosExpanded && (
            <div className="pl-4 ml-2 border-l-2 border-border/30 mb-1">
              {Object.entries(eerr.desglose).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
                <div key={cat} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-muted-foreground">{cat}</span>
                  <span className="tabular-nums text-muted-foreground">{formatCurrency(total)}</span>
                </div>
              ))}
              {Object.keys(eerr.desglose).length === 0 && (
                <p className="py-2 text-xs text-muted-foreground italic">Sin gastos en este período</p>
              )}
            </div>
          )}

          <EERRTotal label="= Resultado Operativo" value={eerr.resultadoOp} pct={eerr.resultadoOpPct} />

          <EERRRow label="(−) Sueldos y Comisiones" value={eerr.totalSueldos} />
          <EERRTotal label="= Resultado del Período" value={eerr.resultadoBruto} pct={eerr.resultadoBrutoPct} />
        </div>
      </Card>
    </div>
  )
}
