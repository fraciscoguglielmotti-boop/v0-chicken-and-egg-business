"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Package, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

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

interface StockData {
  productos: Producto[]
  compras: Compra[]
  ventas: Venta[]
}

const fetcher = async (url: string): Promise<StockData> => {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error ?? "Error al cargar stock")
  }
  return res.json()
}

export function StockContent() {
  const { data, isLoading, error } = useSWR<StockData>("/api/stock/data", fetcher, {
    revalidateOnFocus: false,
  })
  const productos = data?.productos ?? []
  const compras = data?.compras ?? []
  const ventas = data?.ventas ?? []

  const [filtroProducto, setFiltroProducto] = useState<string>("todos")

  const inventario = useMemo(() => {
    const stock = new Map<string, { compras: number; ventas: number; stock: number }>()

    productos.forEach(p => {
      stock.set(p.nombre, { compras: 0, ventas: 0, stock: 0 })
    })

    compras.forEach(c => {
      const item = stock.get(c.producto) || { compras: 0, ventas: 0, stock: 0 }
      item.compras += c.cantidad
      item.stock += c.cantidad
      stock.set(c.producto, item)
    })

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

  // Todos los movimientos ordenados por fecha ASC (para calcular saldo acumulado)
  const movimientos = useMemo(() => {
    const items: Array<{
      fecha: string
      tipo: "compra" | "venta"
      producto: string
      cantidad: number
    }> = []

    compras.forEach(c => items.push({ fecha: c.fecha, tipo: "compra", producto: c.producto, cantidad: c.cantidad }))
    ventas.forEach(v => {
      if (v.producto_nombre) items.push({ fecha: v.fecha, tipo: "venta", producto: v.producto_nombre, cantidad: v.cantidad })
    })

    return items.sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [compras, ventas])

  // Productos únicos para el filtro
  const productosUnicos = useMemo(() => {
    const nombres = new Set<string>()
    movimientos.forEach(m => nombres.add(m.producto))
    return Array.from(nombres).sort()
  }, [movimientos])

  // Movimientos filtrados con saldo acumulado
  const movimientosFiltrados = useMemo(() => {
    const filtrados = filtroProducto === "todos"
      ? movimientos
      : movimientos.filter(m => m.producto === filtroProducto)

    let saldo = 0
    return filtrados
      .map(m => {
        saldo += m.tipo === "compra" ? m.cantidad : -m.cantidad
        return { ...m, saldo }
      })
      .reverse() // más reciente primero para mostrar
  }, [movimientos, filtroProducto])

  // Saldo por día (para detectar días con discrepancia entre compras y ventas)
  const balancePorDia = useMemo(() => {
    if (filtroProducto === "todos") return []

    const porDia = new Map<string, { compras: number; ventas: number }>()
    movimientos
      .filter(m => m.producto === filtroProducto)
      .forEach(m => {
        const dia = m.fecha.slice(0, 10)
        const prev = porDia.get(dia) || { compras: 0, ventas: 0 }
        if (m.tipo === "compra") prev.compras += m.cantidad
        else prev.ventas += m.cantidad
        porDia.set(dia, prev)
      })

    let saldoAcum = 0
    return Array.from(porDia.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, { compras, ventas }]) => {
        saldoAcum += compras - ventas
        return { fecha, compras, ventas, neto: compras - ventas, saldoAcum }
      })
      .reverse()
  }, [movimientos, filtroProducto])

  if (error) {
    return (
      <Card className="p-6 border-destructive/50 bg-destructive/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">No se pudo cargar el stock</p>
            <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
          </div>
        </div>
      </Card>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock Actual</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="balance">Balance por Día</TabsTrigger>
        </TabsList>

        {/* ── STOCK ACTUAL ─── */}
        <TabsContent value="stock">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {inventario.map((item) => (
              <Card key={item.producto} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{item.producto}</p>
                    <p className="text-3xl font-bold">{item.stock}</p>
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
                  <Badge variant="outline" className="mt-2 text-orange-600 border-orange-600">Stock Bajo</Badge>
                )}
                {item.stock === 0 && (
                  <Badge variant="destructive" className="mt-2">Sin Stock</Badge>
                )}
                {item.stock !== 0 && item.stock > 0 && item.stock < 3 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    Revisá los movimientos
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── MOVIMIENTOS ─── */}
        <TabsContent value="movimientos" className="space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs">Filtrar por producto</Label>
              <Select value={filtroProducto} onValueChange={setFiltroProducto}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {productosUnicos.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filtroProducto !== "todos" && (
              <p className="text-xs text-muted-foreground mb-1">
                {movimientosFiltrados.length} movimientos · Saldo actual:{" "}
                <span className="font-semibold">
                  {movimientosFiltrados.length > 0 ? movimientosFiltrados[0].saldo : 0} cajones
                </span>
              </p>
            )}
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-semibold">Fecha</th>
                  <th className="p-3 text-left font-semibold">Tipo</th>
                  <th className="p-3 text-left font-semibold">Producto</th>
                  <th className="p-3 text-right font-semibold">Cantidad</th>
                  {filtroProducto !== "todos" && (
                    <th className="p-3 text-right font-semibold">Saldo acum.</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map((m, i) => (
                  <tr
                    key={i}
                    className={`border-t ${m.saldo < 0 ? "bg-red-50 dark:bg-red-950/20" : "hover:bg-muted/20"}`}
                  >
                    <td className="p-3 text-muted-foreground">{formatDate(m.fecha)}</td>
                    <td className="p-3">
                      <Badge variant={m.tipo === "compra" ? "default" : "outline"}>
                        {m.tipo === "compra" ? "Compra" : "Venta"}
                      </Badge>
                    </td>
                    <td className="p-3">{m.producto}</td>
                    <td className={`p-3 text-right font-medium ${m.tipo === "compra" ? "text-green-600" : "text-red-600"}`}>
                      {m.tipo === "compra" ? "+" : "-"}{m.cantidad}
                    </td>
                    {filtroProducto !== "todos" && (
                      <td className={`p-3 text-right font-bold ${m.saldo < 0 ? "text-red-600" : m.saldo === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                        {m.saldo}
                      </td>
                    )}
                  </tr>
                ))}
                {movimientosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">No hay movimientos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── BALANCE POR DÍA ─── */}
        <TabsContent value="balance" className="space-y-4">
          <div>
            <Label className="text-xs">Producto</Label>
            <Select
              value={filtroProducto === "todos" ? "" : filtroProducto}
              onValueChange={setFiltroProducto}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Seleccioná un producto" />
              </SelectTrigger>
              <SelectContent>
                {productosUnicos.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtroProducto === "todos" ? (
            <p className="text-sm text-muted-foreground">Seleccioná un producto para ver el balance diario.</p>
          ) : balancePorDia.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos para {filtroProducto}.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-semibold">Fecha</th>
                    <th className="p-3 text-right font-semibold text-green-700">Compras</th>
                    <th className="p-3 text-right font-semibold text-red-600">Ventas</th>
                    <th className="p-3 text-right font-semibold">Neto del día</th>
                    <th className="p-3 text-right font-semibold">Saldo acum.</th>
                  </tr>
                </thead>
                <tbody>
                  {balancePorDia.map((d, i) => {
                    const anomalia = d.neto !== 0 && d.compras > 0 && d.ventas > 0 && d.neto !== 0
                    const sobrante = d.compras > 0 && d.ventas === 0
                    const sinCubrir = d.ventas > 0 && d.compras === 0
                    return (
                      <tr
                        key={i}
                        className={`border-t ${
                          d.saldoAcum < 0 ? "bg-red-50 dark:bg-red-950/20" :
                          anomalia ? "bg-amber-50 dark:bg-amber-950/20" :
                          sobrante ? "bg-blue-50/50 dark:bg-blue-950/10" :
                          "hover:bg-muted/20"
                        }`}
                      >
                        <td className="p-3 font-medium">
                          {formatDate(new Date(d.fecha + "T12:00:00"))}
                          {anomalia && <span className="ml-2 text-xs text-amber-600 font-normal">diferencial</span>}
                          {sobrante && <span className="ml-2 text-xs text-blue-600 font-normal">solo compra</span>}
                          {sinCubrir && <span className="ml-2 text-xs text-red-600 font-normal">venta sin compra</span>}
                        </td>
                        <td className="p-3 text-right text-green-700 font-medium">
                          {d.compras > 0 ? `+${d.compras}` : "—"}
                        </td>
                        <td className="p-3 text-right text-red-600 font-medium">
                          {d.ventas > 0 ? `-${d.ventas}` : "—"}
                        </td>
                        <td className={`p-3 text-right font-bold ${d.neto > 0 ? "text-blue-600" : d.neto < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                          {d.neto > 0 ? `+${d.neto}` : d.neto === 0 ? "0" : d.neto}
                        </td>
                        <td className={`p-3 text-right font-bold ${d.saldoAcum < 0 ? "text-red-600" : d.saldoAcum === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                          {d.saldoAcum}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtroProducto !== "todos" && balancePorDia.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Los días en <span className="text-amber-600 font-medium">amarillo</span> tienen más compras que ventas (o viceversa).
              Los días en <span className="text-blue-600 font-medium">azul</span> solo tienen compra registrada.
              El saldo acumulado final debería ser 0 si todo está cuadrado.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
