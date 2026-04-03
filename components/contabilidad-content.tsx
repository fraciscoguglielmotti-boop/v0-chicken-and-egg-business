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

interface Venta { fecha: string; cantidad: number; precio_unitario: number; producto_nombre?: string }
interface Compra { fecha: string; total: number; cantidad: number; precio_unitario: number; producto?: string }
interface Gasto { fecha: string; monto: number; categoria: string; medio_pago?: string; fecha_pago?: string; descripcion?: string }
interface MovimientoMP { fecha: string; tipo: string; monto: number; descripcion?: string; categoria?: string }

// Egresos de MP categorizados que no sean transferencias entre cuentas
function esMPGasto(m: MovimientoMP): boolean {
  return m.tipo === "egreso" && !!m.categoria && !m.descripcion?.toLowerCase().startsWith("transferencia")
}
function mpAGasto(m: MovimientoMP): Gasto {
  return { fecha: m.fecha, monto: m.monto, categoria: m.categoria!, medio_pago: "MercadoPago", descripcion: m.descripcion }
}

// Para tarjeta de crédito con fecha_pago, el gasto impacta en el mes del pago (no del consumo)
function mesContable(g: Gasto): string {
  if (g.medio_pago === "Tarjeta Credito" && g.fecha_pago) return g.fecha_pago.slice(0, 7)
  return g.fecha.slice(0, 7)
}

// ── Motor FIFO ────────────────────────────────────────────────────────────────
// Calcula el CMV de un mes aplicando el principio de devengamiento:
// el costo se reconoce en el mes en que SE VENDE la mercadería,
// no en el mes en que se compró.
//
// Algoritmo:
//   1. Construye colas FIFO por producto con TODAS las compras históricas (orden cronológico)
//   2. Recorre TODAS las ventas hasta el fin del mes objetivo, consumiendo de las colas
//   3. Acumula CMV solo de las ventas que caen en el mes objetivo
//
// Si una venta consume unidades de dos lotes distintos (ej: 100 caj. a $1.000
// y luego 50 caj. a $1.100), el costo se proratea correctamente.
// Si el stock FIFO es insuficiente (compras no registradas), el resto
// se valúa al costo promedio ponderado de todas las compras.

interface Lote { qty: number; costUnit: number }

