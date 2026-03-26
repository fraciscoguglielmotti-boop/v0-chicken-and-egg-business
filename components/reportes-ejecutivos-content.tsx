"use client"

import { useEffect, useRef, useState, useCallback } from "react"
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

interface DatosDiarios {
  fecha: string
  ventas: { hoy: number; ayer: number; delta: number }
  cobros: { hoy: number; ayer: number; delta: number }
  cajones: { hoy: number; ayer: number; delta: number }
  topClientes: { nombre: string; monto: number }[]
  desglose: DesgloseProd[]
  gastos: number
}

interface DatosSemanales {
  semana: string
  ventas: { semana: number; anterior: number; delta: number }
  cobros: { semana: number; anterior: number; delta: number }
  margenBruto: number
  tasaCobranza: number
  ventasPorDia: { dia: string; ventas: number; cobros: number }[]
  topClientes: { nombre: string; monto: number }[]
  productosMasVendidos: DesgloseProd[]
  desglose: DesgloseProd[]
  cajonesSemana: number
  cajonesAntSemana: number
  cuentasVencidas: number
  montoVencido: number
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

function MetricCard({ title, value, delta, deltaLabel, icon: Icon }: {
  title: string; value: string | number; delta?: number; deltaLabel?: string; icon: React.ElementType
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

function ReportHeader({ titulo, subtitulo, tipo, datos, pdfRef }: {
  titulo: string; subtitulo: string; tipo: string; datos: any; pdfRef: React.RefObject<HTMLDivElement | null>
}) {
  const { toast } = useToast()
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [enviandoEmail, setEnviandoEmail] = useState(false)

  const generarPDF = async () => {
    if (!pdfRef.current) return
    setGenerandoPDF(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")

      const canvas = await html2canvas(pdfRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 1100,
        scrollX: 0,
        scrollY: -window.scrollY,
      })

      const imgData = canvas.toDataURL("image/jpeg", 0.9)
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgH = (canvas.height * pageW) / canvas.width

      // Multi-página
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
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Error desconocido")
      toast({ title: "Email enviado", description: "El reporte fue enviado a tu casilla." })
    } catch (err: any) {
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" })
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

// ─── Reporte Diario ───────────────────────────────────────────────────────────

function ReporteDiario({ data, isLoading, pdfRef }: { data: DatosDiarios | null; isLoading: boolean; pdfRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="space-y-6">
      <ReportHeader titulo="Reporte Diario" subtitulo={data?.fecha ?? "—"} tipo="diario" datos={data} pdfRef={pdfRef} />
      <div ref={pdfRef} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {isLoading || !data ? [0, 1, 2].map((i) => <MetricCardSkeleton key={i} />) : (
            <>
              <MetricCard title="Ventas del Día" value={data.ventas.hoy} delta={data.ventas.delta} deltaLabel="vs ayer" icon={ShoppingCart} />
              <MetricCard title="Cobros del Día" value={data.cobros.hoy} delta={data.cobros.delta} deltaLabel="vs ayer" icon={Receipt} />
              <MetricCard title="Cajones Vendidos" value={`${data.cajones.hoy.toLocaleString("es-AR")} caj.`} delta={data.cajones.delta} deltaLabel="vs ayer" icon={Package} />
            </>
          )}
        </div>

        {isLoading ? <Skeleton className="h-40 w-full" /> : data && <DesgloseCard desglose={data.desglose} />}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />Top 3 Clientes del Día
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading || !data ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-6 w-full" />) :
                data.topClientes.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas registradas hoy.</p> :
                data.topClientes.map((c, i) => (
                  <div key={c.nombre} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                      <span className="text-sm">{c.nombre}</span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(c.monto)}</span>
                  </div>
                ))
              }
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />Gastos del Día
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading || !data ? <Skeleton className="h-8 w-36" /> : <div className="text-2xl font-bold">{formatCurrency(data.gastos)}</div>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Reporte Semanal ──────────────────────────────────────────────────────────

function ReporteSemanal({ data, isLoading, pdfRef }: { data: DatosSemanales | null; isLoading: boolean; pdfRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="space-y-6">
      <ReportHeader titulo="Reporte Semanal" subtitulo={data?.semana ?? "—"} tipo="semanal" datos={data} pdfRef={pdfRef} />
      <div ref={pdfRef} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading || !data ? [0, 1, 2, 3].map((i) => <MetricCardSkeleton key={i} />) : (
            <>
              <MetricCard title="Ventas de la Semana" value={data.ventas.semana} delta={data.ventas.delta} deltaLabel="vs semana ant." icon={ShoppingCart} />
              <MetricCard title="Cobros de la Semana" value={data.cobros.semana} delta={data.cobros.delta} deltaLabel="vs semana ant." icon={Receipt} />
              <MetricCard title="Cajones Vendidos" value={`${(data.cajonesSemana ?? 0).toLocaleString("es-AR")} caj.`} icon={Package} />
              <MetricCard title="Tasa de Cobranza" value={`${data.tasaCobranza}%`} icon={CheckCircle2} />
            </>
          )}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Ventas vs Cobros por Día</CardTitle></CardHeader>
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

        {isLoading ? <Skeleton className="h-40 w-full" /> : data && <DesgloseCard desglose={data.desglose} />}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />Top 5 Clientes de la Semana
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading || !data ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6 w-full" />) :
                data.topClientes.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos esta semana.</p> :
                data.topClientes.map((c, i) => (
                  <div key={c.nombre} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                      <span className="text-sm">{c.nombre}</span>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(c.monto)}</span>
                  </div>
                ))
              }
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />Margen Bruto
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading || !data ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{data.margenBruto}%</div>}
              </CardContent>
            </Card>
            {(!isLoading && data && data.cuentasVencidas > 0) && (
              <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
                <CardContent className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">{data.cuentasVencidas} cuentas vencidas</p>
                  </div>
                  <span className="text-lg font-bold text-red-700 dark:text-red-400">{formatCurrency(data.montoVencido)}</span>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Reporte Mensual ──────────────────────────────────────────────────────────

function ReporteMensual({ data, isLoading, pdfRef }: { data: DatosMensuales | null; isLoading: boolean; pdfRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="space-y-6">
      <ReportHeader titulo="Reporte Mensual" subtitulo={data?.mes ?? "—"} tipo="mensual" datos={data} pdfRef={pdfRef} />
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
              { label: "Ticket Promedio", value: formatCurrency(data.kpis.ticketPromedio), trend: undefined },
              { label: "Tasa de Cobranza", value: `${data.kpis.tasaCobranza}%`, trend: undefined },
              { label: "Margen Bruto", value: `${data.kpis.margenBruto}%`, trend: undefined },
              { label: "Margen Neto", value: `${data.kpis.margenNeto}%`, trend: undefined },
              { label: "Crecimiento Mensual", value: `${data.kpis.crecimientoMensual >= 0 ? "+" : ""}${data.kpis.crecimientoMensual}%`, trend: data.kpis.crecimientoMensual },
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

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />Top Clientes del Mes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {isLoading || !data ? [0,1,2,3,4].map((i) => <Skeleton key={i} className="h-6 w-full" />) :
                data.topClientes.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos este mes.</p> :
                data.topClientes.map((c, i) => (
                  <div key={c.nombre} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary shrink-0">{i + 1}</span>
                      <span className="text-sm truncate max-w-[160px]">{c.nombre}</span>
                    </div>
                    <span className="text-sm font-semibold shrink-0">{formatCurrency(c.monto)}</span>
                  </div>
                ))
              }
            </CardContent>
          </Card>

          <div className="space-y-4">
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
  const pdfRefDiario = useRef<HTMLDivElement>(null)
  const pdfRefSemanal = useRef<HTMLDivElement>(null)
  const pdfRefMensual = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async (tipo: string) => {
    const setLoading = tipo === "diario" ? setLoadingDiario : tipo === "semanal" ? setLoadingSemanal : setLoadingMensual
    const setData = (tipo === "diario" ? setDataDiario : tipo === "semanal" ? setDataSemanal : setDataMensual) as (v: any) => void
    setLoading(true)
    try {
      const res = await fetch(`/api/reportes/data?tipo=${tipo}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      console.error(`[reportes/${tipo}] error`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "diario" && !dataDiario) fetchData("diario")
    if (activeTab === "semanal" && !dataSemanal) fetchData("semanal")
    if (activeTab === "mensual" && !dataMensual) fetchData("mensual")
  }, [activeTab, dataDiario, dataSemanal, dataMensual, fetchData])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="diario" onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-sm grid-cols-3">
          <TabsTrigger value="diario" className="gap-1.5"><Calendar className="h-3.5 w-3.5" />Diario</TabsTrigger>
          <TabsTrigger value="semanal" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Semanal</TabsTrigger>
          <TabsTrigger value="mensual" className="gap-1.5"><CalendarRange className="h-3.5 w-3.5" />Mensual</TabsTrigger>
        </TabsList>
        <TabsContent value="diario" className="mt-6">
          <ReporteDiario data={dataDiario} isLoading={loadingDiario} pdfRef={pdfRefDiario} />
        </TabsContent>
        <TabsContent value="semanal" className="mt-6">
          <ReporteSemanal data={dataSemanal} isLoading={loadingSemanal} pdfRef={pdfRefSemanal} />
        </TabsContent>
        <TabsContent value="mensual" className="mt-6">
          <ReporteMensual data={dataMensual} isLoading={loadingMensual} pdfRef={pdfRefMensual} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
