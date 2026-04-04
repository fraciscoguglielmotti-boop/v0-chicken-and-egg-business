import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

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
      const [
        { data: vHoy },
        { data: vAyer },
        { data: cHoy },
        { data: cAyer },
        { data: gHoy },
      ] = await Promise.all([
        supabase.from("ventas").select("cliente_nombre,producto_nombre,cantidad,precio_unitario").eq("fecha", d.today),
        supabase.from("ventas").select("cantidad,precio_unitario").eq("fecha", d.yesterday),
        supabase.from("cobros").select("monto").eq("fecha", d.today),
        supabase.from("cobros").select("monto").eq("fecha", d.yesterday),
        supabase.from("gastos").select("monto").eq("fecha", d.today),
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
      const ticketPromedioDia = (vHoy?.length ?? 0) > 0 ? Math.round(totalVHoy / (vHoy?.length ?? 1)) : 0

      const { data: ventasRecientes } = await supabase
        .from("ventas")
        .select("cliente_nombre,fecha")
        .gte("fecha", toDateStr(addDays(d.now, -60)))
        .lte("fecha", d.today)

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
        .slice(0, 10)
        .map(([nombre, ultima]) => ({
          nombre,
          diasSinComprar: Math.floor((d.now.getTime() - new Date(ultima + "T12:00:00Z").getTime()) / 86400000),
        }))

      return NextResponse.json({
        fecha: fechaFmt.charAt(0).toUpperCase() + fechaFmt.slice(1),
        ventas: { hoy: Math.round(totalVHoy), ayer: Math.round(totalVAyer), delta: round1(pct(totalVHoy, totalVAyer)) },
        cobros: { hoy: Math.round(totalCHoy), ayer: Math.round(totalCAyer), delta: round1(pct(totalCHoy, totalCAyer)) },
        cajones: {
          hoy: cajonesHoy,
          ayer: cajonesAyer,
          delta: round1(pct(cajonesHoy, cajonesAyer)),
        },
        tasaCobranza: tasaCobranzaDia,
        pendiente: pendienteDia,
        ticketPromedio: ticketPromedioDia,
        topClientes: topClientes(vHoy ?? [], 3),
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

      const margenBruto = totalVSem > 0 ? round1(((totalVSem - totalCompSem) / totalVSem) * 100) : 0
      const tasaCobranza = totalVSem > 0 ? round1((totalCSem / totalVSem) * 100) : 0

      const startFmt = new Date(d.weekStart + "T12:00:00Z").toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "UTC" })
      const endFmt = new Date(d.weekEnd + "T12:00:00Z").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

      return NextResponse.json({
        semana: `Semana del ${startFmt} al ${endFmt}`,
        ventas: { semana: Math.round(totalVSem), anterior: Math.round(totalVAnt), delta: round1(pct(totalVSem, totalVAnt)) },
        cobros: { semana: Math.round(totalCSem), anterior: Math.round(totalCAnt), delta: round1(pct(totalCSem, totalCAnt)) },
        margenBruto,
        tasaCobranza,
        ventasPorDia,
        topClientes: topClientes(vSem ?? [], 5),
        productosMasVendidos: topProductos(vSem ?? [], 10),
        desglose: topProductos(vSem ?? [], 10),
        cajonesSemana: Math.round(sumCantidad(vSem ?? [])),
        cajonesAntSemana: Math.round(sumCantidad(vAntSem ?? [])),
        cuentasVencidas: 0,
        montoVencido: 0,
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
      const ticketPromedio = (vMes?.length ?? 0) > 0 ? Math.round(totalVMes / (vMes?.length ?? 1)) : 0
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

      // Rentabilidad por producto
      const vPorProd: Record<string, number> = {}
      for (const v of vMes ?? []) {
        const nombre = v.producto_nombre || "Sin nombre"
        vPorProd[nombre] = (vPorProd[nombre] ?? 0) + (v.cantidad ?? 0) * (v.precio_unitario ?? 0)
      }
      const cPorProd: Record<string, number> = {}
      for (const c of compMes ?? []) {
        const nombre = c.producto || "Sin nombre"
        cPorProd[nombre] = (cPorProd[nombre] ?? 0) + (c.total ?? (c.cantidad ?? 0) * (c.precio_unitario ?? 0))
      }
      const rentabilidadProductos = Object.entries(vPorProd)
        .map(([producto, ingresos]) => {
          const costo = cPorProd[producto] ?? 0
          const margen = ingresos > 0 ? round1(((ingresos - costo) / ingresos) * 100) : 0
          return { producto, ingresos: Math.round(ingresos), costo: Math.round(costo), margen }
        })
        .sort((a, b) => b.ingresos - a.ingresos)
        .slice(0, 6)

      const mesLabel = d.now.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })

      // Por cliente: cajones, total vendido, costo, ganancia
      // Costo = cantidad vendida × precio promedio de compra del producto
      const avgCostPorProducto: Record<string, number> = {}
      for (const [prod, ingreso] of Object.entries(vPorProd)) {
        const prodNorm = prod.toLowerCase().trim()
        // Buscar la compra del mes que coincida con el producto
        let totalCostComp = 0, totalQtyComp = 0
        for (const c of compMes ?? []) {
          const compProd = (c.producto ?? "").toLowerCase().trim()
          if (compProd.includes(prodNorm) || prodNorm.includes(compProd)) {
            const t = c.total > 0 ? c.total : (c.cantidad ?? 0) * (c.precio_unitario ?? 0)
            totalCostComp += t
            totalQtyComp += c.cantidad ?? 0
          }
        }
        avgCostPorProducto[prod] = totalQtyComp > 0 ? totalCostComp / totalQtyComp : 0
      }

      const clienteMap: Record<string, { cajones: number; totalVendido: number; costoVendido: number }> = {}
      for (const v of vMes ?? []) {
        const nombre = v.cliente_nombre || "Sin nombre"
        const prod = v.producto_nombre || "Sin producto"
        const qty = v.cantidad ?? 0
        const ingreso = qty * (v.precio_unitario ?? 0)
        const costo = qty * (avgCostPorProducto[prod] ?? 0)
        if (!clienteMap[nombre]) clienteMap[nombre] = { cajones: 0, totalVendido: 0, costoVendido: 0 }
        clienteMap[nombre].cajones += qty
        clienteMap[nombre].totalVendido += ingreso
        clienteMap[nombre].costoVendido += costo
      }
      const clientesMes = Object.entries(clienteMap)
        .map(([nombre, d]) => ({
          nombre,
          cajones: Math.round(d.cajones),
          totalVendido: Math.round(d.totalVendido),
          costoVendido: Math.round(d.costoVendido),
          ganancia: Math.round(d.totalVendido - d.costoVendido),
          margen: d.totalVendido > 0 ? round1(((d.totalVendido - d.costoVendido) / d.totalVendido) * 100) : 0,
        }))
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
