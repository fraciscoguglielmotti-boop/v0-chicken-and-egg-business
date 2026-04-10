"use client"

import { useMemo, useState } from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, TrendingUp, ShoppingCart, DollarSign, Package, FileDown } from "lucide-react"

interface Venta {
  id: string
  fecha: string
  cliente_nombre: string
  producto_nombre?: string
  cantidad: number
  precio_unitario: number
  vendedor?: string
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
      {/* Filtros */}
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
    </div>
  )
}
