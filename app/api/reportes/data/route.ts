import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { buildCostTimeline, getCostAtDate } from "@/lib/cost-timeline"

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0]
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

function getDateRanges(refDate?: Date) {
  const now = refDate ?? new Date()
  const actualNow = new Date()
  const actualToday = toDateStr(actualNow)
  const today = toDateStr(now)
  const yesterday = toDateStr(addDays(now, -1))

  // Inicio de semana (lunes)
  const dow = now.getUTCDay() // 0=Dom
  const daysToMon = dow === 0 ? 6 : dow - 1
  const weekStart = toDateStr(addDays(now, -daysToMon))
  const weekSunday = toDateStr(addDays(now, -daysToMon + 6))
  const weekEnd = weekSunday <= actualToday ? weekSunday : actualToday

  // Semana anterior
  const lastWeekEnd = toDateStr(addDays(now, -daysToMon - 1))
  const lastWeekStart = toDateStr(addDays(now, -daysToMon - 7))

  // Mes actual
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + 1
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`
  const monthLastDay = toDateStr(new Date(Date.UTC(y, now.getUTCMonth() + 1, 0)))
  const monthEnd = monthLastDay <= actualToday ? monthLastDay : actualToday

  // Mes anterior
  const lastMonthDate = new Date(Date.UTC(y, now.getUTCMonth() - 1, 1))
  const lastMonthStart = toDateStr(lastMonthDate)
  const lastMonthEnd = toDateStr(new Date(Date.UTC(y, now.getUTCMonth(), 0)))

  // Mismo mes año anterior
  const sameMonthLastYearStart = `${y - 1}-${String(m).padStart(2, "0")}-01`
  const sameMonthLastYearEnd = toDateStr(new Date(Date.UTC(y - 1, m, 0)))

  // Últimos 6 meses
  const sixMonthsAgo = toDateStr(new Date(Date.UTC(y, now.getUTCMonth() - 5, 1)))

  return {
    now,
    today,
    yesterday,
    weekStart,
    weekEnd,
    lastWeekStart,
    lastWeekEnd,
    monthStart,
    monthEnd,
    lastMonthStart,
    lastMonthEnd,
    sameMonthLastYearStart,
    sameMonthLastYearEnd,
    sixMonthsAgo,
  }
}

// ─── Helpers de cálculo ───────────────────────────────────────────────────────

function sumVentas(rows: { cantidad?: number; precio_unitario?: number }[]) {
  return rows.reduce((s, r) => s + (r.cantidad ?? 0) * (r.precio_unitario ?? 0), 0)
}

function sumCantidad(rows: { cantidad?: number }[]) {
  return rows.reduce((s, r) => s + (r.cantidad ?? 0), 0)
}

function sumMonto(rows: { monto?: number }[]) {
  return rows.reduce((s, r) => s + (r.monto ?? 0), 0)
}

function sumTotal(rows: { total?: number; cantidad?: number; precio_unitario?: number }[]) {
  return rows.reduce((s, r) => s + (r.total ?? (r.cantidad ?? 0) * (r.precio_unitario ?? 0)), 0)
}

function pct(a: number, b: number) {
  if (b === 0) return a > 0 ? 100 : 0
  return Math.round(((a - b) / b) * 1000) / 10
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function topClientes(ventas: any[], limit: number) {
  const map: Record<string, number> = {}
  for (const v of ventas) {
    const monto = (v.cantidad ?? 0) * (v.precio_unitario ?? 0)
    const nombre = v.cliente_nombre || "Sin nombre"
    map[nombre] = (map[nombre] ?? 0) + monto
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([nombre, monto]) => ({ nombre, monto: Math.round(monto) }))
}

function topProductos(ventas: any[], limit: number) {
  const map: Record<string, { unidades: number; ingresos: number }> = {}
  for (const v of ventas) {
    const nombre = v.producto_nombre || "Sin nombre"
    const und = v.cantidad ?? 0
    const ing = und * (v.precio_unitario ?? 0)
    if (!map[nombre]) map[nombre] = { unidades: 0, ingresos: 0 }
    map[nombre].unidades += und
    map[nombre].ingresos += ing
  }
  return Object.entries(map)
    .sort((a, b) => b[1].ingresos - a[1].ingresos)
    .slice(0, limit)
    .map(([producto, d]) => ({ producto, unidades: Math.round(d.unidades), ingresos: Math.round(d.ingresos) }))
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const tipo = req.nextUrl.searchParams.get("tipo") ?? "diario"
    const fechaParam = req.nextUrl.searchParams.get("fecha")
    const semanaParam = req.nextUrl.searchParams.get("semana")
    const mesParam = req.nextUrl.searchParams.get("mes")

    let refDate: Date | undefined
    if (tipo === "diario" && fechaParam) {
      refDate = new Date(fechaParam + "T12:00:00Z")
    } else if (tipo === "semanal" && semanaParam) {
      refDate = new Date(semanaParam + "T12:00:00Z")
    } else if (tipo === "mensual" && mesParam) {
      refDate = new Date(mesParam + "-15T12:00:00Z")
    }

    const supabase = await createClient()
    const d = getDateRanges(refDate)

    // ── Diario ────────────────────────────────────────────────────────────────
    if (tipo === "diario") {
      const d60ago = toDateStr(addDays(d.now, -60))

      const [
        { data: vHoy },
        { data: vAyer },
        { data: cHoy },
        { data: cAyer },
        { data: gHoy },
        { data: comprasRecientes },
        { data: ventasRecientes },
      ] = await Promise.all([
        supabase.from("ventas").select("cliente_nombre,producto_nombre,cantidad,precio_unitario").gte("fecha", d.today).lt("fecha", toDateStr(addDays(d.now, 1))),
        supabase.from("ventas").select("cantidad,precio_unitario").gte("fecha", d.yesterday).lt("fecha", d.today),
        supabase.from("cobros").select("monto").gte("fecha", d.today).lt("fecha", toDateStr(addDays(d.now, 1))),
        supabase.from("cobros").select("monto").gte("fecha", d.yesterday).lt("fecha", d.today),
        supabase.from("gastos").select("monto").gte("fecha", d.today).lt("fecha", toDateStr(addDays(d.now, 1))),
        supabase.from("compras").select("fecha,producto,cantidad,precio_unitario,total").lte("fecha", d.today),
        supabase.from("ventas").select("cliente_nombre,fecha").gte("fecha", d60ago).lte("fecha", d.today),
      ])

      const totalVHoy = sumVentas(vHoy ?? [])
      const totalVAyer = sumVentas(vAyer ?? [])
      const totalCHoy = sumMonto(cHoy ?? [])
      const totalCAyer = sumMonto(cAyer ?? [])

      const fechaFmt = new Date(d.today + "T12:00:00Z").toLocaleDateString("es-AR", {
        weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
      })

      const cajonesHoy = Math.round(sumCantidad(vHoy ?? []))
      const cajonesAyer = Math.round(sumCantidad(vAyer ?? []))

      const tasaCobranzaDia = totalVHoy > 0 ? round1((totalCHoy / totalVHoy) * 100) : 0
      const pendienteDia = Math.round(totalVHoy - totalCHoy)
      const clientesHoySet = new Set((vHoy ?? []).map((v) => v.cliente_nombre).filter(Boolean))
      const ticketPromedioDia = clientesHoySet.size > 0 ? Math.round(totalVHoy / clientesHoySet.size) : 0

      // Último precio de compra vigente en d.today para cada producto
      const costTimelineDia = buildCostTimeline(comprasRecientes ?? [])
      const getCostoDia = (nombre: string) => getCostAtDate(nombre, d.today, costTimelineDia)

      // ── Resumen de rentabilidad por producto ─────────────────────────────
      const prodMap: Record<string, { cajones: number; ingresos: number; costoTotal: number; precios: number[] }> = {}
      for (const v of vHoy ?? []) {
        const key = v.producto_nombre || "Sin nombre"
        if (!prodMap[key]) prodMap[key] = { cajones: 0, ingresos: 0, costoTotal: 0, precios: [] }
        const qty = v.cantidad ?? 0
        const pu = v.precio_unitario ?? 0
        prodMap[key].cajones += qty
        prodMap[key].ingresos += qty * pu
        prodMap[key].costoTotal += qty * getCostoDia(key)
        if (pu > 0) prodMap[key].precios.push(pu)
      }
      const costosProducto = Object.entries(prodMap)
        .sort((a, b) => b[1].ingresos - a[1].ingresos)
        .map(([producto, pd]) => {
          const costoUnitario = Math.round(getCostoDia(producto))
          const precioPromedio = pd.precios.length > 0 ? Math.round(pd.precios.reduce((s, p) => s + p, 0) / pd.precios.length) : 0
          const ganancia = Math.round(pd.ingresos - pd.costoTotal)
          const margen = pd.ingresos > 0 ? round1((ganancia / pd.ingresos) * 100) : 0
          return { producto, costoUnitario, precioPromedio, cajones: Math.round(pd.cajones), ingresos: Math.round(pd.ingresos), costoTotal: Math.round(pd.costoTotal), ganancia, margen }
        })

      const gananciaBruta = costosProducto.reduce((s, p) => s + p.ganancia, 0)
      const margenBruto = totalVHoy > 0 ? round1((gananciaBruta / totalVHoy) * 100) : 0

      // ── Detalle de ventas por cliente ────────────────────────────────────
      const clienteMap: Record<string, Map<string, { cantidad: number; precioVenta: number; costoUnitario: number }>> = {}
      for (const v of vHoy ?? []) {
        const cliente = v.cliente_nombre || "Sin nombre"
        const prod = v.producto_nombre || "Sin nombre"
        const pu = v.precio_unitario ?? 0
        const costoUnit = Math.round(getCostoDia(prod))
        if (!clienteMap[cliente]) clienteMap[cliente] = new Map()
        const mapKey = `${prod}__${pu}`
        const existing = clienteMap[cliente].get(mapKey)
        if (existing) {
          existing.cantidad += (v.cantidad ?? 0)
        } else {
          clienteMap[cliente].set(mapKey, { cantidad: v.cantidad ?? 0, precioVenta: pu, costoUnitario: costoUnit })
        }
      }
      const ventasDetalle = Object.entries(clienteMap)
        .map(([cliente, itemsMap]) => {
          const items = Array.from(itemsMap.entries()).map(([key, v]) => ({
            producto: key.split("__")[0],
            cantidad: v.cantidad,
            precioVenta: v.precioVenta,
            costoUnitario: v.costoUnitario,
          }))
          const total = items.reduce((s, i) => s + i.cantidad * i.precioVenta, 0)
          return { cliente, items, total }
        })
        .sort((a, b) => b.total - a.total)
        .map(({ cliente, items }) => ({ cliente, items }))

      // ── Clientes sin comprar ─────────────────────────────────────────────
      const lastPurchase: Record<string, string> = {}
      for (const v of ventasRecientes ?? []) {
        if (!lastPurchase[v.cliente_nombre] || v.fecha > lastPurchase[v.cliente_nombre]) {
          lastPurchase[v.cliente_nombre] = v.fecha
        }
      }
      const sevenDaysAgo = toDateStr(addDays(d.now, -7))
      const clientesSinComprar = Object.entries(lastPurchase)
        .filter(([, fecha]) => fecha <= sevenDaysAgo)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .slice(0, 20)
        .map(([nombre, ultima]) => ({
          nombre,
          diasSinComprar: Math.floor((d.now.getTime() - new Date(ultima + "T12:00:00Z").getTime()) / 86400000),
        }))

      return NextResponse.json({
        fecha: fechaFmt.charAt(0).toUpperCase() + fechaFmt.slice(1),
        ventas: { hoy: Math.round(totalVHoy), ayer: Math.round(totalVAyer), delta: round1(pct(totalVHoy, totalVAyer)) },
        cobros: { hoy: Math.round(totalCHoy), ayer: Math.round(totalCAyer), delta: round1(pct(totalCHoy, totalCAyer)) },
        cajones: { hoy: cajonesHoy, ayer: cajonesAyer, delta: round1(pct(cajonesHoy, cajonesAyer)) },
        tasaCobranza: tasaCobranzaDia,
        pendiente: pendienteDia,
        ticketPromedio: ticketPromedioDia,
        gananciaBruta,
        margenBruto,
        costosProducto,
        ventasDetalle,
        topClientes: topClientes(vHoy ?? [], 5),
        desglose: topProductos(vHoy ?? [], 10),
        gastos: Math.round(sumMonto(gHoy ?? [])),
        clientesSinComprar,
      })
    }

    // ── Semanal ───────────────────────────────────────────────────────────────
    if (tipo === "semanal") {
      const d60ago = toDateStr(addDays(d.now, -60))

      // Weeks for comparison: 1, 4, 8, 12 semanas atrás (misma duración que la semana actual)
      const weekStartD = new Date(d.weekStart + "T12:00:00Z")
      const mkWeek = (weeksAgo: number) => ({
        inicio: toDateStr(addDays(weekStartD, -7 * weeksAgo)),
        fin: toDateStr(addDays(weekStartD, -7 * weeksAgo + 6)),
      })
      const w1 = mkWeek(1)
      const w4 = mkWeek(4)
      const w8 = mkWeek(8)
      const w12 = mkWeek(12)

      const [
        { data: vSem },
        { data: vW1 },
        { data: vW4 },
        { data: vW8 },
        { data: vW12 },
        { data: cSem },
        { data: cW1 },
        { data: comprasRecientes },
        { data: ventasRecientes },
      ] = await Promise.all([
        supabase.from("ventas").select("fecha,cliente_nombre,producto_nombre,cantidad,precio_unitario").gte("fecha", d.weekStart).lte("fecha", d.weekEnd),
        supabase.from("ventas").select("fecha,cliente_nombre,producto_nombre,cantidad,precio_unitario").gte("fecha", w1.inicio).lte("fecha", w1.fin),
        supabase.from("ventas").select("fecha,cliente_nombre,producto_nombre,cantidad,precio_unitario").gte("fecha", w4.inicio).lte("fecha", w4.fin),
        supabase.from("ventas").select("fecha,cliente_nombre,producto_nombre,cantidad,precio_unitario").gte("fecha", w8.inicio).lte("fecha", w8.fin),
        supabase.from("ventas").select("fecha,cliente_nombre,producto_nombre,cantidad,precio_unitario").gte("fecha", w12.inicio).lte("fecha", w12.fin),
        supabase.from("cobros").select("fecha,monto").gte("fecha", d.weekStart).lte("fecha", d.weekEnd),
        supabase.from("cobros").select("monto").gte("fecha", w1.inicio).lte("fecha", w1.fin),
        supabase.from("compras").select("fecha,producto,cantidad,precio_unitario,total").lte("fecha", d.today),
        supabase.from("ventas").select("cliente_nombre,fecha").gte("fecha", d60ago).lte("fecha", d.today),
      ])

      const totalVSem = sumVentas(vSem ?? [])
      const totalVAnt = sumVentas(vW1 ?? [])
      const totalCSem = sumMonto(cSem ?? [])
      const totalCAnt = sumMonto(cW1 ?? [])

      // Ventas y cobros por día de la semana
      const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
      const vPorFecha: Record<string, number> = {}
      const cPorFecha: Record<string, number> = {}
      for (const v of vSem ?? []) vPorFecha[v.fecha] = (vPorFecha[v.fecha] ?? 0) + (v.cantidad ?? 0) * (v.precio_unitario ?? 0)
      for (const c of cSem ?? []) cPorFecha[c.fecha] = (cPorFecha[c.fecha] ?? 0) + (c.monto ?? 0)

      const ventasPorDia: { dia: string; ventas: number; cobros: number }[] = []
      const cursor = new Date(d.weekStart + "T12:00:00Z")
      const end = new Date(d.weekEnd + "T12:00:00Z")
      while (cursor <= end) {
        const ds = toDateStr(cursor)
        ventasPorDia.push({
          dia: DIAS[cursor.getUTCDay()],
          ventas: Math.round(vPorFecha[ds] ?? 0),
          cobros: Math.round(cPorFecha[ds] ?? 0),
        })
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }

      const tasaCobranza = totalVSem > 0 ? round1((totalCSem / totalVSem) * 100) : 0
      const clientesActivos = new Set((vSem ?? []).map((v) => v.cliente_nombre).filter(Boolean)).size
      const pendiente = Math.round(totalVSem - totalCSem)
      const ticketPromedioPorCliente = clientesActivos > 0 ? Math.round(totalVSem / clientesActivos) : 0

      const startFmt = new Date(d.weekStart + "T12:00:00Z").toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "UTC" })
      const endFmt = new Date(d.weekEnd + "T12:00:00Z").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

      // Último precio de compra vigente en la fecha de cada venta (historial completo)
      const costTimelineSem = buildCostTimeline(comprasRecientes ?? [])

      // ── Rentabilidad por producto (semana) ─────────────────────────────────
      // Para costosProducto (tabla de la semana actual), el costoUnitario a mostrar es
      // el precio vigente al último día de la semana (representativo del período).
      const prodMap: Record<string, { cajones: number; ingresos: number; costoTotal: number; precios: number[] }> = {}
      for (const v of vSem ?? []) {
        const key = v.producto_nombre || "Sin nombre"
        if (!prodMap[key]) prodMap[key] = { cajones: 0, ingresos: 0, costoTotal: 0, precios: [] }
        const qty = v.cantidad ?? 0
        const pu = v.precio_unitario ?? 0
        prodMap[key].cajones += qty
        prodMap[key].ingresos += qty * pu
        prodMap[key].costoTotal += qty * getCostAtDate(key, v.fecha, costTimelineSem)
        if (pu > 0) prodMap[key].precios.push(pu)
      }
      const costosProducto = Object.entries(prodMap)
        .sort((a, b) => b[1].ingresos - a[1].ingresos)
        .map(([producto, pd]) => {
          const costoUnitario = Math.round(getCostAtDate(producto, d.weekEnd, costTimelineSem))
          const precioPromedio = pd.precios.length > 0 ? Math.round(pd.precios.reduce((s, p) => s + p, 0) / pd.precios.length) : 0
          const ganancia = Math.round(pd.ingresos - pd.costoTotal)
          const margen = pd.ingresos > 0 ? round1((ganancia / pd.ingresos) * 100) : 0
          return { producto, costoUnitario, precioPromedio, cajones: Math.round(pd.cajones), ingresos: Math.round(pd.ingresos), costoTotal: Math.round(pd.costoTotal), ganancia, margen }
        })

      const gananciaBruta = costosProducto.reduce((s, p) => s + p.ganancia, 0)
      const margenBruto = totalVSem > 0 ? round1((gananciaBruta / totalVSem) * 100) : 0

      // ── Detalle por cliente — costo por fecha de cada venta ──────────────
      // Acumula costo por (cliente, producto); el costoUnitario representativo
      // es el de la última venta de ese producto para ese cliente en la semana.
      const clienteMap: Record<string, Map<string, { cantidad: number; ingresos: number; costoTotal: number; lastCostoUnit: number }>> = {}
      for (const v of vSem ?? []) {
        const cliente = (v.cliente_nombre || "Sin nombre").trim() || "Sin nombre"
        const prod = (v.producto_nombre || "Sin nombre").trim() || "Sin nombre"
        const qty = v.cantidad ?? 0
        const pu = v.precio_unitario ?? 0
        const costoUnit = getCostAtDate(prod, v.fecha, costTimelineSem)
        if (!clienteMap[cliente]) clienteMap[cliente] = new Map()
        const existing = clienteMap[cliente].get(prod)
        if (existing) {
          existing.cantidad += qty
          existing.ingresos += qty * pu
          existing.costoTotal += qty * costoUnit
          existing.lastCostoUnit = Math.round(costoUnit)
        } else {
          clienteMap[cliente].set(prod, { cantidad: qty, ingresos: qty * pu, costoTotal: qty * costoUnit, lastCostoUnit: Math.round(costoUnit) })
        }
      }
      const ventasDetalle = Object.entries(clienteMap)
        .map(([cliente, itemsMap]) => {
          const items = Array.from(itemsMap.entries()).map(([producto, v]) => {
            const precioPromedio = v.cantidad > 0 ? Math.round(v.ingresos / v.cantidad) : 0
            const ganancia = Math.round(v.ingresos - v.costoTotal)
            const margen = v.ingresos > 0 ? round1((ganancia / v.ingresos) * 100) : 0
            return {
              producto,
              cantidad: Math.round(v.cantidad),
              precioPromedio,
              costoUnitario: v.lastCostoUnit,
              ingresos: Math.round(v.ingresos),
              ganancia,
              margen,
            }
          }).sort((a, b) => b.ingresos - a.ingresos)
          const total = items.reduce((s, i) => s + i.ingresos, 0)
          const gananciaTotal = items.reduce((s, i) => s + i.ganancia, 0)
          const margenTotal = total > 0 ? round1((gananciaTotal / total) * 100) : 0
          return { cliente, items, total, ganancia: gananciaTotal, margen: margenTotal }
        })
        .sort((a, b) => b.total - a.total)

      // ── Comparación con semanas pasadas — costo por fecha de cada venta ───
      const fmtRange = (inicio: string, fin: string) => {
        const i = new Date(inicio + "T12:00:00Z")
        const f = new Date(fin + "T12:00:00Z")
        const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" }
        return `${i.toLocaleDateString("es-AR", opts)} – ${f.toLocaleDateString("es-AR", opts)}`
      }
      const weekMetrics = (rows: { fecha?: string; cliente_nombre?: string | null; cantidad?: number; precio_unitario?: number; producto_nombre?: string | null }[] | null) => {
        const r = rows ?? []
        let ventas = 0, cajones = 0, costoTotal = 0
        const clientes = new Set<string>()
        for (const v of r) {
          const qty = v.cantidad ?? 0
          const pu = v.precio_unitario ?? 0
          const fechaVenta = v.fecha ?? d.today
          ventas += qty * pu
          cajones += qty
          costoTotal += qty * getCostAtDate(v.producto_nombre || "", fechaVenta, costTimelineSem)
          if (v.cliente_nombre) clientes.add(v.cliente_nombre.trim())
        }
        const ganancia = ventas - costoTotal
        return {
          ventas: Math.round(ventas),
          ganancia: Math.round(ganancia),
          margen: ventas > 0 ? round1((ganancia / ventas) * 100) : 0,
          cajones: Math.round(cajones),
          clientes: clientes.size,
        }
      }
      const comparacionSemanas = [
        { label: "Esta semana", inicio: d.weekStart, fin: d.weekEnd, rango: fmtRange(d.weekStart, d.weekEnd), actual: true, ...weekMetrics(vSem ?? []) },
        { label: "Semana anterior", inicio: w1.inicio, fin: w1.fin, rango: fmtRange(w1.inicio, w1.fin), actual: false, ...weekMetrics(vW1 ?? []) },
        { label: "Hace 1 mes", inicio: w4.inicio, fin: w4.fin, rango: fmtRange(w4.inicio, w4.fin), actual: false, ...weekMetrics(vW4 ?? []) },
        { label: "Hace 2 meses", inicio: w8.inicio, fin: w8.fin, rango: fmtRange(w8.inicio, w8.fin), actual: false, ...weekMetrics(vW8 ?? []) },
        { label: "Hace 3 meses", inicio: w12.inicio, fin: w12.fin, rango: fmtRange(w12.inicio, w12.fin), actual: false, ...weekMetrics(vW12 ?? []) },
      ]

      // ── Clientes sin comprar esta semana (activos últimos 60 días) ─────────
      const clientesEstaSemanSet = new Set((vSem ?? []).map((v) => v.cliente_nombre).filter(Boolean))
      const lastPurchase: Record<string, string> = {}
      for (const v of ventasRecientes ?? []) {
        if (!lastPurchase[v.cliente_nombre] || v.fecha > lastPurchase[v.cliente_nombre]) {
          lastPurchase[v.cliente_nombre] = v.fecha
        }
      }
      const clientesSinComprar = Object.entries(lastPurchase)
        .filter(([nombre, fecha]) => !clientesEstaSemanSet.has(nombre) && fecha < d.weekStart)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .slice(0, 20)
        .map(([nombre, ultima]) => ({
          nombre,
          diasSinComprar: Math.floor((d.now.getTime() - new Date(ultima + "T12:00:00Z").getTime()) / 86400000),
        }))

      return NextResponse.json({
        semana: `Semana del ${startFmt} al ${endFmt}`,
        ventas: { semana: Math.round(totalVSem), anterior: Math.round(totalVAnt), delta: round1(pct(totalVSem, totalVAnt)) },
        cobros: { semana: Math.round(totalCSem), anterior: Math.round(totalCAnt), delta: round1(pct(totalCSem, totalCAnt)) },
        cajonesSemana: Math.round(sumCantidad(vSem ?? [])),
        cajonesAntSemana: Math.round(sumCantidad(vW1 ?? [])),
        clientesActivos,
        pendiente,
        ticketPromedioPorCliente,
        tasaCobranza,
        gananciaBruta,
        margenBruto,
        costosProducto,
        ventasDetalle,
        ventasPorDia,
        topClientes: topClientes(vSem ?? [], 5),
        desglose: topProductos(vSem ?? [], 10),
        clientesSinComprar,
        comparacionSemanas,
      })
    }

    // ── Mensual ───────────────────────────────────────────────────────────────
    if (tipo === "mensual") {
      const [
        { data: vMes },
        { data: vMesAnt },
        { data: vMesAA },
        { data: cMes },
        { data: cMesAnt },
        { data: cMesAA },
        { data: gMes },
        { data: gMesAnt },
        { data: compMes },
        { data: compMesAnt },
        { data: vSeis },
        { data: cSeis },
        { data: todasCompras },
        { data: todasVentasHist },
      ] = await Promise.all([
        supabase.from("ventas").select("fecha,cliente_nombre,producto_nombre,cantidad,precio_unitario").gte("fecha", d.monthStart).lte("fecha", d.monthEnd),
        supabase.from("ventas").select("producto_nombre,cantidad,precio_unitario").gte("fecha", d.lastMonthStart).lte("fecha", d.lastMonthEnd),
        supabase.from("ventas").select("producto_nombre,cantidad,precio_unitario").gte("fecha", d.sameMonthLastYearStart).lte("fecha", d.sameMonthLastYearEnd),
        supabase.from("cobros").select("fecha,monto,metodo_pago").gte("fecha", d.monthStart).lte("fecha", d.monthEnd),
        supabase.from("cobros").select("monto").gte("fecha", d.lastMonthStart).lte("fecha", d.lastMonthEnd),
        supabase.from("cobros").select("monto").gte("fecha", d.sameMonthLastYearStart).lte("fecha", d.sameMonthLastYearEnd),
        supabase.from("gastos").select("monto").gte("fecha", d.monthStart).lte("fecha", d.monthEnd),
        supabase.from("gastos").select("monto").gte("fecha", d.lastMonthStart).lte("fecha", d.lastMonthEnd),
        supabase.from("compras").select("total,producto,cantidad,precio_unitario").gte("fecha", d.monthStart).lte("fecha", d.monthEnd),
        supabase.from("compras").select("total,cantidad,precio_unitario").gte("fecha", d.lastMonthStart).lte("fecha", d.lastMonthEnd),
        supabase.from("ventas").select("fecha,cantidad,precio_unitario").gte("fecha", d.sixMonthsAgo).lte("fecha", d.monthEnd),
        supabase.from("cobros").select("fecha,monto").gte("fecha", d.sixMonthsAgo).lte("fecha", d.monthEnd),
        // Costo promedio: compras históricas hasta fin del mes para calcular costo por producto
        supabase.from("compras").select("fecha,total,producto,cantidad,precio_unitario").lte("fecha", d.monthEnd),
        supabase.from("ventas").select("fecha,cliente_nombre,producto_nombre,cantidad,precio_unitario").lte("fecha", d.monthEnd),
      ])

      const totalVMes = sumVentas(vMes ?? [])
      const totalVMesAnt = sumVentas(vMesAnt ?? [])
      const totalVMesAA = sumVentas(vMesAA ?? [])
      const totalCMes = sumMonto(cMes ?? [])
      const totalCMesAnt = sumMonto(cMesAnt ?? [])
      const totalCMesAA = sumMonto(cMesAA ?? [])
      const totalGMes = sumMonto(gMes ?? [])
      const totalGMesAnt = sumMonto(gMesAnt ?? [])
      const totalCompMes = sumTotal(compMes ?? [])

      // Timeline de costos: para cada venta usa el último precio de compra vigente en esa fecha.
      // Esto evita distorsiones del promedio histórico cuando los precios cambian con el tiempo.
      const costTimeline = buildCostTimeline(todasCompras ?? [])

      let cogsMes = 0
      for (const v of vMes ?? []) {
        cogsMes += (v.cantidad ?? 0) * getCostAtDate(v.producto_nombre ?? "", v.fecha, costTimeline)
      }
      // vMesAnt no tiene fecha por fila; usamos fin del mes anterior como proxy
      let cogsMesAnt = 0
      for (const v of vMesAnt ?? []) {
        cogsMesAnt += (v.cantidad ?? 0) * getCostAtDate(v.producto_nombre ?? "", d.lastMonthEnd, costTimeline)
      }

      const resultadoNeto = totalVMes - cogsMes - totalGMes
      const resultadoNetoAnt = totalVMesAnt - cogsMesAnt - totalGMesAnt
      const margenNeto = totalVMes > 0 ? round1((resultadoNeto / totalVMes) * 100) : 0
      const margenBruto = totalVMes > 0 ? round1(((totalVMes - cogsMes) / totalVMes) * 100) : 0
      const tasaCobranza = totalVMes > 0 ? round1((totalCMes / totalVMes) * 100) : 0
      const clientesMesCount = new Set((vMes ?? []).map((v) => v.cliente_nombre).filter(Boolean)).size
      const ticketPromedio = clientesMesCount > 0 ? Math.round(totalVMes / clientesMesCount) : 0
      const crecimientoMensual = round1(pct(totalVMes, totalVMesAnt))

      // Evolución 6 meses
      const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
      const evoMap: Record<string, { ventas: number; cobros: number }> = {}
      for (const v of vSeis ?? []) {
        const key = v.fecha.substring(0, 7)
        if (!evoMap[key]) evoMap[key] = { ventas: 0, cobros: 0 }
        evoMap[key].ventas += (v.cantidad ?? 0) * (v.precio_unitario ?? 0)
      }
      for (const c of cSeis ?? []) {
        const key = c.fecha.substring(0, 7)
        if (!evoMap[key]) evoMap[key] = { ventas: 0, cobros: 0 }
        evoMap[key].cobros += (c.monto ?? 0)
      }
      const evolucionVentas = Object.entries(evoMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, data]) => ({
          mes: MESES[parseInt(key.split("-")[1]) - 1],
          ventas: Math.round(data.ventas),
          cobros: Math.round(data.cobros),
        }))

      // Distribución métodos de pago (en % del monto)
      const metodosMap: Record<string, number> = {}
      for (const c of cMes ?? []) {
        const metodo = c.metodo_pago
          ? c.metodo_pago.charAt(0).toUpperCase() + c.metodo_pago.slice(1)
          : "Otro"
        metodosMap[metodo] = (metodosMap[metodo] ?? 0) + (c.monto ?? 0)
      }
      const totalMetodos = Object.values(metodosMap).reduce((s, v) => s + v, 0)
      const distribucionMetodosPago = Object.entries(metodosMap).map(([name, value]) => ({
        name,
        value: totalMetodos > 0 ? Math.round((value / totalMetodos) * 100) : 0,
      }))

      // Rentabilidad por producto — costo = último precio de compra vigente en la fecha de cada venta
      const prodAgg: Record<string, { ingresos: number; costo: number }> = {}
      for (const v of vMes ?? []) {
        const nombre = v.producto_nombre || "Sin nombre"
        const qty = v.cantidad ?? 0
        const ing = qty * (v.precio_unitario ?? 0)
        const cost = qty * getCostAtDate(nombre, v.fecha, costTimeline)
        if (!prodAgg[nombre]) prodAgg[nombre] = { ingresos: 0, costo: 0 }
        prodAgg[nombre].ingresos += ing
        prodAgg[nombre].costo += cost
      }
      const rentabilidadProductos = Object.entries(prodAgg)
        .map(([producto, p]) => {
          const margen = p.ingresos > 0 ? round1(((p.ingresos - p.costo) / p.ingresos) * 100) : 0
          return { producto, ingresos: Math.round(p.ingresos), costo: Math.round(p.costo), margen }
        })
        .sort((a, b) => b.ingresos - a.ingresos)

      const mesLabel = d.now.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })

      // Por cliente: último precio de compra vigente en la fecha de cada venta
      const costoMap: Record<string, { cajones: number; totalVendido: number; costoVendido: number }> = {}
      for (const v of vMes ?? []) {
        if (!v.cantidad || v.cantidad <= 0) continue
        const nombre = v.cliente_nombre || "Sin nombre"
        const costUnit = getCostAtDate(v.producto_nombre ?? "", v.fecha, costTimeline)
        if (!costoMap[nombre]) costoMap[nombre] = { cajones: 0, totalVendido: 0, costoVendido: 0 }
        costoMap[nombre].cajones += v.cantidad
        costoMap[nombre].totalVendido += v.cantidad * (v.precio_unitario ?? 0)
        costoMap[nombre].costoVendido += v.cantidad * costUnit
      }
      const clientesMes = Object.entries(costoMap)
        .map(([nombre, d]) => {
          const costoVendido = Math.round(d.costoVendido)
          const totalVendido = Math.round(d.totalVendido)
          const ganancia = totalVendido - costoVendido
          const margen = totalVendido > 0 ? round1(((totalVendido - costoVendido) / totalVendido) * 100) : 0
          return {
            nombre,
            cajones: Math.round(d.cajones),
            totalVendido,
            costoVendido,
            ganancia,
            margen,
          }
        })
        .sort((a, b) => b.totalVendido - a.totalVendido)

      return NextResponse.json({
        mes: mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1),
        resumen: {
          ventas: Math.round(totalVMes),
          cobros: Math.round(totalCMes),
          gastos: Math.round(totalGMes),
          compras: Math.round(totalCompMes),
          cogs: Math.round(cogsMes),
          resultadoNeto: Math.round(resultadoNeto),
          margenNeto,
        },
        vs_mes_anterior: {
          ventas: round1(pct(totalVMes, totalVMesAnt)),
          cobros: round1(pct(totalCMes, totalCMesAnt)),
          resultado: round1(pct(resultadoNeto, resultadoNetoAnt)),
        },
        vs_mismo_mes_anio_anterior: {
          ventas: round1(pct(totalVMes, totalVMesAA)),
          cobros: round1(pct(totalCMes, totalCMesAA)),
          resultado: 0,
        },
        kpis: {
          ticketPromedio,
          tasaCobranza,
          margenBruto,
          margenNeto,
          crecimientoMensual,
        },
        evolucionVentas,
        topClientes: topClientes(vMes ?? [], 8),
        distribucionMetodosPago,
        rentabilidadProductos,
        clientesMes,
      })
    }

    return NextResponse.json({ error: "tipo inválido" }, { status: 400 })
  } catch (error) {
    console.error("[reportes/data]", error)
    return NextResponse.json({ error: "Error al obtener datos" }, { status: 500 })
  }
}
