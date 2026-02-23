"use client"

import { useMemo } from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, TrendingDown, Users, DollarSign, Clock, AlertCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
  producto_nombre: string
  fecha: string
  precio_unitario: number
}

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
      cantidadVentas: number
      ultimaVenta: string
      productos: Map<string, number>
      rentabilidad: number
    }>()

    // Calcular costo promedio por producto
    const costosPromedio = new Map<string, number[]>()
    compras.forEach(c => {
      if (!c.producto_nombre) return // Skip compras sin producto
      const key = c.producto_nombre.toLowerCase().trim()
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
        cantidadVentas: 0,
        ultimaVenta: v.fecha,
        productos: new Map(),
        rentabilidad: 0
      }

      const totalVenta = v.cantidad * v.precio_unitario
      const productoNombre = v.producto_nombre || 'Sin producto'
      const costoUnitario = costosPromedioFinal.get(productoNombre.toLowerCase().trim()) || 0
      const ganancia = totalVenta - (v.cantidad * costoUnitario)

      cliente.totalVentas += totalVenta
      cliente.cantidadVentas += 1
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
      porFrecuencia: [...clientesArray].sort((a, b) => b.cantidadVentas - a.cantidadVentas).slice(0, 10),
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
                <span className="text-muted-foreground">Cantidad Ventas:</span>
                <span className="font-medium">{cliente.cantidadVentas}</span>
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
          <TabsTrigger value="frecuencia">Frecuencia</TabsTrigger>
          <TabsTrigger value="rentabilidad">Rentabilidad</TabsTrigger>
          <TabsTrigger value="morosos">Morosos</TabsTrigger>
          <TabsTrigger value="inactivos">Inactivos</TabsTrigger>
        </TabsList>

        <TabsContent value="volumen" className="space-y-3 mt-4">
          {rankings.porVolumen.map((cliente, idx) => (
            <ClientCard 
              key={idx} 
              cliente={cliente} 
              metric={`#${idx + 1} en ventas`}
              icon={TrendingUp}
              color="text-green-600"
            />
          ))}
        </TabsContent>

        <TabsContent value="frecuencia" className="space-y-3 mt-4">
          {rankings.porFrecuencia.map((cliente, idx) => (
            <ClientCard 
              key={idx} 
              cliente={cliente} 
              metric={`${cliente.cantidadVentas} compras`}
              icon={Clock}
              color="text-blue-600"
            />
          ))}
        </TabsContent>

        <TabsContent value="rentabilidad" className="space-y-3 mt-4">
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
        </TabsContent>

        <TabsContent value="morosos" className="space-y-3 mt-4">
          {rankings.morosos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay clientes con saldo pendiente</p>
          ) : (
            rankings.morosos.map((cliente, idx) => (
              <ClientCard 
                key={idx} 
                cliente={cliente} 
                metric={`Debe: ${formatCurrency(cliente.saldoPendiente)}`}
                icon={AlertCircle}
                color="text-red-600"
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="inactivos" className="space-y-3 mt-4">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
