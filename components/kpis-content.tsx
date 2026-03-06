"use client"

import { useMemo } from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { useBalanceVisibility } from "@/contexts/balance-visibility"
import { TrendingUp, TrendingDown, Percent, Users, Clock, DollarSign } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts"

interface Venta {
  id: string
  fecha: string
  cliente_nombre: string
  vendedor?: string
  cantidad: number
  precio_unitario: number
}

interface Cobro {
  id: string
  fecha: string
  cliente_nombre: string
  monto: number
  metodo_pago?: string
}

interface Compra {
  id: string
  fecha: string
  precio_unitario: number
  cantidad?: number
}

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  trend?: number
  trendLabel?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{trend >= 0 ? "+" : ""}{trend.toFixed(1)}% {trendLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function KpisContent() {
  const { data: ventas = [] } = useSupabase<Venta>("ventas")
  const { data: cobros = [] } = useSupabase<Cobro>("cobros")
  const { data: compras = [] } = useSupabase<Compra>("compras")
  const { data: clientes = [] } = useSupabase<{ id: string; nombre: string }>("clientes")
  const { hidden } = useBalanceVisibility()

  const kpis = useMemo(() => {
    const now = new Date()
    const mesActual = now.getMonth()
    const añoActual = now.getFullYear()
    const mesAnterior = mesActual === 0 ? 11 : mesActual - 1
    const añoMesAnterior = mesActual === 0 ? añoActual - 1 : añoActual

    const totalVentas = ventas.reduce((acc, v) => acc + v.cantidad * v.precio_unitario, 0)
    const totalCobros = cobros.reduce((acc, c) => acc + Number(c.monto), 0)
    const totalCompras = compras.reduce((acc, c) => acc + Number(c.precio_unitario) * (c.cantidad ?? 1), 0)

    // Ticket Promedio
    const ticketPromedio = ventas.length > 0 ? totalVentas / ventas.length : 0

    // Tasa de Cobro
    const tasaCobro = totalVentas > 0 ? (totalCobros / totalVentas) * 100 : 0

    // Margen Bruto
    const margenBruto = totalVentas > 0 ? ((totalVentas - totalCompras) / totalVentas) * 100 : 0

    // Tasa de Morosidad (clientes con saldo > 0)
    const clientesSaldos = new Map<string, number>()
    ventas.forEach(v => {
      const key = v.cliente_nombre.toLowerCase().trim()
      clientesSaldos.set(key, (clientesSaldos.get(key) || 0) + v.cantidad * v.precio_unitario)
    })
    cobros.forEach(c => {
      const key = c.cliente_nombre.toLowerCase().trim()
      clientesSaldos.set(key, (clientesSaldos.get(key) || 0) - Number(c.monto))
    })
    const clientesConDeuda = Array.from(clientesSaldos.values()).filter(s => s > 0).length
    const totalClientesActivos = clientesSaldos.size
    const tasaMorosidad = totalClientesActivos > 0 ? (clientesConDeuda / totalClientesActivos) * 100 : 0

    // Crecimiento Mensual
    const ventasMesActual = ventas
      .filter(v => { const f = new Date(v.fecha); return f.getMonth() === mesActual && f.getFullYear() === añoActual })
      .reduce((acc, v) => acc + v.cantidad * v.precio_unitario, 0)
    const ventasMesAnterior = ventas
      .filter(v => { const f = new Date(v.fecha); return f.getMonth() === mesAnterior && f.getFullYear() === añoMesAnterior })
      .reduce((acc, v) => acc + v.cantidad * v.precio_unitario, 0)
    const crecimientoMensual = ventasMesAnterior > 0 ? ((ventasMesActual - ventasMesAnterior) / ventasMesAnterior) * 100 : 0

    // Días Promedio de Cobro (approx: usando fecha de cobro vs promedio de ventas)
    let sumasDias = 0
    let countDias = 0
    cobros.forEach(cobro => {
      const ventasCliente = ventas.filter(v => v.cliente_nombre.toLowerCase().trim() === cobro.cliente_nombre.toLowerCase().trim())
      if (ventasCliente.length === 0) return
      const avgVentaDate = ventasCliente.reduce((acc, v) => acc + new Date(v.fecha).getTime(), 0) / ventasCliente.length
      const dias = (new Date(cobro.fecha).getTime() - avgVentaDate) / (1000 * 60 * 60 * 24)
      if (dias >= 0) { sumasDias += dias; countDias++ }
    })
    const diasPromCobro = countDias > 0 ? Math.round(sumasDias / countDias) : 0

    return { ticketPromedio, tasaCobro, margenBruto, tasaMorosidad, crecimientoMensual, diasPromCobro, ventasMesActual, ventasMesAnterior }
  }, [ventas, cobros, compras, clientes])

  // Últimos 6 meses de ventas vs cobros
  const ventasCobrosChart = useMemo(() => {
    const months: { label: string; ventas: number; cobros: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const mes = d.getMonth()
      const año = d.getFullYear()
      const label = d.toLocaleString("es-AR", { month: "short" })
      const totalV = ventas.filter(v => { const f = new Date(v.fecha); return f.getMonth() === mes && f.getFullYear() === año })
        .reduce((acc, v) => acc + v.cantidad * v.precio_unitario, 0)
      const totalC = cobros.filter(c => { const f = new Date(c.fecha); return f.getMonth() === mes && f.getFullYear() === año })
        .reduce((acc, c) => acc + Number(c.monto), 0)
      months.push({ label, ventas: Math.round(totalV), cobros: Math.round(totalC) })
    }
    return months
  }, [ventas, cobros])

  // Top 5 vendedores
  const vendedoresChart = useMemo(() => {
    const map = new Map<string, number>()
    ventas.forEach(v => {
      const nombre = v.vendedor || "Sin asignar"
      map.set(nombre, (map.get(nombre) || 0) + v.cantidad * v.precio_unitario)
    })
    return Array.from(map.entries())
      .map(([nombre, total]) => ({ nombre, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [ventas])

  // Distribución métodos de pago
  const metodosChart = useMemo(() => {
    const map = new Map<string, number>()
    cobros.forEach(c => {
      const metodo = c.metodo_pago || "Otro"
      map.set(metodo, (map.get(metodo) || 0) + Number(c.monto))
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }))
  }, [cobros])

  // Ticket promedio mensual (LineChart)
  const ticketMensualChart = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const mes = d.getMonth()
      const año = d.getFullYear()
      const label = d.toLocaleString("es-AR", { month: "short" })
      const ventasMes = ventas.filter(v => { const f = new Date(v.fecha); return f.getMonth() === mes && f.getFullYear() === año })
      const total = ventasMes.reduce((acc, v) => acc + v.cantidad * v.precio_unitario, 0)
      const ticket = ventasMes.length > 0 ? Math.round(total / ventasMes.length) : 0
      return { label, ticket }
    })
  }, [ventas])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">KPIs Ejecutivos</h2>
        <p className="text-muted-foreground">Métricas clave de desempeño del negocio</p>
      </div>

      {/* KPI Cards 2x3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title="Ticket Promedio"
          value={hidden ? "••••••" : formatCurrency(kpis.ticketPromedio)}
          subtitle="Por venta registrada"
          icon={DollarSign}
        />
        <KpiCard
          title="Tasa de Cobro"
          value={`${kpis.tasaCobro.toFixed(1)}%`}
          subtitle="Cobrado vs vendido"
          icon={Percent}
        />
        <KpiCard
          title="Margen Bruto"
          value={`${kpis.margenBruto.toFixed(1)}%`}
          subtitle="(Ventas − Compras) / Ventas"
          icon={TrendingUp}
        />
        <KpiCard
          title="Tasa de Morosidad"
          value={`${kpis.tasaMorosidad.toFixed(1)}%`}
          subtitle="Clientes con saldo pendiente"
          icon={Users}
        />
        <KpiCard
          title="Crecimiento Mensual"
          value={`${kpis.crecimientoMensual >= 0 ? "+" : ""}${kpis.crecimientoMensual.toFixed(1)}%`}
          subtitle="vs mes anterior"
          icon={TrendingUp}
          trend={kpis.crecimientoMensual}
          trendLabel="vs mes anterior"
        />
        <KpiCard
          title="Días Prom. de Cobro"
          value={`${kpis.diasPromCobro} días`}
          subtitle="Entre venta y cobro"
          icon={Clock}
        />
      </div>

      {/* Charts 2x2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas vs Cobros por mes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas vs Cobros (últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ventasCobrosChart} margin={{ top: 4, right: 12, left: 10, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={48} />
                <Tooltip formatter={(value: number) => hidden ? "••••••" : formatCurrency(value)} />
                <Legend />
                <Bar dataKey="ventas" name="Ventas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cobros" name="Cobros" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top 5 vendedores */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 Vendedores</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            {vendedoresChart.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Sin datos de vendedores</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={vendedoresChart} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={48} />
                  <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(value: number) => hidden ? "••••••" : formatCurrency(value)} />
                  <Bar dataKey="total" name="Total Vendido" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Distribución métodos de pago */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Métodos de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            {metodosChart.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Sin datos de cobros</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-full sm:w-[55%] shrink-0">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={metodosChart} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" nameKey="name">
                        {metodosChart.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => hidden ? "••••••" : formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2 w-full sm:w-auto">
                  {metodosChart.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground capitalize">{entry.name}</span>
                      <span className="ml-auto font-medium">{hidden ? "••••••" : formatCurrency(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket promedio mensual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolución Ticket Promedio</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ticketMensualChart} margin={{ top: 4, right: 12, left: 10, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={48} />
                <Tooltip formatter={(value: number) => hidden ? "••••••" : formatCurrency(value)} />
                <Line type="monotone" dataKey="ticket" name="Ticket Prom." stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
