"use client"

import { Fragment, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Receipt,
  Package, Target, AlertTriangle, Users, FileDown, Clock, Award,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, Cell, PieChart, Pie, ResponsiveContainer, Tooltip, Legend,
} from "recharts"

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK = {
  fecha: "Miércoles, 23 de abril de 2026",
  kpis: {
    ventas: { hoy: 1_845_000, ayer: 1_620_000 },
    cobros: { hoy: 1_520_000, ayer: 1_430_000 },
    gananciaBruta: 412_500,
    margenBruto: 22.4,
    cajones: { hoy: 124, ayer: 108 },
  },
  costosProducto: [
    { producto: "Pollo A", costoUnitario: 8_200, precioPromedio: 10_500, cajones: 68, ingresos: 714_000, costoTotal: 557_600, ganancia: 156_400, margen: 21.9 },
    { producto: "Pollo B", costoUnitario: 6_800, precioPromedio: 8_900, cajones: 45, ingresos: 400_500, costoTotal: 306_000, ganancia: 94_500, margen: 23.6 },
    { producto: "Huevos Blancos", costoUnitario: 2_100, precioPromedio: 2_850, cajones: 8, ingresos: 22_800, costoTotal: 16_800, ganancia: 6_000, margen: 26.3 },
    { producto: "Patita pollo", costoUnitario: 1_400, precioPromedio: 2_000, cajones: 3, ingresos: 6_000, costoTotal: 4_200, ganancia: 1_800, margen: 30.0 },
  ],
  ventasDetalle: [
    { cliente: "Carnicería López", items: [
      { producto: "Pollo A", cantidad: 15, precioVenta: 10_500, costoUnitario: 8_200 },
      { producto: "Pollo B", cantidad: 8, precioVenta: 8_900, costoUnitario: 6_800 },
    ]},
    { cliente: "Super El Norte", items: [
      { producto: "Pollo A", cantidad: 22, precioVenta: 10_800, costoUnitario: 8_200 },
      { producto: "Huevos Blancos", cantidad: 5, precioVenta: 2_850, costoUnitario: 2_100 },
    ]},
    { cliente: "Dist. La Serenísima", items: [
      { producto: "Pollo A", cantidad: 18, precioVenta: 10_200, costoUnitario: 8_200 },
      { producto: "Pollo B", cantidad: 12, precioVenta: 8_900, costoUnitario: 6_800 },
    ]},
    { cliente: "Pollería El Chino", items: [
      { producto: "Pollo B", cantidad: 15, precioVenta: 9_000, costoUnitario: 6_800 },
      { producto: "Patita pollo", cantidad: 3, precioVenta: 2_000, costoUnitario: 1_400 },
    ]},
    { cliente: "Mini Mercado San Juan", items: [
      { producto: "Pollo A", cantidad: 13, precioVenta: 10_500, costoUnitario: 8_200 },
      { producto: "Huevos Blancos", cantidad: 3, precioVenta: 2_850, costoUnitario: 2_100 },
    ]},
  ],
  topClientes: [
    { nombre: "Super El Norte", monto: 251_850 },
    { nombre: "Dist. La Serenísima", monto: 290_400 },
    { nombre: "Carnicería López", monto: 228_700 },
    { nombre: "Pollería El Chino", monto: 141_000 },
    { nombre: "Mini Mercado San Juan", monto: 145_050 },
  ],
  mixProductos: [
    { name: "Pollo A", value: 714_000, color: "#f59e0b" },
    { name: "Pollo B", value: 400_500, color: "#3b82f6" },
    { name: "Huevos Blancos", value: 22_800, color: "#10b981" },
    { name: "Patita pollo", value: 6_000, color: "#8b5cf6" },
  ],
  clientesSinComprar: [
    { nombre: "Rosticería La Plaza", dias: 9 },
    { nombre: "Verdulería El Sol", dias: 11 },
    { nombre: "Mercadito Don Pepe", dias: 14 },
    { nombre: "Almacén La Esquina", dias: 18 },
    { nombre: "Carnicería Rossi", dias: 23 },
    { nombre: "Super 24hs", dias: 35 },
  ],
  gastos: 85_000,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n)

