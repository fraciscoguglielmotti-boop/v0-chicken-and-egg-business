"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
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

// ─── Colores ─────────────────────────────────────────────────────────────────
const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"]

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

const datosDiarios = {
  fecha: "Miércoles 25 de Marzo, 2026",
  ventas: { hoy: 284500, ayer: 251000, delta: 13.3 },
  cobros: { hoy: 198000, ayer: 220000, delta: -10.0 },
  pedidos: { hoy: 18, ayer: 15, delta: 20.0 },
  topClientes: [
    { nombre: "Supermercado El Gallito", monto: 72000 },
    { nombre: "Distribuidora Norte", monto: 58500 },
    { nombre: "La Huevería Central", monto: 41000 },
  ],
  stockCritico: [
    { producto: "Huevo Extra", stock: 120, minimo: 500 },
    { producto: "Pollo A", stock: 45, minimo: 100 },
  ],
  gastos: 34200,
}

const datosSemanales = {
  semana: "Semana del 20 al 25 de Marzo, 2026",
  ventas: { semana: 1420000, anterior: 1280000, delta: 10.9 },
  cobros: { semana: 1180000, anterior: 1100000, delta: 7.3 },
  margenBruto: 28.4,
  tasaCobranza: 83.1,
  ventasPorDia: [
    { dia: "Lun", ventas: 198000, cobros: 165000 },
    { dia: "Mar", ventas: 245000, cobros: 210000 },
    { dia: "Mié", ventas: 284500, cobros: 198000 },
    { dia: "Jue", ventas: 220000, cobros: 195000 },
    { dia: "Vie", ventas: 265000, cobros: 240000 },
    { dia: "Sáb", ventas: 207500, cobros: 172000 },
  ],
  topClientes: [
    { nombre: "Supermercado El Gallito", monto: 385000 },
    { nombre: "Distribuidora Norte", monto: 298000 },
    { nombre: "La Huevería Central", monto: 215000 },
    { nombre: "Almacén San Martín", monto: 187000 },
    { nombre: "Pollería Buenos Aires", monto: 142000 },
  ],
  productosMasVendidos: [
    { producto: "Huevo Tipo 1", unidades: 8400, ingresos: 554400 },
    { producto: "Huevo Tipo 2", unidades: 5200, ingresos: 280800 },
    { producto: "Pollo A", unidades: 980, ingresos: 372400 },
    { producto: "Pollo B", unidades: 620, ingresos: 212050 },
  ],
  cuentasVencidas: 3,
  montoVencido: 128500,
}

const datosMensuales = {
  mes: "Marzo 2026",
  resumen: {
    ventas: 5840000,
    cobros: 5120000,
    gastos: 480000,
    compras: 4180000,
    resultadoNeto: 1180000,
    margenNeto: 20.2,
  },
  vs_mes_anterior: { ventas: 8.4, cobros: 5.2, resultado: 12.1 },
  vs_mismo_mes_anio_anterior: { ventas: 22.3, cobros: 18.7, resultado: 31.0 },
  kpis: [
    { label: "Ticket Promedio", value: "$14.200", trend: 3.2 },
    { label: "Tasa de Cobranza", value: "87.7%", trend: 1.4 },
    { label: "Margen Bruto", value: "28.4%", trend: -0.8 },
    { label: "Tasa de Morosidad", value: "4.2%", trend: -0.5 },
    { label: "Crecimiento Mensual", value: "+8.4%", trend: 8.4 },
    { label: "Días Promedio Cobro", value: "12 días", trend: -1.0 },
  ],
  evolucionVentas: [
    { mes: "Oct", ventas: 4100000, cobros: 3700000 },
    { mes: "Nov", ventas: 4380000, cobros: 3950000 },
    { mes: "Dic", ventas: 4950000, cobros: 4500000 },
    { mes: "Ene", ventas: 4620000, cobros: 4180000 },
    { mes: "Feb", ventas: 5388000, cobros: 4870000 },
    { mes: "Mar", ventas: 5840000, cobros: 5120000 },
  ],
  topClientes: [
    { nombre: "Supermercado El Gallito", monto: 1420000 },
    { nombre: "Distribuidora Norte", monto: 1180000 },
    { nombre: "La Huevería Central", monto: 890000 },
    { nombre: "Almacén San Martín", monto: 720000 },
    { nombre: "Pollería Buenos Aires", monto: 580000 },
    { nombre: "Mercado Central", monto: 460000 },
    { nombre: "Minimarket Express", monto: 380000 },
    { nombre: "Super La Esquina", monto: 210000 },
  ],
  rentabilidadProductos: [
    { producto: "Huevo Tipo 1", ingresos: 2180000, costo: 1540000, margen: 29.4 },
    { producto: "Pollo A", ingresos: 1620000, costo: 1180000, margen: 27.2 },
    { producto: "Huevo Tipo 2", ingresos: 1240000, costo: 870000, margen: 29.8 },
    { producto: "Pollo B", ingresos: 800000, costo: 590000, margen: 26.3 },
  ],
  distribucionMetodosPago: [
    { name: "Transferencia", value: 68 },
    { name: "Efectivo", value: 24 },
    { name: "MercadoPago", value: 8 },
  ],
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  prefix = "",
}: {
  title: string
  value: string | number
  delta?: number
  deltaLabel?: string
  icon: React.ElementType
  prefix?: string
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
          {prefix}{typeof value === "number" ? formatCurrency(value) : value}
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

function EmailButton({ disabled = true }: { disabled?: boolean }) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      title="Envío por email disponible próximamente"
      className="gap-2"
    >
      <Mail className="h-4 w-4" />
      Enviar por email
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Próximamente</Badge>
    </Button>
  )
}

