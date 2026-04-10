"use client"

import { useMemo, useState } from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronDown, ChevronUp, TrendingUp, ShoppingCart, DollarSign, Package, FileDown, AlertTriangle } from "lucide-react"

interface Venta {
  id: string
  fecha: string
  cliente_nombre: string
  producto_nombre?: string
  cantidad: number
  precio_unitario: number
  vendedor?: string
}

interface Compra {
  id: string
  fecha: string
  producto: string
  cantidad: number
}

interface DiaResumen {
  fecha: string
  ventas: Venta[]
  totalVentas: number
  cantidadOperaciones: number
  productosMas: { nombre: string; cantidad: number; total: number }[]
}

export function ResumenVentasContent() {
  const { data: ventas = [], isLoading } = useSupabase<Venta>("ventas")
  const { data: compras = [] } = useSupabase<Compra>("compras")

  const hoy = new Date()
  const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`
  const hoyStr = hoy.toISOString().split("T")[0]

  const [desde, setDesde] = useState(primerDiaMes)
  const [hasta, setHasta] = useState(hoyStr)
  const [expandido, setExpandido] = useState<string | null>(null)

  const resumenPorDia = useMemo<DiaResumen[]>(() => {
    const filtradas = ventas.filter(v => {
      const f = v.fecha.slice(0, 10)
      return (!desde || f >= desde) && (!hasta || f <= hasta)
    })

    const porDia = new Map<string, Venta[]>()
    filtradas.forEach(v => {
      const dia = v.fecha.slice(0, 10)
      if (!porDia.has(dia)) porDia.set(dia, [])
      porDia.get(dia)!.push(v)
    })

    return Array.from(porDia.entries())
      .sort(([a], [b]) => b.localeCompare(a)) // más reciente primero
      .map(([fecha, ventasDia]) => {
        const totalVentas = ventasDia.reduce((sum, v) => sum + v.cantidad * v.precio_unitario, 0)

        // Agrupar por producto
        const prodMap = new Map<string, { cantidad: number; total: number }>()
        ventasDia.forEach(v => {
          const nombre = v.producto_nombre || "Sin producto"
          const prev = prodMap.get(nombre) || { cantidad: 0, total: 0 }
          prodMap.set(nombre, {
            cantidad: prev.cantidad + v.cantidad,
            total: prev.total + v.cantidad * v.precio_unitario,
          })
        })
        const productosMas = Array.from(prodMap.entries())
          .map(([nombre, d]) => ({ nombre, ...d }))
          .sort((a, b) => b.total - a.total)

        return {
          fecha,
          ventas: ventasDia,
          totalVentas,
          cantidadOperaciones: ventasDia.length,
          productosMas,
        }
      })
  }, [ventas, desde, hasta])

  const totalesGlobales = useMemo(() => {
    const prodMap = new Map<string, { cantidad: number; total: number }>()
    resumenPorDia.forEach(dia => {
      dia.productosMas.forEach(p => {
        const prev = prodMap.get(p.nombre) || { cantidad: 0, total: 0 }
        prodMap.set(p.nombre, { cantidad: prev.cantidad + p.cantidad, total: prev.total + p.total })
      })
    })
    const cajonesPorProducto = Array.from(prodMap.entries())
      .map(([nombre, d]) => ({ nombre, ...d }))
      .sort((a, b) => b.cantidad - a.cantidad)

    const esPollo = (nombre: string) => nombre.toLowerCase().includes("pollo")
    const cajonesPollo = cajonesPorProducto
      .filter(p => esPollo(p.nombre))
      .reduce((s, p) => s + p.cantidad, 0)

    return {
      totalVentas: resumenPorDia.reduce((s, d) => s + d.totalVentas, 0),
      totalOperaciones: resumenPorDia.reduce((s, d) => s + d.cantidadOperaciones, 0),
      diasConVentas: resumenPorDia.length,
      cajonesPorProducto,
      cajonesPollo,
    }
  }, [resumenPorDia])

  const promediodiario = totalesGlobales.diasConVentas > 0
    ? totalesGlobales.totalVentas / totalesGlobales.diasConVentas
    : 0

  // Comparativo compras vs ventas por día y producto
  const comparativoPorDia = useMemo(() => {
    // Estructura: dia -> producto -> { comprado, vendido }
    const mapa = new Map<string, Map<string, { comprado: number; vendido: number }>>()

    const asegurar = (dia: string, producto: string) => {
      if (!mapa.has(dia)) mapa.set(dia, new Map())
      if (!mapa.get(dia)!.has(producto)) mapa.get(dia)!.set(producto, { comprado: 0, vendido: 0 })
      return mapa.get(dia)!.get(producto)!
    }

    compras.forEach(c => {
      const dia = c.fecha.slice(0, 10)
      if ((!desde || dia >= desde) && (!hasta || dia <= hasta)) {
        asegurar(dia, c.producto).comprado += c.cantidad
      }
    })

    ventas.forEach(v => {
      const dia = v.fecha.slice(0, 10)
      const prod = v.producto_nombre
      if (prod && (!desde || dia >= desde) && (!hasta || dia <= hasta)) {
        asegurar(dia, prod).vendido += v.cantidad
      }
    })

    // Aplanar en filas, ordenadas por fecha desc y producto asc
    const filas: { dia: string; producto: string; comprado: number; vendido: number; dif: number }[] = []
    Array.from(mapa.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([dia, productos]) => {
        Array.from(productos.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([producto, vals]) => {
            filas.push({ dia, producto, ...vals, dif: vals.comprado - vals.vendido })
          })
      })

    return filas
  }, [compras, ventas, desde, hasta])

  const totalDifComp = comparativoPorDia.reduce((s, r) => s + r.comprado, 0)
  const totalDifVent = comparativoPorDia.reduce((s, r) => s + r.vendido, 0)
  const diasConDif = new Set(comparativoPorDia.filter(r => r.dif !== 0).map(r => r.dia)).size

  const handleExportarPDF = async (dia: DiaResumen) => {
    const jsPDF = (await import("jspdf")).jsPDF
    const autoTable = (await import("jspdf-autotable")).default
    const doc = new jsPDF()

    const fechaLabel = new Date(dia.fecha + "T12:00:00").toLocaleDateString("es-AR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    })
    const fechaCapitalizada = fechaLabel.charAt(0).toUpperCase() + fechaLabel.slice(1)

    // ── Encabezado ──────────────────────────────────────────────────────────
    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(20, 20, 20)
    doc.text("AviGest — Resumen de ventas", 14, 18)

    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(90, 90, 90)
    doc.text(fechaCapitalizada, 14, 26)

    // Línea separadora
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(14, 30, 196, 30)

    // ── Bloque de KPIs ──────────────────────────────────────────────────────
    const totalCajones = dia.productosMas.reduce((s, p) => s + p.cantidad, 0)
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.setFont("helvetica", "normal")

    const kpis = [
      { label: "Total facturado", value: formatCurrency(dia.totalVentas) },
      { label: "Cajones vendidos", value: `${totalCajones}` },
      { label: "Operaciones", value: `${dia.cantidadOperaciones}` },
    ]
    let kx = 14
    kpis.forEach(k => {
      doc.setFont("helvetica", "normal")
      doc.setTextColor(110, 110, 110)
      doc.text(k.label, kx, 38)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(20, 20, 20)
      doc.setFontSize(13)
      doc.text(k.value, kx, 45)
      doc.setFontSize(9)
      kx += 62
    })

    let y = 54

    // ── Tabla 1: Resumen por producto ────────────────────────────────────────
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text("RESUMEN POR PRODUCTO", 14, y)
    y += 3

    const bodyProductos: any[] = dia.productosMas.map(p => [
      p.nombre,
      { content: p.cantidad.toString(), styles: { halign: "center" } },
      { content: formatCurrency(p.total / p.cantidad), styles: { halign: "right" } },
      { content: formatCurrency(p.total), styles: { halign: "right", fontStyle: "bold" } },
    ])
    bodyProductos.push([
      { content: "TOTAL", styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
      { content: totalCajones.toString(), styles: { halign: "center", fontStyle: "bold", fillColor: [235, 235, 235] } },
      { content: "", styles: { fillColor: [235, 235, 235] } },
      { content: formatCurrency(dia.totalVentas), styles: { halign: "right", fontStyle: "bold", fillColor: [235, 235, 235] } },
    ])

    autoTable(doc, {
      startY: y,
      head: [["Producto", "Cajones", "Precio unit.", "Total"]],
      body: bodyProductos,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: "center", cellWidth: 28 },
        2: { halign: "right", cellWidth: 38 },
        3: { halign: "right", cellWidth: 38, fontStyle: "bold" },
      },
    })

    y = (doc as any).lastAutoTable.finalY + 10

    // ── Tabla 2: Detalle por cliente ─────────────────────────────────────────
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text("DETALLE POR CLIENTE", 14, y)
    y += 3

    // Ordenar: primero por producto, luego por cliente A-Z
    const ventasOrdenadas = [...dia.ventas].sort((a, b) => {
      const prodCmp = (a.producto_nombre || "").localeCompare(b.producto_nombre || "", "es")
      if (prodCmp !== 0) return prodCmp
      return a.cliente_nombre.localeCompare(b.cliente_nombre, "es")
    })

    const bodyDetalle: any[] = ventasOrdenadas.map(v => [
      v.cliente_nombre,
      v.producto_nombre || "—",
      { content: v.cantidad.toString(), styles: { halign: "center" } },
      { content: formatCurrency(v.precio_unitario), styles: { halign: "right" } },
      { content: formatCurrency(v.cantidad * v.precio_unitario), styles: { halign: "right", fontStyle: "bold" } },
    ])
    bodyDetalle.push([
      { content: "TOTAL", styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
      { content: "", styles: { fillColor: [235, 235, 235] } },
      { content: totalCajones.toString(), styles: { halign: "center", fontStyle: "bold", fillColor: [235, 235, 235] } },
      { content: "", styles: { fillColor: [235, 235, 235] } },
      { content: formatCurrency(dia.totalVentas), styles: { halign: "right", fontStyle: "bold", fillColor: [235, 235, 235] } },
    ])

    autoTable(doc, {
      startY: y,
      head: [["Cliente", "Producto", "Cajones", "Precio unit.", "Total"]],
      body: bodyDetalle,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 45 },
        2: { halign: "center", cellWidth: 22 },
        3: { halign: "right", cellWidth: 30 },
        4: { halign: "right", cellWidth: 30, fontStyle: "bold" },
      },
    })

    // ── Pie de página ───────────────────────────────────────────────────────
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(160, 160, 160)
      doc.setFont("helvetica", "normal")
      doc.text(`AviGest · ${fechaCapitalizada}`, 14, 290)
      doc.text(`Pág. ${i} / ${pageCount}`, 190, 290, { align: "right" })
    }

    doc.save(`ventas-${dia.fecha}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Filtros — fuera de tabs para que apliquen a ambos */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label>Desde</Label>
          <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-auto" />
        </div>
        <div>
          <Label>Hasta</Label>
          <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-auto" />
        </div>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen de ventas</TabsTrigger>
          <TabsTrigger value="compras-vs-ventas" className="relative">
            Compras vs Ventas
            {diasConDif > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {diasConDif}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-6 mt-4">

      {/* KPIs del período */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5 border-primary/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Cajones pollo (A+B)</p>
              <p className="text-2xl font-bold text-primary">{totalesGlobales.cajonesPollo} caj.</p>
            </div>
            <Package className="h-7 w-7 text-primary" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total facturado</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalesGlobales.totalVentas)}</p>
            </div>
            <DollarSign className="h-7 w-7 text-green-600" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Operaciones</p>
              <p className="text-2xl font-bold">{totalesGlobales.totalOperaciones}</p>
            </div>
            <ShoppingCart className="h-7 w-7 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Días con ventas</p>
              <p className="text-2xl font-bold">{totalesGlobales.diasConVentas}</p>
            </div>
            <TrendingUp className="h-7 w-7 text-muted-foreground" />
          </div>
        </Card>
      </div>

      {/* Cajones por producto */}
      {totalesGlobales.cajonesPorProducto.length > 0 && (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Cajones vendidos por producto</p>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {totalesGlobales.cajonesPorProducto.map(p => (
              <div key={p.nombre} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm font-medium">{p.nombre}</span>
                <Badge variant="secondary">{p.cantidad} caj.</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Lista por día */}
      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
        {!isLoading && resumenPorDia.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay ventas en el período seleccionado.</p>
        )}
        {resumenPorDia.map(dia => {
          const abierto = expandido === dia.fecha
          return (
            <Card key={dia.fecha} className="overflow-hidden">
              {/* Encabezado del día */}
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                onClick={() => setExpandido(abierto ? null : dia.fecha)}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="font-semibold">
                    {formatDate(new Date(dia.fecha + "T12:00:00"))}
                  </span>
                  <Badge variant="outline">{dia.cantidadOperaciones} {dia.cantidadOperaciones === 1 ? "venta" : "ventas"}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {dia.productosMas.map(p => p.nombre).join(", ")}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="font-bold text-green-600">{formatCurrency(dia.totalVentas)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    title="Exportar PDF"
                    onClick={e => { e.stopPropagation(); handleExportarPDF(dia) }}
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
                  {abierto
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </button>

              {/* Detalle expandible */}
              {abierto && (
                <div className="border-t px-4 pb-4 pt-3 space-y-4">
                  {/* Resumen por producto */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Por producto</p>
                    <div className="space-y-1">
                      {dia.productosMas.map(p => (
                        <div key={p.nombre} className="flex justify-between text-sm">
                          <span>{p.nombre} <span className="text-muted-foreground">× {p.cantidad}</span></span>
                          <span className="font-medium">{formatCurrency(p.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Detalle de cada venta */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Detalle</p>
                    <div className="space-y-1">
                      {dia.ventas.map(v => (
                        <div key={v.id} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                          <div className="flex flex-col">
                            <span className="font-medium">{v.cliente_nombre}</span>
                            <span className="text-muted-foreground text-xs">
                              {v.producto_nombre || "—"} × {v.cantidad}
                              {v.vendedor ? ` · ${v.vendedor}` : ""}
                            </span>
                          </div>
                          <span className="font-medium">{formatCurrency(v.cantidad * v.precio_unitario)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

        </TabsContent>

        {/* ── COMPRAS VS VENTAS ─────────────────────────────────────────────── */}
        <TabsContent value="compras-vs-ventas" className="mt-4 space-y-4">

          {/* Totales del período */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total comprado</p>
              <p className="text-2xl font-bold text-green-700">{totalDifComp} caj.</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total vendido</p>
              <p className="text-2xl font-bold text-blue-600">{totalDifVent} caj.</p>
            </Card>
            <Card className={`p-4 ${totalDifComp - totalDifVent !== 0 ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}`}>
              <p className="text-xs text-muted-foreground">Diferencia acumulada</p>
              <p className={`text-2xl font-bold ${totalDifComp - totalDifVent !== 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                {totalDifComp - totalDifVent > 0 ? "+" : ""}{totalDifComp - totalDifVent} caj.
              </p>
            </Card>
          </div>

          {/* Tabla */}
          {comparativoPorDia.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sin datos en el período seleccionado.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-semibold">Fecha</th>
                    <th className="p-3 text-left font-semibold">Producto</th>
                    <th className="p-3 text-right font-semibold text-green-700">Comprado</th>
                    <th className="p-3 text-right font-semibold text-blue-600">Vendido</th>
                    <th className="p-3 text-right font-semibold">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativoPorDia.map((r, i) => (
                    <tr
                      key={i}
                      className={`border-t ${
                        r.dif > 0 ? "bg-amber-50 dark:bg-amber-950/20" :
                        r.dif < 0 ? "bg-red-50 dark:bg-red-950/20" :
                        "hover:bg-muted/20"
                      }`}
                    >
                      <td className="p-3 font-medium">
                        {formatDate(new Date(r.dia + "T12:00:00"))}
                      </td>
                      <td className="p-3">{r.producto}</td>
                      <td className="p-3 text-right font-medium text-green-700">
                        {r.comprado > 0 ? r.comprado : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 text-right font-medium text-blue-600">
                        {r.vendido > 0 ? r.vendido : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 text-right">
                        {r.dif === 0 ? (
                          <span className="text-muted-foreground text-xs">ok</span>
                        ) : (
                          <span className={`font-bold flex items-center justify-end gap-1 ${r.dif > 0 ? "text-amber-600" : "text-red-600"}`}>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {r.dif > 0 ? "+" : ""}{r.dif}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            <span className="text-amber-600 font-medium">Amarillo</span>: se compró más de lo que se vendió ese día (stock sobrante).{" "}
            <span className="text-red-600 font-medium">Rojo</span>: se vendió más de lo que se compró (posible error de carga).
          </p>
        </TabsContent>

      </Tabs>
    </div>
  )
}
