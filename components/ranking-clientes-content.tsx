"use client"

import { useMemo } from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, TrendingDown, Users, DollarSign, Clock, AlertCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
} from "recharts"

interface Venta {
  id: string
  cliente_nombre: string
  fecha: string
  cantidad: number
  precio_unitario: number
  producto_nombre: string
}

interface Cobro {
  id: string
  cliente_nombre: string
  fecha: string
  monto: number
}

interface Compra {
  id: string
  producto: string
  fecha: string
  precio_unitario: number
}

const CHART_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#a855f7"]

export function RankingClientesContent() {
  const { data: ventas = [] } = useSupabase<Venta>("ventas")
  const { data: cobros = [] } = useSupabase<Cobro>("cobros")
  const { data: compras = [] } = useSupabase<Compra>("compras")

  const rankings = useMemo(() => {
    const clientesMap = new Map<string, {
      nombre: string
      totalVentas: number
      totalCobrado: number
      saldoPendiente: number
      totalCajones: number
      ultimaVenta: string
      productos: Map<string, number>
      rentabilidad: number
    }>()

    // Calcular costo promedio por producto
    const costosPromedio = new Map<string, number[]>()
    compras.forEach(c => {
      if (!c.producto) return
      const key = c.producto.toLowerCase().trim()
      const existing = costosPromedio.get(key) || []
      costosPromedio.set(key, [...existing, c.precio_unitario])
    })

    const costosPromedioFinal = new Map<string, number>()
    costosPromedio.forEach((precios, producto) => {
      const promedio = precios.reduce((a, b) => a + b, 0) / precios.length
      costosPromedioFinal.set(producto, promedio)
    })

    // Procesar ventas
    ventas.forEach(v => {
      const key = v.cliente_nombre.toLowerCase().trim()
      const cliente = clientesMap.get(key) || {
        nombre: v.cliente_nombre,
        totalVentas: 0,
        totalCobrado: 0,
        saldoPendiente: 0,
        totalCajones: 0,
        ultimaVenta: v.fecha,
        productos: new Map(),
        rentabilidad: 0
      }

      const totalVenta = v.cantidad * v.precio_unitario
      const productoNombre = v.producto_nombre || 'Sin producto'
      const costoUnitario = costosPromedioFinal.get(productoNombre.toLowerCase().trim()) || 0
      const ganancia = totalVenta - (v.cantidad * costoUnitario)

      cliente.totalVentas += totalVenta
      cliente.totalCajones += v.cantidad
      cliente.rentabilidad += ganancia

      if (v.fecha > cliente.ultimaVenta) {
        cliente.ultimaVenta = v.fecha
      }

      const prodCount = cliente.productos.get(productoNombre) || 0
      cliente.productos.set(productoNombre, prodCount + v.cantidad)

      clientesMap.set(key, cliente)
    })

    // Procesar cobros
    cobros.forEach(c => {
      const key = c.cliente_nombre.toLowerCase().trim()
      const cliente = clientesMap.get(key)
      if (cliente) {
        cliente.totalCobrado += Number(c.monto)
      }
    })

    // Calcular saldo pendiente
    clientesMap.forEach(cliente => {
      cliente.saldoPendiente = cliente.totalVentas - cliente.totalCobrado
    })

    const clientesArray = Array.from(clientesMap.values())

    return {
      porVolumen: [...clientesArray].sort((a, b) => b.totalVentas - a.totalVentas).slice(0, 10),
      porCajones: [...clientesArray].sort((a, b) => b.totalCajones - a.totalCajones).slice(0, 10),
      porRentabilidad: [...clientesArray].sort((a, b) => b.rentabilidad - a.rentabilidad).slice(0, 10),
      morosos: [...clientesArray]
        .filter(c => c.saldoPendiente > 0)
        .sort((a, b) => b.saldoPendiente - a.saldoPendiente)
        .slice(0, 10),
      inactivos: [...clientesArray]
        .sort((a, b) => new Date(a.ultimaVenta).getTime() - new Date(b.ultimaVenta).getTime())
        .slice(0, 10)
    }
  }, [ventas, cobros, compras])

  const ClientCard = ({ cliente, metric, icon: Icon, color }: any) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-semibold">{cliente.nombre}</h4>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Ventas:</span>
                <span className="font-medium">{formatCurrency(cliente.totalVentas)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cajones comprados:</span>
                <span className="font-medium">{cliente.totalCajones} caj.</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ganancia generada:</span>
                <span className={`font-medium ${cliente.rentabilidad > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                  {formatCurrency(cliente.rentabilidad)}
                  {cliente.totalVentas > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({((cliente.rentabilidad / cliente.totalVentas) * 100).toFixed(1)}% margen)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Última Venta:</span>
                <span className="font-medium">{new Date(cliente.ultimaVenta).toLocaleDateString()}</span>
              </div>
              {cliente.saldoPendiente > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo Pendiente:</span>
                  <Badge variant="destructive">{formatCurrency(cliente.saldoPendiente)}</Badge>
                </div>
              )}
            </div>
          </div>
          <div className="ml-4">
            <Icon className={`h-8 w-8 ${color}`} />
            <p className="text-xs text-muted-foreground mt-1">{metric}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Ranking de Clientes</h2>
        <p className="text-muted-foreground">Análisis completo de desempeño de clientes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rankings.porVolumen.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Cliente</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{rankings.porVolumen[0]?.nombre || "-"}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(rankings.porVolumen[0]?.totalVentas || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clientes Morosos</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rankings.morosos.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {formatCurrency(rankings.morosos.reduce((sum, c) => sum + c.saldoPendiente, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="volumen" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="volumen">Por Volumen</TabsTrigger>
          <TabsTrigger value="cajones">Cajones</TabsTrigger>
          <TabsTrigger value="rentabilidad">Rentabilidad</TabsTrigger>
          <TabsTrigger value="morosos">Morosos</TabsTrigger>
          <TabsTrigger value="inactivos">Inactivos</TabsTrigger>
        </TabsList>

        <TabsContent value="volumen" className="space-y-4 mt-4">
          {rankings.porVolumen.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top 10 por Monto de Ventas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={rankings.porVolumen.map(c => ({ nombre: c.nombre.split(" ")[0], monto: Math.round(c.totalVentas) }))}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="monto" name="Total Ventas" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {rankings.porVolumen.map((cliente, idx) => (
              <ClientCard
                key={idx}
                cliente={cliente}
                metric={`#${idx + 1} en ventas`}
                icon={TrendingUp}
                color="text-green-600"
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cajones" className="space-y-4 mt-4">
          {rankings.porCajones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top 10 por Cajones Comprados</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={rankings.porCajones.map(c => ({ nombre: c.nombre.split(" ")[0], cajones: c.totalCajones }))}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip formatter={(v: number) => [`${v} caj.`, "Cajones"]} />
                    <Bar dataKey="cajones" name="Cajones" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {rankings.porCajones.map((cliente, idx) => (
              <ClientCard
                key={idx}
                cliente={cliente}
                metric={`${cliente.totalCajones} cajones`}
                icon={Clock}
                color="text-blue-600"
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rentabilidad" className="space-y-4 mt-4">
          {rankings.porRentabilidad.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top 10 por Ganancia Generada</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={rankings.porRentabilidad.map(c => ({ nombre: c.nombre.split(" ")[0], ganancia: Math.round(c.rentabilidad) }))}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="ganancia" name="Ganancia" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {rankings.porRentabilidad.map((cliente, idx) => (
              <div key={idx}>
                <ClientCard
                  cliente={cliente}
                  metric={formatCurrency(cliente.rentabilidad)}
                  icon={DollarSign}
                  color="text-yellow-600"
                />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="morosos" className="space-y-4 mt-4">
          {rankings.morosos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay clientes con saldo pendiente</p>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Distribución de Saldos Pendientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="60%" height={200}>
                      <PieChart>
                        <Pie
                          data={rankings.morosos.map(c => ({ name: c.nombre.split(" ")[0], value: Math.round(c.saldoPendiente) }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {rankings.morosos.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      {rankings.morosos.slice(0, 5).map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-muted-foreground truncate">{c.nombre.split(" ")[0]}</span>
                          <span className="ml-auto font-medium">{formatCurrency(c.saldoPendiente)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-3">
                {rankings.morosos.map((cliente, idx) => (
                  <ClientCard
                    key={idx}
                    cliente={cliente}
                    metric={`Debe: ${formatCurrency(cliente.saldoPendiente)}`}
                    icon={AlertCircle}
                    color="text-red-600"
                  />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="inactivos" className="space-y-4 mt-4">
          {rankings.inactivos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Días sin Comprar</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={rankings.inactivos.map(c => ({
                      nombre: c.nombre.split(" ")[0],
                      dias: Math.floor((Date.now() - new Date(c.ultimaVenta).getTime()) / (1000 * 60 * 60 * 24))
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="dias" name="Días sin comprar" fill="#f97316" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {rankings.inactivos.map((cliente, idx) => {
              const diasSinComprar = Math.floor((Date.now() - new Date(cliente.ultimaVenta).getTime()) / (1000 * 60 * 60 * 24))
              return (
                <ClientCard
                  key={idx}
                  cliente={cliente}
                  metric={`${diasSinComprar} días sin comprar`}
                  icon={TrendingDown}
                  color="text-orange-600"
                />
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
