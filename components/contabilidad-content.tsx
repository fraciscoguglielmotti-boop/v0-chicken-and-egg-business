"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const CATEGORIAS_SUELDOS = ["Comisiones", "Sueldos", "Sueldo", "Comisión"]
const CATEGORIAS_RETIROS = ["Gastos Personales Francisco", "Retiro de socio", "Retiros"]

interface Venta { fecha: string; cantidad: number; precio_unitario: number }
interface Compra { fecha: string; total: number; cantidad: number; precio_unitario: number }
interface Gasto { fecha: string; monto: number; categoria: string; medio_pago?: string; fecha_pago?: string }

// Para tarjeta de crédito con fecha_pago, el gasto impacta en el mes del pago (no del consumo)
function mesContable(g: Gasto): string {
  if (g.medio_pago === "Tarjeta Credito" && g.fecha_pago) return g.fecha_pago.slice(0, 7)
  return g.fecha.slice(0, 7)
}

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

function calcEERR(ventas: Venta[], compras: Compra[], gastos: Gasto[], month: string) {
  const ventasFiltradas  = ventas.filter(v => v.fecha.startsWith(month))
  const comprasFiltradas = compras.filter(c => c.fecha.startsWith(month))
  const gastosFiltrados  = gastos.filter(g => mesContable(g) === month)

  const totalVentas = ventasFiltradas.reduce((s, v) => s + v.cantidad * v.precio_unitario, 0)
  const totalCMV    = comprasFiltradas.reduce((s, c) => s + (c.total > 0 ? c.total : c.cantidad * c.precio_unitario), 0)
  const margenBruto = totalVentas - totalCMV
  const margenPct   = totalVentas > 0 ? (margenBruto / totalVentas) * 100 : 0

  const esSueldo  = (g: Gasto) => CATEGORIAS_SUELDOS.some(cat => g.categoria?.toLowerCase() === cat.toLowerCase())
  const esRetiro  = (g: Gasto) => CATEGORIAS_RETIROS.some(cat => g.categoria?.toLowerCase() === cat.toLowerCase())
  const gastosOp      = gastosFiltrados.filter(g => !esSueldo(g) && !esRetiro(g))
  const gastosSueldos = gastosFiltrados.filter(esSueldo)
  const gastosRetiros = gastosFiltrados.filter(esRetiro)

  const totalGastosOp = gastosOp.reduce((s, g) => s + g.monto, 0)
  const totalSueldos  = gastosSueldos.reduce((s, g) => s + g.monto, 0)
  const totalRetiros  = gastosRetiros.reduce((s, g) => s + g.monto, 0)

  const desglose: Record<string, number> = {}
  gastosOp.forEach(g => {
    const cat = g.categoria || "Sin categoría"
    desglose[cat] = (desglose[cat] || 0) + g.monto
  })

  const resultadoOp      = margenBruto - totalGastosOp
  const resultadoOpPct   = totalVentas > 0 ? (resultadoOp / totalVentas) * 100 : 0
  const resultadoFinal   = resultadoOp - totalSueldos - totalRetiros
  const resultadoFinalPct = totalVentas > 0 ? (resultadoFinal / totalVentas) * 100 : 0

  return { totalVentas, totalCMV, margenBruto, margenPct, totalGastosOp, desglose, totalSueldos, totalRetiros, resultadoOp, resultadoOpPct, resultadoFinal, resultadoFinalPct }
}

function prevMonthStr(month: string) {
  const [y, m] = month.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

export function ContabilidadContent() {
  const { data: ventas = [] }  = useSupabase<Venta>("ventas")
  const { data: compras = [] } = useSupabase<Compra>("compras")
  const { data: gastos = [] }  = useSupabase<Gasto>("gastos")

  // Abrir en el mes anterior: el mes en curso está incompleto, no tiene sentido
  // analizarlo hasta que termine
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [gastosExpanded, setGastosExpanded] = useState(false)

  const { eerr, prev } = useMemo(() => ({
    eerr: calcEERR(ventas, compras, gastos, selectedMonth),
    prev: calcEERR(ventas, compras, gastos, prevMonthStr(selectedMonth)),
  }), [ventas, compras, gastos, selectedMonth])

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Label>Período</Label>
        <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-auto mt-1" />
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-base mb-5">Estado de Resultados</h3>

        <div className="space-y-0">
          <EERRRow label="(+) Ventas" value={eerr.totalVentas} />
          <EERRRow label="(−) Costo de mercadería vendida" value={eerr.totalCMV} />
          <EERRTotal label="= Margen Bruto" value={eerr.margenBruto} pct={eerr.margenPct} />

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
                <p className="py-2 text-xs text-muted-foreground italic">Sin gastos operativos en este período</p>
              )}
            </div>
          )}

          <EERRTotal label="= Resultado Operativo" value={eerr.resultadoOp} pct={eerr.resultadoOpPct} />
          <EERRRow label="(−) Sueldos y Comisiones" value={eerr.totalSueldos} />
          {eerr.totalRetiros > 0 && <EERRRow label="(−) Retiros personales" value={eerr.totalRetiros} />}
          <EERRTotal label="= Resultado del Período" value={eerr.resultadoFinal} pct={eerr.resultadoFinalPct} />
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
                { label: "Ventas",              actual: eerr.totalVentas,     prev: prev.totalVentas },
                { label: "CMV",                 actual: eerr.totalCMV,        prev: prev.totalCMV },
                { label: "Margen Bruto",        actual: eerr.margenBruto,     prev: prev.margenBruto },
                { label: "Gastos Operativos",   actual: eerr.totalGastosOp,   prev: prev.totalGastosOp },
                { label: "Resultado Operativo", actual: eerr.resultadoOp,     prev: prev.resultadoOp },
                { label: "Sueldos",             actual: eerr.totalSueldos,    prev: prev.totalSueldos },
                { label: "Retiros personales",  actual: eerr.totalRetiros,    prev: prev.totalRetiros },
              ].map(row => (
                <tr key={row.label} className="border-b">
                  <td className="py-2.5 text-muted-foreground">{row.label}</td>
                  <td className="py-2.5 text-right font-medium tabular-nums">{formatCurrency(row.actual)}</td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatCurrency(row.prev)}</td>
                  <td className="py-2.5 text-right"><Delta actual={row.actual} prev={row.prev} /></td>
                </tr>
              ))}
              <tr className="border-t-2 font-semibold">
                <td className="py-2.5">Resultado Final</td>
                <td className={`py-2.5 text-right tabular-nums ${eerr.resultadoFinal >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(eerr.resultadoFinal)}</td>
                <td className={`py-2.5 text-right tabular-nums ${prev.resultadoFinal >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(prev.resultadoFinal)}</td>
                <td className="py-2.5 text-right"><Delta actual={eerr.resultadoFinal} prev={prev.resultadoFinal} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
