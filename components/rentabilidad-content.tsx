"use client"

import { useMemo } from "react"
import { TrendingUp, Package, DollarSign } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface Venta {
  productos: { producto: string; cantidad: number }[]
  cantidad: number
  precio_unitario: number
}

interface Compra {
  producto: string
  cantidad: number
  precio_unitario: number
  total: number
}

export function RentabilidadContent() {
  const { data: ventas = [] } = useSupabase<Venta>("ventas")
  const { data: compras = [] } = useSupabase<Compra>("compras")

  const rentabilidadPorProducto = useMemo(() => {
    const productos = new Map<string, {
      cantidadVendida: number
      ingresoTotal: number
      cantidadComprada: number
      costoTotal: number
      margen: number
      porcentajeMargen: number
    }>()

    // Procesar ventas
    ventas.forEach(v => {
      if (Array.isArray(v.productos)) {
        v.productos.forEach((p: any) => {
          const key = p.producto
          const ingreso = (v.cantidad || p.cantidad) * v.precio_unitario
          const item = productos.get(key) || {
            cantidadVendida: 0,
            ingresoTotal: 0,
            cantidadComprada: 0,
            costoTotal: 0,
            margen: 0,
            porcentajeMargen: 0
          }
          item.cantidadVendida += p.cantidad || v.cantidad
          item.ingresoTotal += ingreso
          productos.set(key, item)
        })
      }
    })

    // Procesar compras
    compras.forEach(c => {
      const item = productos.get(c.producto) || {
        cantidadVendida: 0,
        ingresoTotal: 0,
        cantidadComprada: 0,
        costoTotal: 0,
        margen: 0,
        porcentajeMargen: 0
      }
      item.cantidadComprada += c.cantidad
      item.costoTotal += c.total
      productos.set(c.producto, item)
    })

    // Calcular margenes
    productos.forEach((item, key) => {
      item.margen = item.ingresoTotal - item.costoTotal
      item.porcentajeMargen = item.ingresoTotal > 0 
        ? (item.margen / item.ingresoTotal) * 100 
        : 0
      productos.set(key, item)
    })

    return Array.from(productos.entries())
      .map(([producto, datos]) => ({ producto, ...datos }))
      .sort((a, b) => b.margen - a.margen)
  }, [ventas, compras])

  const totales = useMemo(() => {
    return rentabilidadPorProducto.reduce((acc, item) => {
      acc.ingresoTotal += item.ingresoTotal
      acc.costoTotal += item.costoTotal
      acc.margenTotal += item.margen
      return acc
    }, { ingresoTotal: 0, costoTotal: 0, margenTotal: 0 })
  }, [rentabilidadPorProducto])

  const porcentajeMargenTotal = totales.ingresoTotal > 0 
    ? (totales.margenTotal / totales.ingresoTotal) * 100 
    : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ingresos Totales</p>
              <p className="text-2xl font-bold">{formatCurrency(totales.ingresoTotal)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Costos Totales</p>
              <p className="text-2xl font-bold">{formatCurrency(totales.costoTotal)}</p>
            </div>
            <Package className="h-8 w-8 text-orange-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Margen Total</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totales.margenTotal)}</p>
              <p className="text-xs text-muted-foreground mt-1">{porcentajeMargenTotal.toFixed(1)}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Rentabilidad por Producto</h3>
        <div className="space-y-4">
          {rentabilidadPorProducto.map((item) => (
            <div key={item.producto} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{item.producto}</h4>
                <Badge variant={item.margen > 0 ? "default" : "destructive"}>
                  {item.porcentajeMargen.toFixed(1)}% margen
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Vendido</p>
                  <p className="font-medium">{item.cantidadVendida} unidades</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ingresos</p>
                  <p className="font-medium text-green-600">{formatCurrency(item.ingresoTotal)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Costos</p>
                  <p className="font-medium text-orange-600">{formatCurrency(item.costoTotal)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Margen</p>
                  <p className={`font-medium ${item.margen > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(item.margen)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
