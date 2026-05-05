"use client"

import { useMemo, useState } from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, TrendingDown, Users, DollarSign, Clock, AlertCircle, ChevronDown, ChevronRight } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { buildCostTimeline, getCostAtDate } from "@/lib/cost-timeline"

interface Venta {
  id: string
  cliente_nombre: string
  fecha: string
  cantidad: number
  precio_unitario: number
  producto_nombre?: string
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
  cantidad: number
  total: number
}

interface VentaDetalle {
  id: string
  fecha: string
  producto: string
  cantidad: number
  precio: number
  costo: number
  ganancia: number
}

interface ClienteData {
  nombre: string
  totalVentas: number
  totalCobrado: number
  saldoPendiente: number
  totalCajones: number
  ultimaVenta: string
  productos: Map<string, number>
  rentabilidad: number
  ventasDetalle: VentaDetalle[]
}

const CHART_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#a855f7"]

function ClientCard({ cliente, metric, icon: Icon, color }: { cliente: ClienteData; metric: string; icon: React.ElementType; color: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
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
                <span className="font-medium">{new Date(cliente.ultimaVenta + "T12:00:00").toLocaleDateString()}</span>
              </div>
              {cliente.saldoPendiente > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo Pendiente:</span>
                  <Badge variant="destructive">{formatCurrency(cliente.saldoPendiente)}</Badge>
                </div>
              )}

              {cliente.ventasDetalle.length > 0 && (
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 pt-1 transition-colors"
                  onClick={() => setExpanded(v => !v)}
                >
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Desglose por operación ({cliente.ventasDetalle.length})
                </button>
              )}

              {expanded && (
                <div className="mt-2 rounded-lg border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fecha</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Producto</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Caj.</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Precio</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Costo</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Ganancia</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cliente.ventasDetalle.map((v, i) => {
                        const pct = v.precio > 0 ? ((v.ganancia / (v.cantidad * v.precio)) * 100) : 0
                        return (
                          <tr key={v.id || i} className="border-t hover:bg-muted/30">
                            <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                              {new Date(v.fecha + "T12:00:00").toLocaleDateString()}
                            </td>
                            <td className="px-3 py-1.5 max-w-[120px] truncate">{v.producto}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{v.cantidad}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(v.precio)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                              {v.costo > 0 ? formatCurrency(v.costo) : <span className="text-amber-500">s/d</span>}
                            </td>
                            <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${v.costo === 0 ? "text-amber-500" : v.ganancia >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {v.costo > 0 ? formatCurrency(v.ganancia) : "—"}
                            </td>
                            <td className={`px-3 py-1.5 text-right tabular-nums ${v.costo === 0 ? "text-amber-500" : pct >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {v.costo > 0 ? `${pct.toFixed(1)}%` : "—"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-muted/30 border-t">
                      <tr>
                        <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold">Total</td>
                        <td className={`px-3 py-1.5 text-right tabular-nums text-xs font-semibold ${cliente.rentabilidad >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(cliente.rentabilidad)}
                        </td>
                        <td className={`px-3 py-1.5 text-right tabular-nums text-xs font-semibold ${cliente.totalVentas > 0 && (cliente.rentabilidad / cliente.totalVentas) >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {cliente.totalVentas > 0 ? `${((cliente.rentabilidad / cliente.totalVentas) * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
          <div className="ml-4 shrink-0">
            <Icon className={`h-8 w-8 ${color}`} />
            <p className="text-xs text-muted-foreground mt-1 text-right">{metric}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RankingClientesContent() {
  const { data: ventas = [] } = useSupabase<Venta>("ventas")
  const { data: cobros = [] } = useSupabase<Cobro>("cobros")
  const { data: compras = [] } = useSupabase<Compra>("compras")

  const rankings = useMemo(() => {
    const costTimeline = buildCostTimeline(compras)

    const clientesMap = new Map<string, ClienteData>()

    ventas.forEach(v => {
      const key = v.cliente_nombre.toLowerCase().trim()
      const cliente: ClienteData = clientesMap.get(key) ?? {
        nombre: v.cliente_nombre,
        totalVentas: 0,
        totalCobrado: 0,
        saldoPendiente: 0,
        totalCajones: 0,
        ultimaVenta: v.fecha,
        productos: new Map(),
        rentabilidad: 0,
        ventasDetalle: [],
      }

      const total = v.cantidad * v.precio_unitario
      const producto = v.producto_nombre || "Sin producto"
      const costo = getCostAtDate(producto, v.fecha, costTimeline)
      const ganancia = costo > 0 ? total - (v.cantidad * costo) : 0

      cliente.totalVentas += total
      cliente.totalCajones += v.cantidad
      cliente.rentabilidad += ganancia
      if (v.fecha > cliente.ultimaVenta) cliente.ultimaVenta = v.fecha

      const prodCount = cliente.productos.get(producto) || 0
      cliente.productos.set(producto, prodCount + v.cantidad)

      cliente.ventasDetalle.push({
        id: v.id,
        fecha: v.fecha.slice(0, 10),
        producto,
        cantidad: v.cantidad,
        precio: v.precio_unitario,
        costo,
        ganancia,
      })

      clientesMap.set(key, cliente)
    })

    // Ordenar detalles por fecha DESC
    clientesMap.forEach(c => {
      c.ventasDetalle.sort((a, b) => b.fecha.localeCompare(a.fecha))
    })

    cobros.forEach(c => {
      const cliente = clientesMap.get(c.cliente_nombre.toLowerCase().trim())
      if (cliente) cliente.totalCobrado += Number(c.monto)
    })

    clientesMap.forEach(c => { c.saldoPendiente = c.totalVentas - c.totalCobrado })

    // Productos sin costo registrado
    const productosEnVentas = new Set<string>()
    ventas.forEach(v => { if (v.producto_nombre) productosEnVentas.add(v.producto_nombre) })
    const productosSinCosto = Array.from(productosEnVentas).filter(p =>
      getCostAtDate(p, new Date().toISOString().slice(0, 10), costTimeline) === 0
    )

    const arr = Array.from(clientesMap.values())
    return {
      productosSinCosto,
      porVolumen:      [...arr].sort((a, b) => b.totalVentas - a.totalVentas).slice(0, 10),
      porCajones:      [...arr].sort((a, b) => b.totalCajones - a.totalCajones).slice(0, 10),
      porRentabilidad: [...arr].sort((a, b) => b.rentabilidad - a.rentabilidad).slice(0, 10),
      morosos:         [...arr].filter(c => c.saldoPendiente > 0).sort((a, b) => b.saldoPendiente - a.saldoPendiente).slice(0, 10),
      inactivos:       [...arr].sort((a, b) => new Date(a.ultimaVenta).getTime() - new Date(b.ultimaVenta).getTime()).slice(0, 10),
    }
  }, [ventas, cobros, compras])

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
              {formatCurrency(rankings.morosos.reduce((s, c) => s + c.saldoPendiente, 0))}
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
              <CardHeader><CardTitle className="text-sm font-medium">Top 10 por Monto de Ventas</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={rankings.porVolumen.map(c => ({ nombre: c.nombre.split(" ")[0], monto: Math.round(c.totalVentas) }))} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="monto" name="Total Ventas" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {rankings.porVolumen.map((cliente, idx) => (
              <ClientCard key={cliente.nombre} cliente={cliente} metric={`#${idx + 1} en ventas`} icon={TrendingUp} color="text-green-600" />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cajones" className="space-y-4 mt-4">
          {rankings.porCajones.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Top 10 por Cajones Comprados</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={rankings.porCajones.map(c => ({ nombre: c.nombre.split(" ")[0], cajones: c.totalCajones }))} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
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
              <ClientCard key={cliente.nombre} cliente={cliente} metric={`${cliente.totalCajones} cajones`} icon={Clock} color="text-blue-600" />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rentabilidad" className="space-y-4 mt-4">
          {rankings.productosSinCosto.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">Productos sin compra registrada — ganancia no calculable</p>
              <p className="text-amber-600 dark:text-amber-500 text-xs">
                <span className="font-mono">{rankings.productosSinCosto.join(", ")}</span>
              </p>
              <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                Verificá que el nombre en Ventas coincida exactamente con el de Compras.
              </p>
            </div>
          )}
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-2 text-xs text-blue-600 dark:text-blue-400">
            La ganancia se calcula usando el costo de compra vigente al momento de cada venta (no el precio actual).
          </div>
          {rankings.porRentabilidad.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Top 10 por Ganancia Generada</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={rankings.porRentabilidad.map(c => ({ nombre: c.nombre.split(" ")[0], ganancia: Math.round(c.rentabilidad) }))} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="ganancia" name="Ganancia" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {rankings.porRentabilidad.map((cliente) => (
              <ClientCard key={cliente.nombre} cliente={cliente} metric={formatCurrency(cliente.rentabilidad)} icon={DollarSign} color="text-yellow-600" />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="morosos" className="space-y-4 mt-4">
          {rankings.morosos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay clientes con saldo pendiente</p>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-sm font-medium">Distribución de Saldos Pendientes</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="60%" height={200}>
                      <PieChart>
                        <Pie data={rankings.morosos.map(c => ({ name: c.nombre.split(" ")[0], value: Math.round(c.saldoPendiente) }))} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value">
                          {rankings.morosos.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
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
                {rankings.morosos.map(cliente => (
                  <ClientCard key={cliente.nombre} cliente={cliente} metric={`Debe: ${formatCurrency(cliente.saldoPendiente)}`} icon={AlertCircle} color="text-red-600" />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="inactivos" className="space-y-4 mt-4">
          {rankings.inactivos.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Días sin Comprar</CardTitle></CardHeader>
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
            {rankings.inactivos.map(cliente => {
              const dias = Math.floor((Date.now() - new Date(cliente.ultimaVenta).getTime()) / (1000 * 60 * 60 * 24))
              return <ClientCard key={cliente.nombre} cliente={cliente} metric={`${dias} días sin comprar`} icon={TrendingDown} color="text-orange-600" />
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
