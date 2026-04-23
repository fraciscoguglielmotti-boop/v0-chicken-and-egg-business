import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

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

const CATEGORIAS_SUELDOS = ["Comisiones", "Sueldos", "Sueldo", "Comisión"]
const CATEGORIAS_RETIROS = ["Gastos Personales Francisco", "Retiro de socio", "Retiros"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esMPGasto(m: MovimientoMP): boolean {
  const tipo = m.tipo?.toLowerCase()
  const desc = m.descripcion?.toLowerCase() ?? ""
  return tipo === "egreso" && !desc.startsWith("transferencia")
}

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
// Supabase limita por default a 1000 filas. Paginamos para traer todo el
// historial (FIFO requiere compras y ventas completas hasta el mes objetivo).

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

// ─── Motor FIFO ───────────────────────────────────────────────────────────────

interface Lote { qty: number; costUnit: number }

function calcCMV_FIFO(
  todasCompras: Compra[],
  todasVentas: Venta[],
  monthPrefix: string
): number {
  const norm = (s?: string) => (s ?? "").toLowerCase().trim()

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

  const ultimoCostoUnit = new Map<string, number>()
  for (const c of sortedCompras) {
    if (!c.cantidad || c.cantidad <= 0) continue
    const total = c.total > 0 ? c.total : c.cantidad * c.precio_unitario
    const prod = norm(c.producto) || "__sin_producto__"
    ultimoCostoUnit.set(prod, total / c.cantidad)
  }

  const ultimoCostoGlobal = sortedCompras.length > 0
    ? (() => {
        const last = sortedCompras[sortedCompras.length - 1]
        const t = last.total > 0 ? last.total : last.cantidad * last.precio_unitario
        return last.cantidad > 0 ? t / last.cantidad : 0
      })()
    : 0

  const [_y, _m] = monthPrefix.split("-").map(Number)
  const endOfMonth = monthPrefix + "-" + String(new Date(_y, _m, 0).getDate()).padStart(2, "0")
  const sortedVentas = [...todasVentas]
    .filter((v) => v.fecha <= endOfMonth)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  let cmv = 0

  for (const v of sortedVentas) {
    if (!v.cantidad || v.cantidad <= 0) continue

    const prodVenta = norm(v.producto_nombre)

    let queue = queues.get(prodVenta)
    if (!queue) {
      const entry = Array.from(queues.entries()).find(
        ([k]) => k !== "__sin_producto__" && (k.includes(prodVenta) || prodVenta.includes(k))
      )
      queue = entry?.[1] ?? queues.get("__sin_producto__")
    }

    let remaining = v.cantidad
    let ventaCost = 0

    if (queue) {
      while (remaining > 0.0001 && queue.length > 0) {
        const lot = queue[0]
        const used = Math.min(remaining, lot.qty)
        ventaCost += used * lot.costUnit
        lot.qty -= used
        remaining -= used
        if (lot.qty <= 0.0001) queue.shift()
      }
    }

    if (remaining > 0.0001) {
      const fallback =
        ultimoCostoUnit.get(prodVenta) ??
        Array.from(ultimoCostoUnit.entries()).find(
          ([k]) => k !== "__sin_producto__" && (k.includes(prodVenta) || prodVenta.includes(k))
        )?.[1] ??
        ultimoCostoUnit.get("__sin_producto__") ??
        ultimoCostoGlobal
      ventaCost += remaining * fallback
    }

    if (v.fecha.startsWith(monthPrefix)) {
      cmv += ventaCost
    }
  }

  return cmv
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
  const totalCMV = calcCMV_FIFO(todasCompras, todasVentas, month)
  const margenBruto = totalVentas - totalCMV
  const margenPct = totalVentas > 0 ? (margenBruto / totalVentas) * 100 : 0

  const esSueldo = (g: Gasto) =>
    CATEGORIAS_SUELDOS.some((cat) => g.categoria?.toLowerCase() === cat.toLowerCase())
  const esRetiro = (g: Gasto) =>
    CATEGORIAS_RETIROS.some((cat) => g.categoria?.toLowerCase() === cat.toLowerCase())

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
    // Para FIFO necesitamos TODAS las compras y ventas hasta fin del mes objetivo
    // Para gastos, sólo los del mes actual y el anterior

    const supabase = await createClient()

    const [ventas, compras, gastos, movimientosMp] = await Promise.all([
      fetchAll<Venta>(
        supabase,
        "ventas",
        "fecha,cantidad,precio_unitario,producto_nombre",
        [{ col: "fecha", op: "lte", val: endOfMonth }]
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
