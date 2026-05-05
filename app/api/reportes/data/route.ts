import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// ─── Costo promedio por producto para reporte de clientes ────────────────────
// Usa costo promedio ponderado de compras históricas por producto.
// Match estricto (nombre normalizado): si no hay compra para ese producto, costo = 0.
// Esto evita asignar costos incorrectos cuando los nombres no coinciden exactamente.

function normProdName(s?: string) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "")
}

function fuzzyLookup(key: string, map: Record<string, number>): number {
  if (!key) return 0
  if (map[key] !== undefined) return map[key]
  for (const [k, v] of Object.entries(map)) {
    if (k.includes(key) || key.includes(k)) return v
  }
  return 0
}

function calcCostoPorCliente(
  todasCompras: { fecha: string; producto: string; total: number; cantidad: number; precio_unitario: number }[],
  ventasMes: { fecha: string; cliente_nombre: string; producto_nombre: string; cantidad: number; precio_unitario: number }[]
): Record<string, { cajones: number; totalVendido: number; costoVendido: number }> {
  // Costo promedio ponderado por producto (histórico hasta el mes)
  const costoPorProducto: Record<string, { totalCosto: number; totalQty: number }> = {}
  for (const c of todasCompras) {
    if (!c.cantidad || c.cantidad <= 0) continue
    const prod = normProdName(c.producto)
    if (!prod) continue
    const total = c.total > 0 ? c.total : c.cantidad * (c.precio_unitario ?? 0)
    if (!costoPorProducto[prod]) costoPorProducto[prod] = { totalCosto: 0, totalQty: 0 }
    costoPorProducto[prod].totalCosto += total
    costoPorProducto[prod].totalQty += c.cantidad
  }
  const avgCost: Record<string, number> = {}
  for (const [prod, d] of Object.entries(costoPorProducto)) {
    avgCost[prod] = d.totalQty > 0 ? d.totalCosto / d.totalQty : 0
  }

  // Acumular por cliente con fuzzy match en nombre de producto
  const result: Record<string, { cajones: number; totalVendido: number; costoVendido: number }> = {}
  for (const v of ventasMes) {
    if (!v.cantidad || v.cantidad <= 0) continue
    const nombre = v.cliente_nombre || "Sin nombre"
    const costUnit = fuzzyLookup(normProdName(v.producto_nombre), avgCost)
    if (!result[nombre]) result[nombre] = { cajones: 0, totalVendido: 0, costoVendido: 0 }
    result[nombre].cajones += v.cantidad
    result[nombre].totalVendido += v.cantidad * (v.precio_unitario ?? 0)
    result[nombre].costoVendido += v.cantidad * costUnit
  }
  return result
}

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
        supabase.from("compras").select("producto,cantidad,precio_unitario,total,fecha").gte("fecha", d60ago).lte("fecha", d.today),
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

      // ── Costos por producto (ÚLTIMO precio de compra) ─────────────────────
      // Normaliza nombre: minúsculas, sin acentos, sin ° ni símbolos, sólo letras/números
      const normP = (s: string) => (s ?? "")
        .toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]/g, "")
      const costoPorProd: Record<string, number> = {}
      const latestFecha: Record<string, string> = {}
      for (const c of comprasRecientes ?? []) {
        const key = normP(c.producto)
        if (!key) continue
        const fecha = c.fecha ?? ""
        if (!latestFecha[key] || fecha > latestFecha[key]) {
          const unitCost = ((c.total ?? 0) > 0 && (c.cantidad ?? 0) > 0)
            ? c.total / c.cantidad
            : (c.precio_unitario ?? 0)
          costoPorProd[key] = unitCost
          latestFecha[key] = fecha
        }
      }
      // Matching: primero exacto, después fuzzy (contains en cualquier dirección)
      const getCosto = (nombre: string) => {
        const key = normP(nombre)
        if (!key) return 0
        if (costoPorProd[key] !== undefined) return costoPorProd[key]
        for (const [k, v] of Object.entries(costoPorProd)) {
          if (k.includes(key) || key.includes(k)) return v
        }
        return 0
      }

      // ── Resumen de rentabilidad por producto ─────────────────────────────
      const prodMap: Record<string, { cajones: number; ingresos: number; costoTotal: number; precios: number[] }> = {}
      for (const v of vHoy ?? []) {
        const key = v.producto_nombre || "Sin nombre"
        if (!prodMap[key]) prodMap[key] = { cajones: 0, ingresos: 0, costoTotal: 0, precios: [] }
        const qty = v.cantidad ?? 0
        const pu = v.precio_unitario ?? 0
        prodMap[key].cajones += qty
        prodMap[key].ingresos += qty * pu
        prodMap[key].costoTotal += qty * getCosto(key)
        if (pu > 0) prodMap[key].precios.push(pu)
      }
      const costosProducto = Object.entries(prodMap)
        .sort((a, b) => b[1].ingresos - a[1].ingresos)
        .map(([producto, pd]) => {
          const costoUnitario = Math.round(getCosto(producto))
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
        const costoUnit = Math.round(getCosto(prod))
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
      const [
        { data: vSem },
        { data: vAntSem },
        { data: cSem },
        { data: cAntSem },
        { data: compSem },
      ] = await Promise.all([
        supabase.from("ventas").select("fecha,cliente_nombre,producto_nombre,cantidad,precio_unitario").gte("fecha", d.weekStart).lte("fecha", d.weekEnd),
        supabase.from("ventas").select("cantidad,precio_unitario").gte("fecha", d.lastWeekStart).lte("fecha", d.lastWeekEnd),
        supabase.from("cobros").select("fecha,monto").gte("fecha", d.weekStart).lte("fecha", d.weekEnd),
        supabase.from("cobros").select("monto").gte("fecha", d.lastWeekStart).lte("fecha", d.lastWeekEnd),
        supabase.from("compras").select("total,cantidad,precio_unitario").gte("fecha", d.weekStart).lte("fecha", d.weekEnd),
      ])

      const totalVSem = sumVentas(vSem ?? [])
      const totalVAnt = sumVentas(vAntSem ?? [])
      const totalCSem = sumMonto(cSem ?? [])
      const totalCAnt = sumMonto(cAntSem ?? [])
      const totalCompSem = sumTotal(compSem ?? [])

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

      return NextResponse.json({
        semana: `Semana del ${startFmt} al ${endFmt}`,
        ventas: { semana: Math.round(totalVSem), anterior: Math.round(totalVAnt), delta: round1(pct(totalVSem, totalVAnt)) },
        cobros: { semana: Math.round(totalCSem), anterior: Math.round(totalCAnt), delta: round1(pct(totalCSem, totalCAnt)) },
        cajonesSemana: Math.round(sumCantidad(vSem ?? [])),
        cajonesAntSemana: Math.round(sumCantidad(vAntSem ?? [])),
        clientesActivos,
        pendiente,
        ticketPromedioPorCliente,
        tasaCobranza,
        ventasPorDia,
        topClientes: topClientes(vSem ?? [], 5),
        desglose: topProductos(vSem ?? [], 10),
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
        supabase.from("ventas").select("cantidad,precio_unitario").gte("fecha", d.lastMonthStart).lte("fecha", d.lastMonthEnd),
        supabase.from("ventas").select("cantidad,precio_unitario").gte("fecha", d.sameMonthLastYearStart).lte("fecha", d.sameMonthLastYearEnd),
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
      const totalCompMesAnt = sumTotal(compMesAnt ?? [])

      const resultadoNeto = totalVMes - totalCompMes - totalGMes
      const resultadoNetoAnt = totalVMesAnt - totalCompMesAnt - totalGMesAnt
      const margenNeto = totalVMes > 0 ? round1((resultadoNeto / totalVMes) * 100) : 0
      const margenBruto = totalVMes > 0 ? round1(((totalVMes - totalCompMes) / totalVMes) * 100) : 0
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

      // Rentabilidad por producto — fuzzy match entre ventas y compras del mes
      const vPorProd: Record<string, number> = {}
      for (const v of vMes ?? []) {
        const nombre = v.producto_nombre || "Sin nombre"
        vPorProd[nombre] = (vPorProd[nombre] ?? 0) + (v.cantidad ?? 0) * (v.precio_unitario ?? 0)
      }
      const cPorProdNorm: Record<string, number> = {}
      for (const c of compMes ?? []) {
        const key = normProdName(c.producto)
        if (!key) continue
        cPorProdNorm[key] = (cPorProdNorm[key] ?? 0) + (c.total ?? (c.cantidad ?? 0) * (c.precio_unitario ?? 0))
      }
      const rentabilidadProductos = Object.entries(vPorProd)
        .map(([producto, ingresos]) => {
          const costo = fuzzyLookup(normProdName(producto), cPorProdNorm)
          const margen = ingresos > 0 ? round1(((ingresos - costo) / ingresos) * 100) : 0
          return { producto, ingresos: Math.round(ingresos), costo: Math.round(costo), margen }
        })
        .sort((a, b) => b.ingresos - a.ingresos)
        .slice(0, 6)

      const mesLabel = d.now.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })

      // Por cliente: costo promedio ponderado por producto (match estricto de nombre)
      const costoMap = calcCostoPorCliente(todasCompras ?? [], vMes ?? [])
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
