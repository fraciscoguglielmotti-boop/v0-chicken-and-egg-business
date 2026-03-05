"use client"

import { useMemo } from "react"
import { Package, TrendingUp, TrendingDown } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { formatDate } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Producto {
  id: string
  nombre: string
}

interface Compra {
  id: string
  producto: string
  cantidad: number
  fecha: string
}

interface Venta {
  id: string
  producto_nombre?: string
  cantidad: number
  fecha: string
}

export function StockContent() {
  const { data: productos = [] } = useSupabase<Producto>("productos")
  const { data: compras = [] } = useSupabase<Compra>("compras")
  const { data: ventas = [] } = useSupabase<Venta>("ventas")

  const inventario = useMemo(() => {
    const stock = new Map<string, { compras: number; ventas: number; stock: number }>()

    // Inicializar productos
    productos.forEach(p => {
      stock.set(p.nombre, { compras: 0, ventas: 0, stock: 0 })
    })

    // Sumar compras
    compras.forEach(c => {
      const item = stock.get(c.producto) || { compras: 0, ventas: 0, stock: 0 }
      item.compras += c.cantidad
      item.stock += c.cantidad
      stock.set(c.producto, item)
    })

    // Restar ventas
    ventas.forEach(v => {
      if (v.producto_nombre) {
        const item = stock.get(v.producto_nombre) || { compras: 0, ventas: 0, stock: 0 }
        item.ventas += v.cantidad
        item.stock -= v.cantidad
        stock.set(v.producto_nombre, item)
      }
    })

    return Array.from(stock.entries()).map(([nombre, datos]) => ({
      producto: nombre,
      ...datos
    }))
  }, [productos, compras, ventas])

  const movimientos = useMemo(() => {
    const items: Array<{
      fecha: string
      tipo: "compra" | "venta"
      producto: string
      cantidad: number
    }> = []

    compras.forEach(c => {
      items.push({
        fecha: c.fecha,
        tipo: "compra",
        producto: c.producto,
        cantidad: c.cantidad
      })
    })

    ventas.forEach(v => {
      if (v.producto_nombre) {
        items.push({
          fecha: v.fecha,
          tipo: "venta",
          producto: v.producto_nombre,
          cantidad: v.cantidad
        })
      }
    })

    return items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [compras, ventas])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock Actual</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {inventario.map((item) => (
              <Card key={item.producto} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {item.producto}
                    </p>
                    <p className="text-3xl font-bold">
                      {item.stock}
                    </p>
                  </div>
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="mt-4 flex gap-4 text-sm">
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span>Compras: {item.compras}</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-600">
                    <TrendingDown className="h-4 w-4" />
                    <span>Ventas: {item.ventas}</span>
                  </div>
                </div>
                {item.stock < 10 && item.stock > 0 && (
                  <Badge variant="outline" className="mt-2 text-orange-600 border-orange-600">
                    Stock Bajo
                  </Badge>
                )}
                {item.stock === 0 && (
                  <Badge variant="destructive" className="mt-2">
                    Sin Stock
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="movimientos">
          <div className="rounded-lg border">
            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 text-left text-sm font-medium">Fecha</th>
                    <th className="pb-2 text-left text-sm font-medium">Tipo</th>
                    <th className="pb-2 text-left text-sm font-medium">Producto</th>
                    <th className="pb-2 text-right text-sm font-medium">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-3 text-sm">
                        {formatDate(m.fecha)}
                      </td>
                      <td className="py-3">
                        <Badge variant={m.tipo === "compra" ? "default" : "outline"}>
                          {m.tipo === "compra" ? "Compra" : "Venta"}
                        </Badge>
                      </td>
                      <td className="py-3 text-sm">{m.producto}</td>
                      <td className={`py-3 text-right text-sm font-medium ${m.tipo === "compra" ? "text-green-600" : "text-red-600"}`}>
                        {m.tipo === "compra" ? "+" : "-"}{m.cantidad}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