function Delta({ value, label }: { value: number; label: string }) {
  const pct = Math.round(((value - 0) / 1) * 10) / 10
  const isUp = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-emerald-600" : "text-red-600"}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? "+" : ""}{pct}% {label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PreviewDiario() {
  const pdfRef = useRef<HTMLDivElement>(null)
  const [generando, setGenerando] = useState(false)

  const deltaVentas = Math.round(((MOCK.kpis.ventas.hoy - MOCK.kpis.ventas.ayer) / MOCK.kpis.ventas.ayer) * 1000) / 10
  const deltaCobros = Math.round(((MOCK.kpis.cobros.hoy - MOCK.kpis.cobros.ayer) / MOCK.kpis.cobros.ayer) * 1000) / 10
  const deltaCajones = Math.round(((MOCK.kpis.cajones.hoy - MOCK.kpis.cajones.ayer) / MOCK.kpis.cajones.ayer) * 1000) / 10

  const descargarPDF = async () => {
    const target = pdfRef.current
    if (!target) return
    setGenerando(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")
      const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 794, logging: false })
      const imgData = canvas.toDataURL("image/jpeg", 0.92)
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgH = (canvas.height * pageW) / canvas.width
      let yRemaining = imgH
      let yOffset = 0
      pdf.addImage(imgData, "JPEG", 0, 0, pageW, imgH)
      yRemaining -= pageH
      while (yRemaining > 0) {
        yOffset -= pageH
        pdf.addPage()
        pdf.addImage(imgData, "JPEG", 0, yOffset, pageW, imgH)
        yRemaining -= pageH
      }
      pdf.save(`preview-diario.pdf`)
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between bg-background rounded-lg border p-3">
          <div>
            <h1 className="text-sm font-semibold">Preview — Reporte Diario (rediseñado)</h1>
            <p className="text-xs text-muted-foreground">Ejemplo con datos simulados · A4 portrait</p>
          </div>
          <Button size="sm" className="gap-2" onClick={descargarPDF} disabled={generando}>
            <FileDown className="h-4 w-4" />
            {generando ? "Generando…" : "Descargar PDF"}
          </Button>
        </div>

        {/* PDF content */}
        <div ref={pdfRef} className="bg-white text-slate-900 p-8 space-y-6" style={{ width: "794px", margin: "0 auto" }}>
          {/* Header */}
          <div className="flex items-end justify-between border-b-2 border-emerald-600 pb-3">
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">AviGest · Reporte Diario</p>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">{MOCK.fecha}</h1>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">Ganancia Bruta</p>
              <p className="text-2xl font-bold text-emerald-600">{fmt(MOCK.kpis.gananciaBruta)}</p>
              <p className="text-[11px] text-slate-600">Margen {MOCK.kpis.margenBruto}%</p>
            </div>
          </div>

          {/* ① KPI Bar */}
          <div className="grid grid-cols-5 gap-2">
            <KPI label="Ventas" value={fmt(MOCK.kpis.ventas.hoy)} delta={deltaVentas} icon={ShoppingCart} color="emerald" />
            <KPI label="Cobros" value={fmt(MOCK.kpis.cobros.hoy)} delta={deltaCobros} icon={Receipt} color="blue" />
            <KPI label="Ganancia" value={fmt(MOCK.kpis.gananciaBruta)} delta={null} icon={DollarSign} color="purple" highlight />
            <KPI label="Margen" value={`${MOCK.kpis.margenBruto}%`} delta={null} icon={Target} color="amber" />
            <KPI label="Cajones" value={MOCK.kpis.cajones.hoy.toString()} delta={deltaCajones} icon={Package} color="slate" />
          </div>

          {/* ② Rentabilidad por producto */}
          <Section title="Rentabilidad por Producto" icon={Award}>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-600">
                  <th className="text-left py-2 font-semibold">Producto</th>
                  <th className="text-right py-2 font-semibold">Costo unit.</th>
                  <th className="text-right py-2 font-semibold">P. venta prom.</th>
                  <th className="text-right py-2 font-semibold">Cajones</th>
                  <th className="text-right py-2 font-semibold">Ingresos</th>
                  <th className="text-right py-2 font-semibold">Costo total</th>
                  <th className="text-right py-2 font-semibold">Ganancia</th>
                  <th className="text-right py-2 font-semibold">Margen</th>
                </tr>
              </thead>
              <tbody>
                {MOCK.costosProducto.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 font-medium">{p.producto}</td>
                    <td className="text-right py-1.5 text-slate-600">{fmt(p.costoUnitario)}</td>
                    <td className="text-right py-1.5 text-slate-600">{fmt(p.precioPromedio)}</td>
                    <td className="text-right py-1.5">{p.cajones}</td>
                    <td className="text-right py-1.5">{fmt(p.ingresos)}</td>
                    <td className="text-right py-1.5 text-red-700">{fmt(p.costoTotal)}</td>
                    <td className="text-right py-1.5 font-semibold text-emerald-700">{fmt(p.ganancia)}</td>
                    <td className="text-right py-1.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        p.margen >= 25 ? "bg-emerald-100 text-emerald-800"
                          : p.margen >= 15 ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}>{p.margen}%</span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-2">Total</td>
                  <td className="text-right py-2">—</td>
                  <td className="text-right py-2">—</td>
                  <td className="text-right py-2">{MOCK.costosProducto.reduce((s, p) => s + p.cajones, 0)}</td>
                  <td className="text-right py-2">{fmt(MOCK.costosProducto.reduce((s, p) => s + p.ingresos, 0))}</td>
                  <td className="text-right py-2 text-red-700">{fmt(MOCK.costosProducto.reduce((s, p) => s + p.costoTotal, 0))}</td>
                  <td className="text-right py-2 text-emerald-700">{fmt(MOCK.costosProducto.reduce((s, p) => s + p.ganancia, 0))}</td>
                  <td className="text-right py-2">{MOCK.kpis.margenBruto}%</td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* ③ Detalle de ventas */}
          <Section title="Detalle de Ventas del Día" icon={Users}>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-600">
                  <th className="text-left py-2 font-semibold">Cliente / Producto</th>
                  <th className="text-right py-2 font-semibold">Cant.</th>
                  <th className="text-right py-2 font-semibold">P. venta</th>
                  <th className="text-right py-2 font-semibold">P. costo</th>
                  <th className="text-right py-2 font-semibold">Ingreso</th>
                  <th className="text-right py-2 font-semibold">Ganancia</th>
                  <th className="text-right py-2 font-semibold">Margen</th>
                </tr>
              </thead>
              <tbody>
                {MOCK.ventasDetalle.map((cl, i) => {
                  const totalCliente = cl.items.reduce((s, it) => s + it.cantidad * it.precioVenta, 0)
                  const gananciaCliente = cl.items.reduce((s, it) => s + it.cantidad * (it.precioVenta - it.costoUnitario), 0)
                  const margenCliente = Math.round((gananciaCliente / totalCliente) * 1000) / 10
                  return (
                    <Fragment key={i}>
                      <tr className="bg-slate-50">
                        <td colSpan={4} className="py-1.5 font-semibold text-slate-800">{cl.cliente}</td>
                        <td className="text-right py-1.5 font-semibold">{fmt(totalCliente)}</td>
                        <td className="text-right py-1.5 font-semibold text-emerald-700">{fmt(gananciaCliente)}</td>
                        <td className="text-right py-1.5 font-semibold">{margenCliente}%</td>
                      </tr>
                      {cl.items.map((it, j) => {
                        const ing = it.cantidad * it.precioVenta
                        const gan = it.cantidad * (it.precioVenta - it.costoUnitario)
                        const mar = Math.round((gan / ing) * 1000) / 10
                        return (
                          <tr key={j} className="border-b border-slate-100">
                            <td className="py-1 pl-4 text-slate-600">└ {it.producto}</td>
                            <td className="text-right py-1">{it.cantidad}</td>
                            <td className="text-right py-1">{fmt(it.precioVenta)}</td>
                            <td className="text-right py-1 text-slate-500">{fmt(it.costoUnitario)}</td>
                            <td className="text-right py-1">{fmt(ing)}</td>
                            <td className="text-right py-1 text-emerald-700">{fmt(gan)}</td>
                            <td className="text-right py-1 text-slate-600">{mar}%</td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </Section>

          {/* ④ Gráficos */}
          <div className="grid grid-cols-2 gap-4">
            <Section title="Top Clientes" icon={Award}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={MOCK.topClientes} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="nombre" tick={{ fontSize: 9 }} width={110} />
                  <Tooltip formatter={(v: any) => fmt(v as number)} />
                  <Bar dataKey="monto" fill="#059669" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Mix de Productos" icon={Package}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={MOCK.mixProductos} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                    {MOCK.mixProductos.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(v as number)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </Section>
          </div>

          {/* ⑤ Clientes sin comprar */}
          <Section title="Clientes Inactivos (>7 días)" icon={Clock}>
            <div className="grid grid-cols-2 gap-2">
              {MOCK.clientesSinComprar.map((c, i) => {
                const color = c.dias >= 30 ? "red" : c.dias >= 14 ? "amber" : "slate"
                return (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 border border-slate-200 rounded">
                    <span className="text-[11px] font-medium truncate">{c.nombre}</span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] h-5 ${
                        color === "red" ? "bg-red-100 text-red-800"
                        : color === "amber" ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {c.dias}d
                    </Badge>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Footer */}
          <div className="text-center pt-4 border-t border-slate-200">
            <p className="text-[10px] text-slate-400">Generado automáticamente por AviGest · {MOCK.fecha}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────

function KPI({
  label, value, delta, icon: Icon, color, highlight,
}: {
  label: string; value: string; delta: number | null
  icon: any; color: "emerald" | "blue" | "purple" | "amber" | "slate"; highlight?: boolean
}) {
  const bgMap = {
    emerald: "bg-emerald-50 border-emerald-200",
    blue: "bg-blue-50 border-blue-200",
    purple: "bg-purple-50 border-purple-200",
    amber: "bg-amber-50 border-amber-200",
    slate: "bg-slate-50 border-slate-200",
  }
  const txtMap = {
    emerald: "text-emerald-700",
    blue: "text-blue-700",
    purple: "text-purple-700",
    amber: "text-amber-700",
    slate: "text-slate-700",
  }
  return (
    <div className={`rounded-md border p-2.5 ${bgMap[color]} ${highlight ? "ring-2 ring-offset-1 ring-purple-300" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${txtMap[color]}`}>{label}</span>
        <Icon className={`h-3.5 w-3.5 ${txtMap[color]}`} />
      </div>
      <p className="text-base font-bold text-slate-900 leading-tight">{value}</p>
      {delta !== null && (
        <p className={`text-[10px] mt-0.5 font-medium ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {delta >= 0 ? "▲ +" : "▼ "}{delta}% vs ayer
        </p>
      )}
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">{title}</h3>
      </div>
      {children}
    </div>
  )
}