// ─── Reporte Diario ───────────────────────────────────────────────────────────

function ReporteDiario() {
  const d = datosDiarios
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reporte Diario</h2>
          <p className="text-sm text-muted-foreground">{d.fecha}</p>
        </div>
        <EmailButton />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          title="Ventas del Día"
          value={d.ventas.hoy}
          delta={d.ventas.delta}
          deltaLabel="vs ayer"
          icon={ShoppingCart}
        />
        <MetricCard
          title="Cobros del Día"
          value={d.cobros.hoy}
          delta={d.cobros.delta}
          deltaLabel="vs ayer"
          icon={Receipt}
        />
        <MetricCard
          title="Pedidos Despachados"
          value={`${d.pedidos.hoy} pedidos`}
          delta={d.pedidos.delta}
          deltaLabel="vs ayer"
          icon={Package}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top clientes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Top 3 Clientes del Día
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.topClientes.map((c, i) => (
              <div key={c.nombre} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm">{c.nombre}</span>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(c.monto)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Stock crítico + gastos */}
        <div className="space-y-4">
          <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="h-4 w-4" />
                Stock Crítico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.stockCritico.map((s) => (
                <div key={s.producto} className="flex items-center justify-between text-sm">
                  <span>{s.producto}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-orange-700 dark:text-orange-400">{s.stock} u.</span>
                    <span className="text-muted-foreground text-xs">(mín. {s.minimo})</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Gastos del Día
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(d.gastos)}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Reporte Semanal ──────────────────────────────────────────────────────────

function ReporteSemanal() {
  const d = datosSemanales
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reporte Semanal</h2>
          <p className="text-sm text-muted-foreground">{d.semana}</p>
        </div>
        <EmailButton />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Ventas de la Semana"
          value={d.ventas.semana}
          delta={d.ventas.delta}
          deltaLabel="vs semana ant."
          icon={ShoppingCart}
        />
        <MetricCard
          title="Cobros de la Semana"
          value={d.cobros.semana}
          delta={d.cobros.delta}
          deltaLabel="vs semana ant."
          icon={Receipt}
        />
        <MetricCard
          title="Margen Bruto"
          value={`${d.margenBruto}%`}
          icon={TrendingUp}
        />
        <MetricCard
          title="Tasa de Cobranza"
          value={`${d.tasaCobranza}%`}
          icon={CheckCircle2}
        />
      </div>

      {/* Gráfico ventas vs cobros por día */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Ventas vs Cobros por Día</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.ventasPorDia} barGap={4}>
              <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={55}
              />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="ventas" name="Ventas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cobros" name="Cobros" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top 5 clientes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Top 5 Clientes de la Semana
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.topClientes.map((c, i) => (
              <div key={c.nombre} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm">{c.nombre}</span>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(c.monto)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Productos más vendidos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Productos más Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {d.productosMasVendidos.map((p) => (
                <div key={p.producto} className="flex items-center justify-between text-sm">
                  <span>{p.producto}</span>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-muted-foreground">{p.unidades.toLocaleString("es-AR")} u.</span>
                    <span className="font-semibold w-24 text-right">{formatCurrency(p.ingresos)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cuentas vencidas */}
      {d.cuentasVencidas > 0 && (
        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  {d.cuentasVencidas} cuentas con deuda mayor a 7 días
                </p>
                <p className="text-xs text-muted-foreground">Monto total vencido</p>
              </div>
            </div>
            <span className="text-lg font-bold text-red-700 dark:text-red-400">
              {formatCurrency(d.montoVencido)}
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Reporte Mensual ──────────────────────────────────────────────────────────

function ReporteMensual() {
  const d = datosMensuales
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reporte Mensual</h2>
          <p className="text-sm text-muted-foreground">{d.mes}</p>
        </div>
        <EmailButton />
      </div>

      {/* Resumen ejecutivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Resumen Ejecutivo</CardTitle>
          <CardDescription>Comparativa vs mes anterior y mismo mes del año anterior</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Ventas Totales", value: d.resumen.ventas, deltaMA: d.vs_mes_anterior.ventas, deltaMAAA: d.vs_mismo_mes_anio_anterior.ventas },
              { label: "Cobros Totales", value: d.resumen.cobros, deltaMA: d.vs_mes_anterior.cobros, deltaMAAA: d.vs_mismo_mes_anio_anterior.cobros },
              { label: "Resultado Neto", value: d.resumen.resultadoNeto, deltaMA: d.vs_mes_anterior.resultado, deltaMAAA: d.vs_mismo_mes_anio_anterior.resultado },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-xl font-bold">{formatCurrency(item.value)}</p>
                <div className="flex gap-3 text-xs">
                  <span className={item.deltaMA >= 0 ? "text-green-600" : "text-red-600"}>
                    {item.deltaMA >= 0 ? "▲" : "▼"} {Math.abs(item.deltaMA)}% vs mes ant.
                  </span>
                  <span className={item.deltaMAAA >= 0 ? "text-green-600" : "text-red-600"}>
                    {item.deltaMAAA >= 0 ? "▲" : "▼"} {Math.abs(item.deltaMAAA)}% vs mismo mes AA
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Gastos Operativos</p>
              <p className="text-xl font-bold">{formatCurrency(d.resumen.gastos)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Margen Neto</p>
              <p className="text-xl font-bold">{d.resumen.margenNeto}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {d.kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
            </CardHeader>
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

      {/* Evolución de ventas 6 meses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Evolución de Ventas — Últimos 6 Meses</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.evolucionVentas}>
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                width={55}
              />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="cobros" name="Cobros" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top 8 clientes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Top 8 Clientes del Mes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {d.topClientes.map((c, i) => (
              <div key={c.nombre} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm truncate max-w-[160px]">{c.nombre}</span>
                </div>
                <span className="text-sm font-semibold shrink-0">{formatCurrency(c.monto)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Distribución métodos de pago */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Métodos de Pago</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={d.distribucionMetodosPago} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={28}>
                    {d.distribucionMetodosPago.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {d.distribucionMetodosPago.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[i] }} />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Rentabilidad por producto */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Rentabilidad por Producto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.rentabilidadProductos.map((p) => (
                <div key={p.producto} className="flex items-center justify-between text-sm">
                  <span>{p.producto}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.margen >= 28 ? ("default" as const) : ("secondary" as const)} className="text-xs">
                      {p.margen}%
                    </Badge>
                    <span className="text-muted-foreground w-24 text-right">{formatCurrency(p.ingresos)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ReportesEjecutivosContent() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes Ejecutivos</h1>
        <p className="text-sm text-muted-foreground">
          Resúmenes automáticos para envío por email — diario, semanal y mensual
        </p>
      </div>

      <Tabs defaultValue="diario">
        <TabsList className="grid w-full max-w-sm grid-cols-3">
          <TabsTrigger value="diario" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Diario
          </TabsTrigger>
          <TabsTrigger value="semanal" className="gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Semanal
          </TabsTrigger>
          <TabsTrigger value="mensual" className="gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" />
            Mensual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diario" className="mt-6">
          <ReporteDiario />
        </TabsContent>

        <TabsContent value="semanal" className="mt-6">
          <ReporteSemanal />
        </TabsContent>

        <TabsContent value="mensual" className="mt-6">
          <ReporteMensual />
        </TabsContent>
      </Tabs>
    </div>
  )
}
