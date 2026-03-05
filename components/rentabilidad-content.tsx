"use client"

import { useMemo, useState } from "react"
import { TrendingUp, Package, DollarSign, Minus } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Venta {
  fecha: string
  producto_nombre: string
  cantidad: number
  precio_unitario: number
}

interface Compra {
  fecha: string
  producto: string
  cantidad: number
  precio_unitario: number
  total: number
}

interface Gasto {
  fecha: string
  monto: number
  categoria: string
}

export function RentabilidadContent() {
  const { data: ventas = [] } = useSupabase<Venta>("ventas")
  const { data: compras = [] } = useSupabase<Compra>("compras")
  const { data: gastos = [] } = useSupabase<Gasto>("gastos")

  const hoy = new Date()
  const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`
  const hoyStr = hoy.toISOString().split("T")[0]

  const [desde, setDesde] = useState(primerDiaMes)
  const [hasta, setHasta] = useState(hoyStr)

  const enPeriodo = (fecha: string) => (!desde || fecha >= desde) && (!hasta || fecha <= hasta)

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
    ventas.filter(v => enPeriodo(v.fecha)).forEach(v => {
      if (!v.producto_nombre) return
      const key = v.producto_nombre
      const ingreso = v.cantidad * v.precio_unitario
      const item = productos.get(key) || {
        cantidadVendida: 0,
        ingresoTotal: 0,
        cantidadComprada: 0,
        costoTotal: 0,
        margen: 0,
        porcentajeMargen: 0
      }
      item.cantidadVendida += v.cantidad
      item.ingresoTotal += ingreso
      productos.set(key, item)
    })

    // Procesar compras
    compras.filter(c => enPeriodo(c.fecha)).forEach(c => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventas, compras, desde, hasta])

  const totales = useMemo(() => {
    return rentabilidadPorProducto.reduce((acc, item) => {
      acc.ingresoTotal += item.ingresoTotal
      acc.costoTotal += item.costoTotal
      acc.margenTotal += item.margen
      return acc
    }, { ingresoTotal: 0, costoTotal: 0, margenTotal: 0 })
  }, [rentabilidadPorProducto])

  const totalGastos = useMemo(() => {
    return gastos
      .filter(g => enPeriodo(g.fecha))
      .reduce((sum, g) => sum + g.monto, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gastos, desde, hasta])

  const resultadoBruto = totales.margenTotal
  const resultadoNeto = resultadoBruto - totalGastos
  const porcentajeMargenTotal = totales.ingresoTotal > 0
    ? (totales.margenTotal / totales.ingresoTotal) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* Filtro de período */}
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

      {/* Estado de Resultados */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Estado de Resultados</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Ventas</span>
            <span className="font-medium">{formatCurrency(totales.ingresoTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">− Costo de mercadería (compras)</span>
            <span className="font-medium text-orange-600">− {formatCurrency(totales.costoTotal)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-3">
            <span>Resultado Bruto</span>
            <span className={resultadoBruto >= 0 ? "text-green-600" : "text-red-600"}>
              {formatCurrency(resultadoBruto)}
              <span className="text-xs font-normal text-muted-foreground ml-2">({porcentajeMargenTotal.toFixed(1)}%)</span>
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">− Gastos operativos</span>
            <span className="font-medium text-orange-600">− {formatCurrency(totalGastos)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-3">
            <span>Resultado Neto</span>
            <span className={resultadoNeto >= 0 ? "text-green-600" : "text-red-600"}>
              {formatCurrency(resultadoNeto)}
            </span>
          </div>
        </div>
      </Card>

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
