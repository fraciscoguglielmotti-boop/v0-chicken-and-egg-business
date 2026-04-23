"use client"

import { Fragment, useEffect, useRef, useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Receipt,
  Users,
  Package,
  Mail,
  Calendar,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  FileDown,
  Loader2,
  Clock,
  Target,
  Award,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"]

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DesgloseProd {
  producto: string
  unidades: number
  ingresos: number
}

interface CostoProducto {
  producto: string
  costoUnitario: number
  precioPromedio: number
  cajones: number
  ingresos: number
  costoTotal: number
  ganancia: number
  margen: number
}

interface VentaClienteItem {
  producto: string
  cantidad: number
  precioVenta: number
  costoUnitario: number
}

interface DatosDiarios {
  fecha: string
  ventas: { hoy: number; ayer: number; delta: number }
  cobros: { hoy: number; ayer: number; delta: number }
  cajones: { hoy: number; ayer: number; delta: number }
  tasaCobranza: number
  pendiente: number
  ticketPromedio: number
  gananciaBruta: number
  margenBruto: number
  costosProducto: CostoProducto[]
  ventasDetalle: { cliente: string; items: VentaClienteItem[] }[]
  topClientes: { nombre: string; monto: number }[]
  desglose: DesgloseProd[]
  gastos: number
  clientesSinComprar: { nombre: string; diasSinComprar: number }[]
}

interface DatosSemanales {
  semana: string
  ventas: { semana: number; anterior: number; delta: number }
  cobros: { semana: number; anterior: number; delta: number }
  cajonesSemana: number
  cajonesAntSemana: number
  clientesActivos: number
  pendiente: number
  ticketPromedioPorCliente: number
  tasaCobranza: number
  ventasPorDia: { dia: string; ventas: number; cobros: number }[]
  topClientes: { nombre: string; monto: number }[]
  desglose: DesgloseProd[]
}

interface DatosMensuales {
  mes: string
  resumen: {
    ventas: number
    cobros: number
    gastos: number
    compras: number
    resultadoNeto: number
    margenNeto: number
  }
  vs_mes_anterior: { ventas: number; cobros: number; resultado: number }
  vs_mismo_mes_anio_anterior: { ventas: number; cobros: number; resultado: number }
  kpis: {
    ticketPromedio: number
    tasaCobranza: number
    margenBruto: number
    margenNeto: number
    crecimientoMensual: number
  }
  evolucionVentas: { mes: string; ventas: number; cobros: number }[]
  topClientes: { nombre: string; monto: number }[]
  distribucionMetodosPago: { name: string; value: number }[]
  rentabilidadProductos: { producto: string; ingresos: number; costo: number; margen: number }[]
  clientesMes: { nombre: string; cajones: number; totalVendido: number; costoVendido: number; ganancia: number; margen: number }[]
}

// ─── Tooltip dark-mode ────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-card-foreground">
      {label && <p className="text-xs font-semibold mb-1.5">{label}</p>}
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-xs flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Componentes reutilizables ────────────────────────────────────────────────

function MetricCard({ title, value, delta, deltaLabel, icon: Icon, note }: {
  title: string; value: string | number; delta?: number; deltaLabel?: string; icon: React.ElementType; note?: string
}) {
  const positivo = delta !== undefined && delta >= 0
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {typeof value === "number" ? formatCurrency(value) : value}
        </div>
        {delta !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${positivo ? "text-green-600" : "text-red-600"}`}>
            {positivo ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            <span>{positivo ? "+" : ""}{delta.toFixed(1)}% {deltaLabel}</span>
          </div>
        )}
        {note && <p className="mt-1 text-xs text-amber-600">{note}</p>}
      </CardContent>
    </Card>
  )
}

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2"><Skeleton className="h-4 w-28" /></CardHeader>
      <CardContent><Skeleton className="h-8 w-36 mb-2" /><Skeleton className="h-3 w-20" /></CardContent>
    </Card>
  )
}

function DesgloseCard({ desglose }: { desglose: DesgloseProd[] }) {
  if (!desglose?.length) return null
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          Desglose por Producto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {desglose.map((p) => (
            <div key={p.producto} className="flex items-center justify-between text-sm">
              <span className="truncate">{p.producto}</span>
              <div className="flex items-center gap-3 shrink-0">
                <Badge variant="secondary" className="text-xs font-normal">
                  {p.unidades.toLocaleString("es-AR")} u.
                </Badge>
                <span className="font-semibold w-24 text-right">{formatCurrency(p.ingresos)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ReportHeader({ titulo, subtitulo, tipo, datos, pdfRef, printRef }: {
  titulo: string; subtitulo: string; tipo: string; datos: any
  pdfRef: React.RefObject<HTMLDivElement | null>
  printRef?: React.RefObject<HTMLDivElement | null>
}) {
  const { toast } = useToast()
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [enviandoEmail, setEnviandoEmail] = useState(false)

  const generarPDF = async () => {
    const target = printRef?.current ?? pdfRef.current
    if (!target) return
    setGenerandoPDF(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
        logging: false,
      })

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

      pdf.save(`reporte-${tipo}-${new Date().toISOString().split("T")[0]}.pdf`)
      toast({ title: "PDF generado", description: "El reporte se descargó correctamente." })
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "No se pudo generar el PDF.", variant: "destructive" })
    } finally {
      setGenerandoPDF(false)
    }
  }

  const enviarEmail = async () => {
    setEnviandoEmail(true)
    try {
      const res = await fetch("/api/reportes/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, datos }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? "Error desconocido")
      }
      const json = await res.json()
      toast({ title: "Email enviado", description: "El reporte fue enviado a tu casilla." })
    } catch (err) {
      toast({ title: "Error al enviar", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setEnviandoEmail(false)
    }
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{subtitulo}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" className="gap-2" onClick={generarPDF} disabled={generandoPDF || !datos}>
          {generandoPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          PDF
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={enviarEmail} disabled={enviandoEmail || !datos}>
          {enviandoEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Email
        </Button>
      </div>
    </div>
  )
}

// ─── PDF Templates (white, professional) ─────────────────────────────────────

const S = {
  page: { backgroundColor: "#ffffff", color: "#111827", fontFamily: "Arial, sans-serif", padding: "32px 40px", width: "794px", boxSizing: "border-box" as const },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", paddingBottom: "16px", borderBottom: "2px solid #111827" },
  logoName: { fontSize: "22px", fontWeight: "800", letterSpacing: "-0.5px", color: "#111827" },
  logoSub: { fontSize: "11px", color: "#6b7280", marginTop: "2px" },
  reportTitle: { textAlign: "right" as const },
  reportTitleText: { fontSize: "15px", fontWeight: "700", color: "#111827" },
  reportDate: { fontSize: "11px", color: "#6b7280", marginTop: "3px" },
  sectionTitle: { fontSize: "10px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "8px", marginTop: "20px" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "4px" },
  kpiBox: { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "14px 16px" },
  kpiLabel: { fontSize: "10px", color: "#6b7280", marginBottom: "4px" },
  kpiValue: { fontSize: "20px", fontWeight: "700", color: "#111827" },
  kpiDelta: (pos: boolean) => ({ fontSize: "10px", fontWeight: "600", color: pos ? "#16a34a" : "#dc2626", marginTop: "3px" }),
  indRow: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6", fontSize: "12px" },
  indLabel: { color: "#374151" },
  indValue: { fontWeight: "600", color: "#111827" },
  tableHead: { display: "flex", padding: "6px 0", fontSize: "10px", fontWeight: "700", color: "#6b7280", borderBottom: "1px solid #d1d5db", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  tableRow: { display: "flex", padding: "7px 0", fontSize: "12px", borderBottom: "1px solid #f3f4f6", alignItems: "center" },
  rankBadge: (i: number) => ({ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: i === 0 ? "#111827" : i === 1 ? "#374151" : "#6b7280", color: "white", fontSize: "10px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "10px", flexShrink: 0 }),
  footer: { marginTop: "32px", paddingTop: "12px", borderTop: "1px solid #e5e7eb", fontSize: "10px", color: "#9ca3af", display: "flex", justifyContent: "space-between" },
}

function PdfTemplateDiario({ data }: { data: DatosDiarios }) {
  const th: React.CSSProperties = { textAlign: "right", fontSize: "9px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", padding: "5px 4px", borderBottom: "2px solid #d1d5db" }
  const td: React.CSSProperties = { textAlign: "right", fontSize: "11px", padding: "5px 4px", borderBottom: "1px solid #f3f4f6" }
  const tdL: React.CSSProperties = { ...td, textAlign: "left" }
  const green: React.CSSProperties = { color: "#16a34a", fontWeight: 600 }
  const red: React.CSSProperties = { color: "#dc2626" }
  const pill = (margen: number): React.CSSProperties => ({
    display: "inline-block", padding: "2px 8px", borderRadius: "9999px", fontSize: "10px", fontWeight: 700,
    whiteSpace: "nowrap", minWidth: "44px", textAlign: "center",
    backgroundColor: margen >= 25 ? "#dcfce7" : margen >= 15 ? "#fef9c3" : "#fee2e2",
    color: margen >= 25 ? "#166534" : margen >= 15 ? "#854d0e" : "#991b1b",
  })

  return (
    <div style={{ ...S.page, padding: "56px 56px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "3px solid #16a34a", paddingBottom: "12px", marginBottom: "20px" }}>
        <div>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>AviGest · Reporte Diario</div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "#111827", marginTop: "2px" }}>{data.fecha}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ganancia Bruta</div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#16a34a" }}>{formatCurrency(data.gananciaBruta)}</div>
          <div style={{ fontSize: "10px", color: "#374151" }}>Margen {data.margenBruto}%</div>
        </div>
      </div>

      {/* KPI Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px", marginBottom: "20px" }}>
        {[
          { label: "Ventas", value: formatCurrency(data.ventas.hoy), delta: data.ventas.delta, bg: "#f0fdf4" },
          { label: "Cobros", value: formatCurrency(data.cobros.hoy), delta: data.cobros.delta, bg: "#eff6ff" },
          { label: "Ganancia", value: formatCurrency(data.gananciaBruta), delta: null, bg: "#faf5ff" },
          { label: "Margen", value: `${data.margenBruto}%`, delta: null, bg: "#fffbeb" },
          { label: "Cajones", value: `${data.cajones.hoy}`, delta: data.cajones.delta, bg: "#f8fafc" },
        ].map((k) => (
          <div key={k.label} style={{ backgroundColor: k.bg, borderRadius: "6px", padding: "10px", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "9px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#111827", marginTop: "2px" }}>{k.value}</div>
            {k.delta !== null && (
              <div style={{ fontSize: "9px", fontWeight: 600, color: k.delta >= 0 ? "#16a34a" : "#dc2626", marginTop: "2px" }}>
                {k.delta >= 0 ? "▲ +" : "▼ "}{k.delta}% vs ayer
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rentabilidad por producto */}
      {(data.costosProducto?.length ?? 0) > 0 && (
        <>
          <div style={S.sectionTitle}>Rentabilidad por Producto</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Producto</th>
                <th style={th}>Costo unit.</th>
                <th style={th}>P. venta</th>
                <th style={th}>Cajones</th>
                <th style={th}>Ingresos</th>
                <th style={th}>Costo total</th>
                <th style={th}>Ganancia</th>
                <th style={th}>Margen</th>
              </tr>
            </thead>
            <tbody>
              {data.costosProducto.map((p) => (
                <tr key={p.producto}>
                  <td style={tdL}>{p.producto}</td>
                  <td style={td}>{formatCurrency(p.costoUnitario)}</td>
                  <td style={td}>{formatCurrency(p.precioPromedio)}</td>
                  <td style={td}>{p.cajones}</td>
                  <td style={td}>{formatCurrency(p.ingresos)}</td>
                  <td style={{ ...td, ...red }}>{formatCurrency(p.costoTotal)}</td>
                  <td style={{ ...td, ...green }}>{formatCurrency(p.ganancia)}</td>
                  <td style={td}><span style={pill(p.margen)}>{p.margen}%</span></td>
                </tr>
              ))}
              <tr style={{ backgroundColor: "#f9fafb" }}>
                <td style={{ ...tdL, fontWeight: 700 }}>Total</td>
                <td style={td}>—</td>
                <td style={td}>—</td>
                <td style={{ ...td, fontWeight: 700 }}>{data.costosProducto.reduce((s, p) => s + p.cajones, 0)}</td>
                <td style={{ ...td, fontWeight: 700 }}>{formatCurrency(data.ventas.hoy)}</td>
                <td style={{ ...td, ...red, fontWeight: 700 }}>{formatCurrency(data.costosProducto.reduce((s, p) => s + p.costoTotal, 0))}</td>
                <td style={{ ...td, ...green, fontWeight: 700 }}>{formatCurrency(data.gananciaBruta)}</td>
                <td style={td}><span style={pill(data.margenBruto)}>{data.margenBruto}%</span></td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Detalle de ventas */}
      {(data.ventasDetalle?.length ?? 0) > 0 && (
        <>
          <div style={S.sectionTitle}>Detalle de Ventas por Cliente</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Cliente / Producto</th>
                <th style={th}>Cant.</th>
                <th style={th}>P. venta</th>
                <th style={th}>P. costo</th>
                <th style={th}>Ingreso</th>
                <th style={th}>Ganancia</th>
                <th style={th}>Margen</th>
              </tr>
            </thead>
            <tbody>
              {data.ventasDetalle.map((cl) => {
                const totalCl = cl.items.reduce((s, i) => s + i.cantidad * i.precioVenta, 0)
                const ganCl = cl.items.reduce((s, i) => s + i.cantidad * (i.precioVenta - i.costoUnitario), 0)
                const marCl = totalCl > 0 ? Math.round((ganCl / totalCl) * 1000) / 10 : 0
                return (
                  <Fragment key={cl.cliente}>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <td colSpan={4} style={{ ...tdL, fontWeight: 700, fontSize: "12px" }}>{cl.cliente}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{formatCurrency(totalCl)}</td>
                      <td style={{ ...td, ...green, fontWeight: 700 }}>{formatCurrency(ganCl)}</td>
                      <td style={td}>{marCl}%</td>
                    </tr>
                    {cl.items.map((it, j) => {
                      const ing = it.cantidad * it.precioVenta
                      const gan = it.cantidad * (it.precioVenta - it.costoUnitario)
                      const mar = ing > 0 ? Math.round((gan / ing) * 1000) / 10 : 0
                      return (
                        <tr key={j}>
                          <td style={{ ...tdL, paddingLeft: "14px", color: "#6b7280" }}>└ {it.producto}</td>
                          <td style={td}>{it.cantidad}</td>
                          <td style={td}>{formatCurrency(it.precioVenta)}</td>
                          <td style={{ ...td, color: "#6b7280" }}>{formatCurrency(it.costoUnitario)}</td>
                          <td style={td}>{formatCurrency(ing)}</td>
                          <td style={{ ...td, ...green }}>{formatCurrency(gan)}</td>
                          <td style={td}>{mar}%</td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      {/* Clientes inactivos */}
      {(data.clientesSinComprar?.length ?? 0) > 0 && (
        <>
          <div style={S.sectionTitle}>Clientes Inactivos (+7 días sin comprar)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", marginBottom: "16px" }}>
            {data.clientesSinComprar.map((c) => {
              const color = c.diasSinComprar >= 30 ? { bg: "#fee2e2", text: "#991b1b" } : c.diasSinComprar >= 14 ? { bg: "#fef9c3", text: "#854d0e" } : { bg: "#f1f5f9", text: "#475569" }
              return (
                <div key={c.nombre} style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", border: "1px solid #e5e7eb", borderRadius: "4px", fontSize: "10px" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: "6px" }}>{c.nombre}</span>
                  <span style={{ ...color, padding: "1px 6px", borderRadius: "9999px", fontWeight: 700, fontSize: "9px", flexShrink: 0, backgroundColor: color.bg }}>{c.diasSinComprar}d</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Indicadores de cobro */}
      <div style={S.sectionTitle}>Indicadores de Cobro</div>
      {[
        { label: "Tasa de cobranza", value: `${data.tasaCobranza}%${data.tasaCobranza > 100 ? " *" : ""}` },
        { label: "Pendiente de cobro", value: formatCurrency(data.pendiente) },
        { label: "Ticket promedio por cliente", value: formatCurrency(data.ticketPromedio) },
        { label: "Gastos del día", value: formatCurrency(data.gastos) },
      ].map((r) => (
        <div key={r.label} style={S.indRow}>
          <span style={S.indLabel}>{r.label}</span>
          <span style={S.indValue}>{r.value}</span>
        </div>
      ))}
      {data.tasaCobranza > 100 && (
        <div style={{ fontSize: "9px", color: "#d97706", marginTop: "4px" }}>* Tasa &gt;100%: incluye cobros de meses anteriores</div>
      )}

      <div style={S.footer}>
        <span>Generado por Francisco Guglielmotti (francisco@fdavicola.com.ar)</span>
        <span>{data.fecha}</span>
      </div>
    </div>
  )
}

function PdfTemplateSemanal({ data }: { data: DatosSemanales }) {
  const today = new Date().toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })
  const cajonesAntDelta = data.cajonesAntSemana > 0
    ? Math.round(((data.cajonesSemana - data.cajonesAntSemana) / data.cajonesAntSemana) * 100)
    : 0
  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.logoName}>AviGest</div>
          <div style={S.logoSub}>Distribuidora Avícola</div>
        </div>
        <div style={S.reportTitle}>
          <div style={S.reportTitleText}>Reporte Semanal</div>
          <div style={S.reportDate}>{data.semana}</div>
        </div>
      </div>

      <div style={S.sectionTitle}>Resultados de la Semana</div>
      <div style={S.kpiGrid}>
        {[
          { label: "Ventas Totales", value: formatCurrency(data.ventas.semana), delta: data.ventas.delta },
          { label: "Cobros Totales", value: formatCurrency(data.cobros.semana), delta: data.cobros.delta },
          { label: "Pendiente de Cobro", value: formatCurrency(data.pendiente), delta: null },
        ].map((k) => (
          <div key={k.label} style={S.kpiBox}>
            <div style={S.kpiLabel}>{k.label}</div>
            <div style={S.kpiValue}>{k.value}</div>
            {k.delta !== null && (
              <div style={S.kpiDelta(k.delta >= 0)}>{k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta)}% vs semana ant.</div>
            )}
          </div>
        ))}
      </div>
      <div style={{ ...S.kpiGrid, marginTop: "12px" }}>
        {[
          { label: "Cajones Vendidos", value: `${data.cajonesSemana} caj.`, delta: cajonesAntDelta },
          { label: "Clientes Activos", value: `${data.clientesActivos} clientes`, delta: null },
          { label: "Ticket Prom. por Cliente", value: formatCurrency(data.ticketPromedioPorCliente), delta: null },
        ].map((k) => (
          <div key={k.label} style={S.kpiBox}>
            <div style={S.kpiLabel}>{k.label}</div>
            <div style={S.kpiValue}>{k.value}</div>
            {k.delta !== null && (
              <div style={S.kpiDelta(k.delta >= 0)}>{k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta)}% vs semana ant.</div>
            )}
          </div>
        ))}
      </div>

      <div style={S.sectionTitle}>Indicadores de Cobro</div>
      {[
        { label: "Tasa de cobranza (semana)", value: `${data.tasaCobranza}%` },
        { label: "Pendiente de cobro", value: formatCurrency(data.pendiente) },
      ].map((r) => (
        <div key={r.label} style={S.indRow}>
          <span style={S.indLabel}>{r.label}</span>
          <span style={S.indValue}>{r.value}</span>
        </div>
      ))}
      {data.tasaCobranza > 100 && (
        <div style={{ fontSize: "9px", color: "#d97706", marginTop: "4px" }}>* Tasa &gt;100%: incluye cobros de meses anteriores</div>
      )}

      {data.desglose?.length > 0 && (
        <>
          <div style={S.sectionTitle}>Desglose por Producto</div>
          <div style={S.tableHead}>
            <span style={{ flex: 1 }}>Producto</span>
            <span style={{ width: "80px", textAlign: "center" }}>Cajones</span>
            <span style={{ width: "120px", textAlign: "right" }}>Ingresos</span>
          </div>
          {data.desglose.map((p) => (
            <div key={p.producto} style={S.tableRow}>
              <span style={{ flex: 1 }}>{p.producto}</span>
              <span style={{ width: "80px", textAlign: "center", color: "#6b7280" }}>{p.unidades}</span>
              <span style={{ width: "120px", textAlign: "right", fontWeight: "600" }}>{formatCurrency(p.ingresos)}</span>
            </div>
          ))}
        </>
      )}

      {data.topClientes?.length > 0 && (
        <>
          <div style={S.sectionTitle}>Top 5 Clientes</div>
          {data.topClientes.map((c, i) => (
            <div key={c.nombre} style={S.tableRow}>
              <div style={S.rankBadge(i)}>{i + 1}</div>
              <span style={{ flex: 1 }}>{c.nombre}</span>
              <span style={{ fontWeight: "600" }}>{formatCurrency(c.monto)}</span>
            </div>
          ))}
        </>
      )}

      <div style={S.footer}>
        <span>Generado por AviGest</span>
        <span>{today}</span>
      </div>
    </div>
  )
}

function PdfTemplateMensual({ data }: { data: DatosMensuales }) {
  const today = new Date().toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })
  const navy = "#1e3a5f"
  const totalVendido = data.clientesMes?.reduce((s, c) => s + c.totalVendido, 0) ?? 0
  const totalCosto   = data.clientesMes?.reduce((s, c) => s + c.costoVendido, 0) ?? 0
  const totalGanancia = data.clientesMes?.reduce((s, c) => s + c.ganancia, 0) ?? 0
  const totalCajones = data.clientesMes?.reduce((s, c) => s + c.cajones, 0) ?? 0
  const totalMargen  = totalVendido > 0 ? ((totalGanancia / totalVendido) * 100).toFixed(1) : "0.0"

  const thStyle: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontSize: "9.5px", fontWeight: "700", letterSpacing: "0.06em", color: "#fff", background: navy }
  const thR: React.CSSProperties = { ...thStyle, textAlign: "right" }
  const tdStyle: React.CSSProperties = { padding: "7px 10px", fontSize: "10.5px", color: "#1e293b", verticalAlign: "middle" }
  const tdR: React.CSSProperties = { ...tdStyle, textAlign: "right" }
  const tfStyle: React.CSSProperties = { padding: "8px 10px", fontSize: "10.5px", fontWeight: "700", color: "#fff", background: navy }
  const tfR: React.CSSProperties = { ...tfStyle, textAlign: "right" }

  return (
    <div style={{ ...S.page, padding: "36px 44px" }}>
      {/* Barra superior de color */}
      <div style={{ background: navy, height: "5px", borderRadius: "3px", marginBottom: "24px" }} />

      {/* Encabezado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: navy, letterSpacing: "-0.5px" }}>AviGest</div>
          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>Distribuidora Avícola</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "18px", fontWeight: "700", color: navy }}>Reporte Mensual</div>
          <div style={{ fontSize: "13px", color: "#374151", fontWeight: "600", marginTop: "3px" }}>{data.mes}</div>
          <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px" }}>Emitido el {today}</div>
        </div>
      </div>

      {/* KPIs principales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Ventas Totales", value: formatCurrency(data.resumen.ventas), delta: data.vs_mes_anterior.ventas, accent: "#2563eb" },
          { label: "Cobros Totales", value: formatCurrency(data.resumen.cobros), delta: data.vs_mes_anterior.cobros, accent: "#16a34a" },
          { label: "Resultado Neto", value: formatCurrency(data.resumen.resultadoNeto), delta: data.vs_mes_anterior.resultado, accent: data.resumen.resultadoNeto >= 0 ? "#16a34a" : "#dc2626" },
        ].map(k => (
          <div key={k.label} style={{ border: `1.5px solid #e5e7eb`, borderTop: `3px solid ${k.accent}`, borderRadius: "6px", padding: "14px 16px", background: "#fafafa" }}>
            <div style={{ fontSize: "9.5px", color: "#6b7280", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>{k.label}</div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "#111827" }}>{k.value}</div>
            <div style={{ fontSize: "10px", fontWeight: "600", color: k.delta >= 0 ? "#16a34a" : "#dc2626", marginTop: "4px" }}>{k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta)}% vs mes anterior</div>
          </div>
        ))}
      </div>

      {/* Indicadores secundarios — 2 columnas */}
      <div style={{ borderTop: `2px solid ${navy}`, paddingTop: "14px", marginBottom: "22px" }}>
        <div style={{ fontSize: "9.5px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Indicadores Financieros</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
          {[
            { label: "Margen bruto", value: `${data.kpis.margenBruto}%` },
            { label: data.kpis.tasaCobranza > 100 ? "Tasa de cobranza *" : "Tasa de cobranza", value: `${data.kpis.tasaCobranza}%` },
            { label: "Margen neto", value: `${data.kpis.margenNeto}%` },
            { label: "Ticket promedio", value: formatCurrency(data.kpis.ticketPromedio) },
            { label: "Crecimiento mensual", value: `${data.kpis.crecimientoMensual >= 0 ? "+" : ""}${data.kpis.crecimientoMensual}%` },
            { label: "CMV (Compras)", value: formatCurrency(data.resumen.compras) },
            { label: "Gastos operativos", value: formatCurrency(data.resumen.gastos) },
            { label: "Cajones vendidos", value: `${totalCajones}` },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f4f6", fontSize: "11px" }}>
              <span style={{ color: "#6b7280" }}>{r.label}</span>
              <span style={{ fontWeight: "600", color: "#111827" }}>{r.value}</span>
            </div>
          ))}
          {data.kpis.tasaCobranza > 100 && (
            <div style={{ fontSize: "9px", color: "#d97706", marginTop: "4px" }}>* Tasa &gt;100%: incluye cobros de meses anteriores</div>
          )}
        </div>
      </div>

      {/* Tabla de clientes */}
      {(data.clientesMes?.length ?? 0) > 0 && (
        <div style={{ marginBottom: "22px" }}>
          <div style={{ fontSize: "9.5px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px", borderTop: `2px solid ${navy}`, paddingTop: "14px" }}>
            Ventas por Cliente — {data.mes}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "32%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "6%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...thStyle, borderRadius: "6px 0 0 0" }}>CLIENTE</th>
                <th style={{ ...thR }}>CAJ.</th>
                <th style={{ ...thR }}>VENDIDO</th>
                <th style={{ ...thR }}>COSTO</th>
                <th style={{ ...thR }}>GANANCIA</th>
                <th style={{ ...thR, borderRadius: "0 6px 0 0" }}>MRG</th>
              </tr>
            </thead>
            <tbody>
              {data.clientesMes.map((c, i) => (
                <tr key={c.nombre} style={{ background: i % 2 === 0 ? "#f8fafc" : "#ffffff" }}>
                  <td style={{ ...tdStyle, fontWeight: "500" }}>{c.nombre}</td>
                  <td style={{ ...tdR, color: "#64748b" }}>{c.cajones}</td>
                  <td style={{ ...tdR, fontWeight: "600" }}>{formatCurrency(c.totalVendido)}</td>
                  <td style={{ ...tdR, color: "#64748b" }}>{formatCurrency(c.costoVendido)}</td>
                  <td style={{ ...tdR, fontWeight: "700", color: c.ganancia >= 0 ? "#16a34a" : "#dc2626" }}>{formatCurrency(c.ganancia)}</td>
                  <td style={{ ...tdR, fontWeight: "700", color: c.margen >= 20 ? "#16a34a" : c.margen >= 10 ? "#d97706" : "#dc2626" }}>{c.margen}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...tfStyle, borderRadius: "0 0 0 6px" }}>TOTAL — {data.clientesMes.length} clientes</td>
                <td style={tfR}>{totalCajones}</td>
                <td style={tfR}>{formatCurrency(totalVendido)}</td>
                <td style={tfR}>{formatCurrency(totalCosto)}</td>
                <td style={tfR}>{formatCurrency(totalGanancia)}</td>
                <td style={{ ...tfR, borderRadius: "0 0 6px 0" }}>{totalMargen}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Rentabilidad por producto */}
      {data.rentabilidadProductos?.length > 0 && (
        <div style={{ marginBottom: "22px" }}>
          <div style={{ fontSize: "9.5px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px", borderTop: `2px solid ${navy}`, paddingTop: "14px" }}>
            Rentabilidad por Producto
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "60%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...thStyle, borderRadius: "6px 0 0 0" }}>PRODUCTO</th>
                <th style={{ ...thR }}>MARGEN</th>
                <th style={{ ...thR, borderRadius: "0 6px 0 0" }}>INGRESOS</th>
              </tr>
            </thead>
            <tbody>
              {data.rentabilidadProductos.map((p, i) => (
                <tr key={p.producto} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                  <td style={tdStyle}>{p.producto}</td>
                  <td style={{ ...tdR, fontWeight: "700", color: p.margen >= 25 ? "#16a34a" : "#d97706" }}>{p.margen}%</td>
                  <td style={{ ...tdR, fontWeight: "600" }}>{formatCurrency(p.ingresos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: "28px", paddingTop: "12px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#9ca3af" }}>
        <span>AviGest — Sistema de Gestión Avícola · Confidencial</span>
        <span>Generado el {today}</span>
      </div>
    </div>
  )
}

// ─── Reporte Diario ───────────────────────────────────────────────────────────

function ReporteDiario({ data, isLoading, pdfRef, printRef, fecha, onFechaChange }: {
  data: DatosDiarios | null; isLoading: boolean
  pdfRef: React.RefObject<HTMLDivElement | null>; printRef: React.RefObject<HTMLDivElement | null>
  fecha: string; onFechaChange: (v: string) => void
}) {
  const [diasFiltro, setDiasFiltro] = useState(7)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <ReportHeader titulo="Reporte Diario" subtitulo={data?.fecha ?? "—"} tipo="diario" datos={data} pdfRef={pdfRef} printRef={printRef} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Fecha:</span>
        <input type="date" value={fecha} max={new Date().toISOString().split("T")[0]}
          onChange={(e) => onFechaChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 text-sm shadow-sm" />
      </div>

      {/* Hidden PDF template */}
      <div style={{ position: "absolute", top: 0, left: "-9999px", overflow: "visible" }}>
        <div ref={printRef}>{data && <PdfTemplateDiario data={data} />}</div>
      </div>

      <div ref={pdfRef} className="space-y-6">

        {/* ① KPI Bar */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
          {isLoading || !data ? [0,1,2,3,4].map((i) => <MetricCardSkeleton key={i} />) : (<>
            <MetricCard title="Ventas" value={data.ventas.hoy} delta={data.ventas.delta} deltaLabel="vs ayer" icon={ShoppingCart} />
            <MetricCard title="Cobros" value={data.cobros.hoy} delta={data.cobros.delta} deltaLabel="vs ayer" icon={Receipt} />
            <MetricCard title="Ganancia Bruta" value={data.gananciaBruta} icon={DollarSign} />
            <MetricCard title="Margen" value={`${data.margenBruto}%`} icon={Target} />
            <MetricCard title="Cajones" value={`${data.cajones.hoy} caj.`} delta={data.cajones.delta} deltaLabel="vs ayer" icon={Package} />
          </>)}
        </div>

        {/* ② Rentabilidad por Producto */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-muted-foreground" />Rentabilidad por Producto
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading || !data ? <div className="p-4"><Skeleton className="h-32 w-full" /></div> :
              (data.costosProducto?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground p-4">Sin ventas registradas.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Producto</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Costo unit.</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">P. venta</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Cajones</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Ingresos</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Costo total</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Ganancia</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.costosProducto.map((p) => (
                      <tr key={p.producto} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{p.producto}</td>
                        <td className="text-right py-2 px-3 text-muted-foreground">{formatCurrency(p.costoUnitario)}</td>
                        <td className="text-right py-2 px-3 text-muted-foreground">{formatCurrency(p.precioPromedio)}</td>
                        <td className="text-right py-2 px-3">{p.cajones}</td>
                        <td className="text-right py-2 px-3">{formatCurrency(p.ingresos)}</td>
                        <td className="text-right py-2 px-3 text-red-600">{formatCurrency(p.costoTotal)}</td>
                        <td className="text-right py-2 px-3 font-semibold text-emerald-600">{formatCurrency(p.ganancia)}</td>
                        <td className="text-right py-2 px-3">
                          <span className={`inline-block min-w-[42px] text-center px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap tabular-nums ${p.margen >= 25 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : p.margen >= 15 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"}`}>{p.margen}%</span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/50 font-semibold">
                      <td className="py-2 px-3">Total</td>
                      <td className="text-right py-2 px-3 text-muted-foreground">—</td>
                      <td className="text-right py-2 px-3 text-muted-foreground">—</td>
                      <td className="text-right py-2 px-3">{data.costosProducto.reduce((s, p) => s + p.cajones, 0)}</td>
                      <td className="text-right py-2 px-3">{formatCurrency(data.ventas.hoy)}</td>
                      <td className="text-right py-2 px-3 text-red-600">{formatCurrency(data.costosProducto.reduce((s, p) => s + p.costoTotal, 0))}</td>
                      <td className="text-right py-2 px-3 text-emerald-600">{formatCurrency(data.gananciaBruta)}</td>
                      <td className="text-right py-2 px-3">
                        <span className={`inline-block min-w-[42px] text-center px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap tabular-nums ${data.margenBruto >= 25 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : data.margenBruto >= 15 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"}`}>{data.margenBruto}%</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ③ Detalle de ventas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />Detalle de Ventas por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading || !data ? <div className="p-4"><Skeleton className="h-40 w-full" /></div> :
              (data.ventasDetalle?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground p-4">Sin ventas registradas.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Cliente / Producto</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Cant.</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">P. venta</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">P. costo</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Ingreso</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Ganancia</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ventasDetalle.map((cl) => {
                      const totalCl = cl.items.reduce((s, i) => s + i.cantidad * i.precioVenta, 0)
                      const ganCl = cl.items.reduce((s, i) => s + i.cantidad * (i.precioVenta - i.costoUnitario), 0)
                      const marCl = totalCl > 0 ? Math.round((ganCl / totalCl) * 1000) / 10 : 0
                      return (
                        <Fragment key={cl.cliente}>
                          <tr className="bg-muted/30 border-b border-border">
                            <td colSpan={4} className="py-1.5 px-3 font-semibold text-xs">{cl.cliente}</td>
                            <td className="text-right py-1.5 px-3 font-semibold">{formatCurrency(totalCl)}</td>
                            <td className="text-right py-1.5 px-3 font-semibold text-emerald-600">{formatCurrency(ganCl)}</td>
                            <td className="text-right py-1.5 px-3 font-semibold">{marCl}%</td>
                          </tr>
                          {cl.items.map((it, j) => {
                            const ing = it.cantidad * it.precioVenta
                            const gan = it.cantidad * (it.precioVenta - it.costoUnitario)
                            const mar = ing > 0 ? Math.round((gan / ing) * 1000) / 10 : 0
                            return (
                              <tr key={j} className="border-b border-border/30 hover:bg-muted/20">
                                <td className="py-1.5 pl-6 pr-3 text-muted-foreground">└ {it.producto}</td>
                                <td className="text-right py-1.5 px-3">{it.cantidad}</td>
                                <td className="text-right py-1.5 px-3">{formatCurrency(it.precioVenta)}</td>
                                <td className="text-right py-1.5 px-3 text-muted-foreground">{formatCurrency(it.costoUnitario)}</td>
                                <td className="text-right py-1.5 px-3">{formatCurrency(ing)}</td>
                                <td className="text-right py-1.5 px-3 text-emerald-600">{formatCurrency(gan)}</td>
                                <td className="text-right py-1.5 px-3 text-muted-foreground">{mar}%</td>
                              </tr>
                            )
                          })}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ④ Gráficos */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-muted-foreground" />Top Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !data ? <Skeleton className="h-40 w-full" /> :
                data.topClientes.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas.</p> : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.topClientes} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip formatter={(v: any) => formatCurrency(v as number)} />
                    <Bar dataKey="monto" fill="#059669" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />Mix de Productos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !data ? <Skeleton className="h-40 w-full" /> :
                (data.desglose?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">Sin ventas.</p> : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={data.desglose} dataKey="ingresos" nameKey="producto" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                      {data.desglose.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v as number)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ⑤ Indicadores de cobro + Gastos */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />Indicadores de Cobro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading || !data ? [0,1,2].map(i => <Skeleton key={i} className="h-6 w-full" />) : (<>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tasa de cobranza</span><span className="font-semibold">{data.tasaCobranza}%{data.tasaCobranza > 100 && <span className="text-amber-500 text-xs ml-1">*ant.</span>}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pendiente de cobro</span><span className="font-semibold">{formatCurrency(data.pendiente)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Ticket promedio</span><span className="font-semibold">{formatCurrency(data.ticketPromedio)}</span></div>
                <div className="flex justify-between text-sm border-t pt-2"><span className="text-muted-foreground">Gastos del día</span><span className="font-semibold text-red-600">{formatCurrency(data.gastos)}</span></div>
              </>)}
            </CardContent>
          </Card>

          {/* ⑥ Clientes inactivos */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />Clientes Inactivos
                </CardTitle>
                <div className="flex gap-1">
                  {[7, 14, 30].map((d) => (
                    <button key={d} onClick={() => setDiasFiltro(d)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${diasFiltro === d ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                      +{d}d
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading || !data ? <Skeleton className="h-32 w-full" /> :
                (() => {
                  const filtrados = data.clientesSinComprar.filter(c => c.diasSinComprar >= diasFiltro)
                  return filtrados.length === 0
                    ? <p className="text-sm text-muted-foreground">Todos los clientes compraron en los últimos {diasFiltro} días.</p>
                    : <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {filtrados.map((c) => (
                          <div key={c.nombre} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-md border border-border bg-background text-xs">
                            <span className="flex-1 min-w-0 truncate">{c.nombre}</span>
                            <span className={`shrink-0 inline-flex items-center justify-center h-5 px-2 rounded-full text-[10px] font-semibold tabular-nums whitespace-nowrap ${c.diasSinComprar >= 30 ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" : c.diasSinComprar >= 14 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                              {c.diasSinComprar}d
                            </span>
                          </div>
                        ))}
                      </div>
                })()
              }
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}

// ─── Reporte Semanal ──────────────────────────────────────────────────────────

function ReporteSemanal({ data, isLoading, pdfRef, printRef, semana, onSemanaChange }: { data: DatosSemanales | null; isLoading: boolean; pdfRef: React.RefObject<HTMLDivElement | null>; printRef: React.RefObject<HTMLDivElement | null>; semana: string; onSemanaChange: (v: string) => void }) {
  const cajonesAntDelta = data && data.cajonesAntSemana > 0
    ? Math.round(((data.cajonesSemana - data.cajonesAntSemana) / data.cajonesAntSemana) * 10) / 10
    : undefined

  return (
    <div className="space-y-6">
      <ReportHeader titulo="Reporte Semanal" subtitulo={data?.semana ?? "—"} tipo="semanal" datos={data} pdfRef={pdfRef} printRef={printRef} />
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Semana del:</span>
        <input type="date" value={semana} max={new Date().toISOString().split("T")[0]}
          onChange={(e) => onSemanaChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 text-sm shadow-sm" />
      </div>
      <div style={{ position: "absolute", top: 0, left: "-9999px", overflow: "visible" }}>
        <div ref={printRef}>{data && <PdfTemplateSemanal data={data} />}</div>
      </div>

      <div ref={pdfRef} className="space-y-6">
        {/* Row 1: Dinero */}
        <div className="grid gap-4 sm:grid-cols-3">
          {isLoading || !data ? [0, 1, 2].map((i) => <MetricCardSkeleton key={i} />) : (
            <>
              <MetricCard title="Ventas de la Semana" value={data.ventas.semana} delta={data.ventas.delta} deltaLabel="vs semana ant." icon={ShoppingCart} />
              <MetricCard title="Cobros de la Semana" value={data.cobros.semana} delta={data.cobros.delta} deltaLabel="vs semana ant." icon={Receipt} />
              <MetricCard title="Pendiente de Cobro" value={data.pendiente} icon={Clock} />
            </>
          )}
        </div>

        {/* Row 2: Operaciones */}
        <div className="grid gap-4 sm:grid-cols-3">
          {isLoading || !data ? [0, 1, 2].map((i) => <MetricCardSkeleton key={i} />) : (
            <>
              <MetricCard title="Cajones Vendidos" value={`${data.cajonesSemana.toLocaleString("es-AR")} caj.`} delta={cajonesAntDelta} deltaLabel="vs semana ant." icon={Package} />
              <MetricCard title="Clientes Activos" value={`${data.clientesActivos}`} icon={Users} />
              <MetricCard title="Ticket Prom. por Cliente" value={data.ticketPromedioPorCliente} icon={DollarSign} />
            </>
          )}
        </div>

        {/* Gráfico diario */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ventas vs Cobros por Día</CardTitle>
            {!isLoading && data && (
              <p className="text-xs text-muted-foreground">
                Tasa de cobranza semanal:{" "}
                <span className={`font-semibold ${data.tasaCobranza >= 80 ? "text-green-600" : data.tasaCobranza >= 50 ? "text-amber-600" : "text-red-600"}`}>
                  {data.tasaCobranza}%
                </span>
                {data.tasaCobranza > 100 && <span className="text-amber-600"> · Incluye cobros de meses anteriores</span>}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {isLoading || !data ? <Skeleton className="h-[220px] w-full" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.ventasPorDia} barGap={4}>
                  <XAxis dataKey="dia" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={52} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="ventas" name="Ventas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cobros" name="Cobros" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Desglose + Top Clientes */}
        <div className="grid gap-4 lg:grid-cols-2">
          {isLoading ? <Skeleton className="h-48 w-full" /> : data && <DesgloseCard desglose={data.desglose} />}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />Top 5 Clientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading || !data ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6 w-full" />) :
                data.topClientes.length === 0
                  ? <p className="text-sm text-muted-foreground">Sin ventas registradas esta semana.</p>
                  : data.topClientes.map((c, i) => (
                    <div key={c.nombre} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary shrink-0">{i + 1}</span>
                        <span className="text-sm truncate">{c.nombre}</span>
                      </div>
                      <span className="text-sm font-semibold shrink-0 ml-2">{formatCurrency(c.monto)}</span>
                    </div>
                  ))
              }
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Reporte Mensual ──────────────────────────────────────────────────────────

function ReporteMensual({ data, isLoading, pdfRef, printRef, mes, onMesChange }: { data: DatosMensuales | null; isLoading: boolean; pdfRef: React.RefObject<HTMLDivElement | null>; printRef: React.RefObject<HTMLDivElement | null>; mes: string; onMesChange: (v: string) => void }) {
  return (
    <div className="space-y-6">
      <ReportHeader titulo="Reporte Mensual" subtitulo={data?.mes ?? "—"} tipo="mensual" datos={data} pdfRef={pdfRef} printRef={printRef} />
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Mes:</span>
        <input type="month" value={mes} max={new Date().toISOString().slice(0, 7)}
          onChange={(e) => onMesChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 text-sm shadow-sm" />
      </div>
      <div style={{ position: "absolute", top: 0, left: "-9999px", overflow: "visible" }}>
        <div ref={printRef}>{data && <PdfTemplateMensual data={data} />}</div>
      </div>
      <div ref={pdfRef} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Resumen Ejecutivo</CardTitle>
            <CardDescription>Comparativa vs mes anterior y mismo mes del año anterior</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <div className="grid gap-4 sm:grid-cols-3">{[0,1,2].map((i) => <div key={i} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-32" /><Skeleton className="h-3 w-40" /></div>)}</div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: "Ventas Totales", value: data.resumen.ventas, deltaMA: data.vs_mes_anterior.ventas, deltaMAAA: data.vs_mismo_mes_anio_anterior.ventas },
                    { label: "Cobros Totales", value: data.resumen.cobros, deltaMA: data.vs_mes_anterior.cobros, deltaMAAA: data.vs_mismo_mes_anio_anterior.cobros },
                    { label: "Resultado Neto", value: data.resumen.resultadoNeto, deltaMA: data.vs_mes_anterior.resultado, deltaMAAA: data.vs_mismo_mes_anio_anterior.resultado },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-xl font-bold">{formatCurrency(item.value)}</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className={item.deltaMA >= 0 ? "text-green-600" : "text-red-600"}>{item.deltaMA >= 0 ? "▲" : "▼"} {Math.abs(item.deltaMA)}% vs mes ant.</span>
                        <span className={item.deltaMAAA >= 0 ? "text-green-600" : "text-red-600"}>{item.deltaMAAA >= 0 ? "▲" : "▼"} {Math.abs(item.deltaMAAA)}% vs AA</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t grid gap-4 sm:grid-cols-2">
                  <div><p className="text-xs text-muted-foreground">Gastos Operativos</p><p className="text-xl font-bold">{formatCurrency(data.resumen.gastos)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Margen Neto</p><p className="text-xl font-bold">{data.resumen.margenNeto}%</p></div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {isLoading || !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2,3,4].map((i) => <MetricCardSkeleton key={i} />)}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Ticket Promedio", value: formatCurrency(data.kpis.ticketPromedio), trend: undefined, note: undefined as string | undefined },
              { label: "Tasa de Cobranza", value: `${data.kpis.tasaCobranza}%`, trend: undefined, note: data.kpis.tasaCobranza > 100 ? "Incluye cobros de meses anteriores" : undefined },
              { label: "Margen Bruto", value: `${data.kpis.margenBruto}%`, trend: undefined, note: undefined },
              { label: "Margen Neto", value: `${data.kpis.margenNeto}%`, trend: undefined, note: undefined },
              { label: "Crecimiento Mensual", value: `${data.kpis.crecimientoMensual >= 0 ? "+" : ""}${data.kpis.crecimientoMensual}%`, trend: data.kpis.crecimientoMensual, note: undefined },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  {kpi.trend !== undefined && (
                    <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${kpi.trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {kpi.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span>{kpi.trend >= 0 ? "+" : ""}{kpi.trend.toFixed(1)}% vs mes anterior</span>
                    </div>
                  )}
                  {kpi.note && <p className="mt-1 text-xs text-amber-600">{kpi.note}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Evolución — Últimos 6 Meses</CardTitle></CardHeader>
          <CardContent>
            {isLoading || !data ? <Skeleton className="h-[240px] w-full" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.evolucionVentas}>
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} width={55} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="cobros" name="Cobros" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />Ventas por Cliente — {data?.mes ?? ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <div className="space-y-2">{[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : !data.clientesMes?.length ? (
              <p className="text-sm text-muted-foreground">Sin datos este mes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1e3a5f] text-white">
                      <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                      <th className="px-3 py-2 text-right font-semibold">Cajones</th>
                      <th className="px-3 py-2 text-right font-semibold">Vendido</th>
                      <th className="px-3 py-2 text-right font-semibold">Costo</th>
                      <th className="px-3 py-2 text-right font-semibold">Ganancia</th>
                      <th className="px-3 py-2 text-right font-semibold">Mrg %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clientesMes.map((c, i) => (
                      <tr key={c.nombre} className={i % 2 === 0 ? "bg-slate-50 dark:bg-slate-900/40" : ""}>
                        <td className="px-3 py-2 font-medium">{c.nombre}</td>
                        <td className="px-3 py-2 text-right">{c.cajones}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(c.totalVendido)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(c.costoVendido)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700 dark:text-green-400">{formatCurrency(c.ganancia)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${c.margen >= 20 ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300" : c.margen >= 10 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300" : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"}`}>
                            {c.margen}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#1e3a5f] text-white font-bold">
                      <td className="px-3 py-2">TOTAL</td>
                      <td className="px-3 py-2 text-right">{data.clientesMes.reduce((s, c) => s + c.cajones, 0)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(data.clientesMes.reduce((s, c) => s + c.totalVendido, 0))}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(data.clientesMes.reduce((s, c) => s + c.costoVendido, 0))}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(data.clientesMes.reduce((s, c) => s + c.ganancia, 0))}</td>
                      <td className="px-3 py-2 text-right">
                        {(() => { const tv = data.clientesMes.reduce((s, c) => s + c.totalVendido, 0); const cv = data.clientesMes.reduce((s, c) => s + c.costoVendido, 0); return tv > 0 ? `${(((tv - cv) / tv) * 100).toFixed(1)}%` : "—" })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Métodos de Pago</CardTitle></CardHeader>
            <CardContent>
              {isLoading || !data || !data.distribucionMetodosPago.length ? (
                <p className="text-sm text-muted-foreground">Sin cobros este mes.</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={data.distribucionMetodosPago} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={28}>
                        {data.distribucionMetodosPago.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {data.distribucionMetodosPago.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                          <span>{item.name}</span>
                        </div>
                        <span className="font-medium">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Rentabilidad por Producto</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {isLoading || !data ? [0,1,2,3].map((i) => <Skeleton key={i} className="h-6 w-full" />) :
                data.rentabilidadProductos.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos este mes.</p> :
                data.rentabilidadProductos.map((p) => (
                  <div key={p.producto} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[140px]">{p.producto}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.margen >= 25 ? "default" : "secondary"} className="text-xs">{p.margen}%</Badge>
                      <span className="text-muted-foreground w-24 text-right">{formatCurrency(p.ingresos)}</span>
                    </div>
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ReportesEjecutivosContent() {
  const [activeTab, setActiveTab] = useState("diario")
  const [dataDiario, setDataDiario] = useState<DatosDiarios | null>(null)
  const [dataSemanal, setDataSemanal] = useState<DatosSemanales | null>(null)
  const [dataMensual, setDataMensual] = useState<DatosMensuales | null>(null)
  const [loadingDiario, setLoadingDiario] = useState(false)
  const [loadingSemanal, setLoadingSemanal] = useState(false)
  const [loadingMensual, setLoadingMensual] = useState(false)
  const [fechaDiario, setFechaDiario] = useState(new Date().toISOString().split("T")[0])
  const [semana, setSemana] = useState(new Date().toISOString().split("T")[0])
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().toISOString().slice(0, 7))
  const pdfRefDiario = useRef<HTMLDivElement>(null)
  const pdfRefSemanal = useRef<HTMLDivElement>(null)
  const pdfRefMensual = useRef<HTMLDivElement>(null)
  const printRefDiario = useRef<HTMLDivElement>(null)
  const printRefSemanal = useRef<HTMLDivElement>(null)
  const printRefMensual = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async (tipo: string, extraParams: Record<string, string> = {}) => {
    const setLoading = tipo === "diario" ? setLoadingDiario : tipo === "semanal" ? setLoadingSemanal : setLoadingMensual
    const setData = (tipo === "diario" ? setDataDiario : tipo === "semanal" ? setDataSemanal : setDataMensual) as (v: any) => void
    setLoading(true)
    try {
      const params = new URLSearchParams({ tipo, ...extraParams })
      const res = await fetch(`/api/reportes/data?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      console.error(`[reportes/${tipo}] error`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "diario") fetchData("diario", { fecha: fechaDiario })
  }, [activeTab, fechaDiario, fetchData])

  useEffect(() => {
    if (activeTab === "semanal") fetchData("semanal", { semana })
  }, [activeTab, semana, fetchData])

  useEffect(() => {
    if (activeTab === "mensual") fetchData("mensual", { mes: mesSeleccionado })
  }, [activeTab, mesSeleccionado, fetchData])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="diario" onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-sm grid-cols-3">
          <TabsTrigger value="diario" className="gap-1.5"><Calendar className="h-3.5 w-3.5" />Diario</TabsTrigger>
          <TabsTrigger value="semanal" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Semanal</TabsTrigger>
          <TabsTrigger value="mensual" className="gap-1.5"><CalendarRange className="h-3.5 w-3.5" />Mensual</TabsTrigger>
        </TabsList>
        <TabsContent value="diario" className="mt-6">
          <ReporteDiario data={dataDiario} isLoading={loadingDiario} pdfRef={pdfRefDiario} printRef={printRefDiario} fecha={fechaDiario} onFechaChange={setFechaDiario} />
        </TabsContent>
        <TabsContent value="semanal" className="mt-6">
          <ReporteSemanal data={dataSemanal} isLoading={loadingSemanal} pdfRef={pdfRefSemanal} printRef={printRefSemanal} semana={semana} onSemanaChange={setSemana} />
        </TabsContent>
        <TabsContent value="mensual" className="mt-6">
          <ReporteMensual data={dataMensual} isLoading={loadingMensual} pdfRef={pdfRefMensual} printRef={printRefMensual} mes={mesSeleccionado} onMesChange={setMesSeleccionado} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
