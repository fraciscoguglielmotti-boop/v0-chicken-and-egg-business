import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { buildCostTimeline, getCostAtDate } from "@/lib/cost-timeline"
import { esMPGasto } from "@/lib/mp-constants"

export const maxDuration = 30

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Venta { fecha: string; cantidad: number; precio_unitario: number; producto_nombre?: string }
interface Compra { fecha: string; total: number; cantidad: number; precio_unitario: number; producto?: string }
interface Gasto {
  fecha: string
  monto: number
  categoria: string
  medio_pago?: string
  fecha_pago?: string
  descripcion?: string
  pagado?: boolean
}
interface MovimientoMP {
  fecha: string
  tipo: string
  monto: number
  descripcion?: string
  categoria?: string
}

const CATEGORIAS_SUELDOS = ["comisiones", "sueldos", "sueldo", "comisión", "comision"]
const CATEGORIAS_RETIROS = ["gastos personales francisco", "retiro de socio", "retiros"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mpAGasto(m: MovimientoMP): Gasto {
  return {
    fecha: m.fecha,
    monto: m.monto,
    categoria: m.categoria || "Sin categoría (MP)",
    medio_pago: "MercadoPago",
    descripcion: m.descripcion,
  }
}

function mesContable(g: Gasto): string {
  if (g.medio_pago === "Tarjeta Credito" && g.fecha_pago) return g.fecha_pago.slice(0, 7)
  return g.fecha.slice(0, 7)
}

function prevMonthStr(month: string): string {
  const [y, m] = month.split("-").map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, "0")}`
}

// ─── Paginación ──────────────────────────────────────────────────────────────

async function fetchAll<T>(
  supabase: any,
  table: string,
  select: string,
  filters: { col: string; op: "gte" | "lte" | "lt" | "eq"; val: string }[] = [],
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    let q = supabase.from(table).select(select)
    for (const f of filters) {
      if (f.op === "gte") q = q.gte(f.col, f.val)
      else if (f.op === "lte") q = q.lte(f.col, f.val)
      else if (f.op === "lt") q = q.lt(f.col, f.val)
      else if (f.op === "eq") q = q.eq(f.col, f.val)
    }
    q = q.range(from, from + pageSize - 1)
    const { data, error } = await q
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

// ─── Cálculo principal ────────────────────────────────────────────────────────

function calcEERR(
  todasVentas: Venta[],
  todasCompras: Compra[],
  gastosUnificados: Gasto[],
  month: string
) {
  const ventasFiltradas = todasVentas.filter((v) => v.fecha.startsWith(month))
  const gastosFiltrados = gastosUnificados.filter((g) => mesContable(g) === month)

  const totalVentas = ventasFiltradas.reduce((s, v) => s + v.cantidad * v.precio_unitario, 0)
  const costTimeline = buildCostTimeline(todasCompras)
  const totalCMV = ventasFiltradas.reduce((s, v) => {
    return s + (v.cantidad ?? 0) * getCostAtDate(v.producto_nombre ?? "", v.fecha, costTimeline)
  }, 0)
  const margenBruto = totalVentas - totalCMV
  const margenPct = totalVentas > 0 ? (margenBruto / totalVentas) * 100 : 0

  const esSueldo = (g: Gasto) =>
    CATEGORIAS_SUELDOS.some((cat) => (g.categoria ?? "").toLowerCase().trim() === cat)
  const esRetiro = (g: Gasto) =>
    CATEGORIAS_RETIROS.some((cat) => (g.categoria ?? "").toLowerCase().trim() === cat)

  const gastosOp = gastosFiltrados.filter((g) => !esSueldo(g) && !esRetiro(g))
  const gastosSueldos = gastosFiltrados.filter(esSueldo)
  const gastosRetiros = gastosFiltrados.filter(esRetiro)

  const totalGastosOp = gastosOp.reduce((s, g) => s + g.monto, 0)
  const totalSueldos = gastosSueldos.reduce((s, g) => s + g.monto, 0)
  const totalRetiros = gastosRetiros.reduce((s, g) => s + g.monto, 0)

  const desglose: Record<string, number> = {}
  const movimientosPorCat: Record<string, Gasto[]> = {}
  for (const g of gastosOp) {
    const cat = g.categoria || "Sin categoría"
    desglose[cat] = (desglose[cat] || 0) + g.monto
    if (!movimientosPorCat[cat]) movimientosPorCat[cat] = []
    movimientosPorCat[cat].push(g)
  }

  const resultadoOp = margenBruto - totalGastosOp
  const resultadoOpPct = totalVentas > 0 ? (resultadoOp / totalVentas) * 100 : 0
  const resultadoFinal = resultadoOp - totalSueldos - totalRetiros
  const resultadoFinalPct = totalVentas > 0 ? (resultadoFinal / totalVentas) * 100 : 0

  return {
    totalVentas,
    totalCMV,
    margenBruto,
    margenPct,
    totalGastosOp,
    desglose,
    movimientosPorCat,
    gastosSueldos,
    gastosRetiros,
    totalSueldos,
    totalRetiros,
    resultadoOp,
    resultadoOpPct,
    resultadoFinal,
    resultadoFinalPct,
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get("month")
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month inválido (YYYY-MM)" }, { status: 400 })
    }

    const prev = prevMonthStr(month)
    const [ey, em] = month.split("-").map(Number)
    const endOfMonth = `${month}-${String(new Date(ey, em, 0).getDate()).padStart(2, "0")}`
    const prevStart = `${prev}-01`

    const supabase = await createClient()

    const [ventas, compras, gastos, movimientosMp] = await Promise.all([
      fetchAll<Venta>(
        supabase,
        "ventas",
        "fecha,cantidad,precio_unitario,producto_nombre",
        [{ col: "fecha", op: "gte", val: prevStart }, { col: "fecha", op: "lte", val: endOfMonth }]
      ),
      fetchAll<Compra>(
        supabase,
        "compras",
        "fecha,total,cantidad,precio_unitario,producto",
        [{ col: "fecha", op: "lte", val: endOfMonth }]
      ),
      fetchAll<Gasto>(
        supabase,
        "gastos",
        "fecha,monto,categoria,medio_pago,fecha_pago,descripcion,pagado",
        [{ col: "fecha", op: "gte", val: `${prev}-01` }, { col: "fecha", op: "lte", val: endOfMonth }]
      ),
      fetchAll<MovimientoMP>(
        supabase,
        "movimientos_mp",
        "fecha,tipo,monto,descripcion,categoria",
        [{ col: "fecha", op: "gte", val: `${prev}-01` }, { col: "fecha", op: "lte", val: endOfMonth }]
      ),
    ])

    const gastosUnificados: Gasto[] = [
      ...gastos.filter((g) => g.pagado !== false),
      ...movimientosMp.filter(esMPGasto).map(mpAGasto),
    ]

    const current = calcEERR(ventas, compras, gastosUnificados, month)
    const previous = calcEERR(ventas, compras, gastosUnificados, prev)

    return NextResponse.json({
      month,
      prevMonth: prev,
      current,
      previous,
    })
  } catch (err: any) {
    console.error("[eerr/data]", err)
    return NextResponse.json(
      { error: err?.message ?? "Error calculando EERR" },
      { status: 500 }
    )
  }
}