function calcCMV_FIFO(
  todasCompras: Compra[],
  todasVentas: Venta[],
  monthPrefix: string   // "YYYY-MM"
): number {
  const norm = (s?: string) => (s ?? "").toLowerCase().trim()

  // ── 1. Construir colas FIFO por producto ──────────────────────────────────
  const queues = new Map<string, Lote[]>()

  const sortedCompras = [...todasCompras].sort((a, b) => a.fecha.localeCompare(b.fecha))
  for (const c of sortedCompras) {
    if (!c.cantidad || c.cantidad <= 0) continue
    const total = c.total > 0 ? c.total : c.cantidad * c.precio_unitario
    const costUnit = total / c.cantidad
    const prod = norm(c.producto) || "__sin_producto__"
    if (!queues.has(prod)) queues.set(prod, [])
    queues.get(prod)!.push({ qty: c.cantidad, costUnit })
  }

  // Último costo unitario por producto (fallback si el stock FIFO se agota)
  const ultimoCostoUnit = new Map<string, number>()
  for (const c of sortedCompras) {
    if (!c.cantidad || c.cantidad <= 0) continue
    const total = c.total > 0 ? c.total : c.cantidad * c.precio_unitario
    const prod = norm(c.producto) || "__sin_producto__"
    ultimoCostoUnit.set(prod, total / c.cantidad)
  }
  // Último costo global como último recurso
  const ultimoCostoGlobal = sortedCompras.length > 0
    ? (() => {
        const last = sortedCompras[sortedCompras.length - 1]
        const t = last.total > 0 ? last.total : last.cantidad * last.precio_unitario
        return last.cantidad > 0 ? t / last.cantidad : 0
      })()
    : 0

  // ── 2. Consumir stock según ventas, en orden cronológico ──────────────────
  // Procesamos todas las ventas hasta el último día del mes objetivo
  const endOfMonth = monthPrefix + "-31"
  const sortedVentas = [...todasVentas]
    .filter(v => v.fecha <= endOfMonth)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  let cmv = 0

  for (const v of sortedVentas) {
    if (!v.cantidad || v.cantidad <= 0) continue

    const prodVenta = norm(v.producto_nombre)

    // Buscar cola exacta, luego por coincidencia parcial, luego fallback genérico
    let queue = queues.get(prodVenta)
    if (!queue) {
      const entry = Array.from(queues.entries()).find(
        ([k]) => k !== "__sin_producto__" && (k.includes(prodVenta) || prodVenta.includes(k))
      )
      queue = entry?.[1] ?? queues.get("__sin_producto__")
    }

    let remaining = v.cantidad
    let ventaCost  = 0

    if (queue) {
      while (remaining > 0.0001 && queue.length > 0) {
        const lot = queue[0]
        const used = Math.min(remaining, lot.qty)
        ventaCost  += used * lot.costUnit
        lot.qty    -= used
        remaining  -= used
        if (lot.qty <= 0.0001) queue.shift()
      }
    }

    // Si quedaron unidades sin cubrir (stock insuficiente), usar el último
    // precio conocido del producto; si no hay, el último precio global
    if (remaining > 0.0001) {
      const fallback = ultimoCostoUnit.get(prodVenta)
        ?? Array.from(ultimoCostoUnit.entries()).find(
             ([k]) => k !== "__sin_producto__" && (k.includes(prodVenta) || prodVenta.includes(k))
           )?.[1]
        ?? ultimoCostoUnit.get("__sin_producto__")
        ?? ultimoCostoGlobal
      ventaCost += remaining * fallback
    }

    // Solo acumular si la venta es del mes objetivo
    if (v.fecha.startsWith(monthPrefix)) {
      cmv += ventaCost
    }
  }

  return cmv
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

// todasVentas y todasCompras = datos completos sin filtrar (el FIFO los necesita todos)
function calcEERR(todasVentas: Venta[], todasCompras: Compra[], gastos: Gasto[], month: string) {
  const ventasFiltradas = todasVentas.filter(v => v.fecha.startsWith(month))
  const gastosFiltrados = gastos.filter(g => mesContable(g) === month)

  const totalVentas = ventasFiltradas.reduce((s, v) => s + v.cantidad * v.precio_unitario, 0)
  // CMV calculado por FIFO: el costo se imputa al mes de la venta, no al de la compra
  const totalCMV = calcCMV_FIFO(todasCompras, todasVentas, month)
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
  const { data: ventas = [] }        = useSupabase<Venta>("ventas")
  const { data: compras = [] }       = useSupabase<Compra>("compras")
  const { data: gastos = [] }        = useSupabase<Gasto>("gastos")
  const { data: movimientosMp = [] } = useSupabase<MovimientoMP>("movimientos_mp")

  // Unifica gastos de la tabla gastos + egresos categorizados de MP
  const gastosUnificados = useMemo(() => [
    ...gastos,
    ...movimientosMp.filter(esMPGasto).map(mpAGasto),
  ], [gastos, movimientosMp])

  // Abrir en el mes anterior: el mes en curso está incompleto, no tiene sentido
  // analizarlo hasta que termine
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [gastosExpanded, setGastosExpanded] = useState(false)

  const { eerr, prev } = useMemo(() => ({
    eerr: calcEERR(ventas, compras, gastosUnificados, selectedMonth),
    prev: calcEERR(ventas, compras, gastosUnificados, prevMonthStr(selectedMonth)),
  }), [ventas, compras, gastosUnificados, selectedMonth])

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
          <EERRRow label="(−) Costo de mercadería vendida (FIFO)" value={eerr.totalCMV} />
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
