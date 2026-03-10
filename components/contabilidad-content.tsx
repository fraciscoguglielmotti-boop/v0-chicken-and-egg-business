"use client"

import { useMemo, useState } from "react"
import { TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface Venta {
  fecha: string
  cantidad: number
  precio_unitario: number
}

interface Cobro {
  fecha: string
  monto: number
}

interface Compra {
  fecha: string
  total: number
}

interface Pago {
  fecha: string
  monto: number
}

interface Gasto {
  fecha: string
  monto: number
  categoria: string
}

export function ContabilidadContent() {
  const { data: ventas = [] } = useSupabase<Venta>("ventas")
  const { data: cobros = [] } = useSupabase<Cobro>("cobros")
  const { data: compras = [] } = useSupabase<Compra>("compras")
  const { data: pagos = [] } = useSupabase<Pago>("pagos")
  const { data: gastos = [] } = useSupabase<Gasto>("gastos")

  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [anio, setAnio] = useState(new Date().getFullYear())

  const estadisticas = useMemo(() => {
    const filtrarPorFecha = (fecha: string) => {
      const d = new Date(fecha)
      return d.getMonth() + 1 === mes && d.getFullYear() === anio
    }

    const totalVentas = ventas
      .filter(v => filtrarPorFecha(v.fecha))
      .reduce((sum, v) => sum + (v.cantidad * v.precio_unitario), 0)

    const totalCobros = cobros
      .filter(c => filtrarPorFecha(c.fecha))
      .reduce((sum, c) => sum + c.monto, 0)

    const totalCompras = compras
      .filter(c => filtrarPorFecha(c.fecha))
      .reduce((sum, c) => sum + c.total, 0)

    const totalPagos = pagos
      .filter(p => filtrarPorFecha(p.fecha))
      .reduce((sum, p) => sum + p.monto, 0)

    const totalGastos = gastos
      .filter(g => filtrarPorFecha(g.fecha))
      .reduce((sum, g) => sum + g.monto, 0)

    const egresos = totalCompras + totalGastos
    const resultadoNeto = totalVentas - egresos
    const pendienteCobro = totalVentas - totalCobros
    const pendientePago = totalCompras - totalPagos

    return {
      totalVentas,
      totalCobros,
      totalCompras,
      totalPagos,
      totalGastos,
      egresos,
      resultadoNeto,
      pendienteCobro,
      pendientePago,
    }
  }, [ventas, cobros, compras, pagos, gastos, mes, anio])

  const gastosPorCategoria = useMemo(() => {
    return gastos
      .filter(g => {
        const d = new Date(g.fecha)
        return d.getMonth() + 1 === mes && d.getFullYear() === anio
      })
      .reduce((acc, g) => {
        acc[g.categoria] = (acc[g.categoria] || 0) + g.monto
        return acc
      }, {} as Record<string, number>)
  }, [gastos, mes, anio])

  const meses = [
    { value: 1, label: "Enero" },
    { value: 2, label: "Febrero" },
    { value: 3, label: "Marzo" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Mayo" },
    { value: 6, label: "Junio" },
    { value: 7, label: "Julio" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Septiembre" },
    { value: 10, label: "Octubre" },
    { value: 11, label: "Noviembre" },
    { value: 12, label: "Diciembre" }
  ]

  const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div>
          <Label>Mes</Label>
          <Select value={mes.toString()} onValueChange={(value) => setMes(parseInt(value))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meses.map(m => (
                <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Año</Label>
          <Select value={anio.toString()} onValueChange={(value) => setAnio(parseInt(value))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anios.map(a => (
                <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ventas del período</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(estadisticas.totalVentas)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Egresos (compras + gastos)</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(estadisticas.egresos)}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Resultado Neto</p>
              <p className={`text-2xl font-bold ${estadisticas.resultadoNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(estadisticas.resultadoNeto)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pendiente de cobro</p>
              <p className="text-2xl font-bold">{formatCurrency(estadisticas.pendienteCobro)}</p>
            </div>
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Detalle de Ventas y Cobros</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ventas del período</span>
              <span className="font-medium text-green-600">{formatCurrency(estadisticas.totalVentas)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cobrado en caja</span>
              <span className="font-medium">{formatCurrency(estadisticas.totalCobros)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">Pendiente de cobro</span>
              <span className="font-bold text-orange-500">{formatCurrency(estadisticas.pendienteCobro)}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Detalle de Egresos</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Compras a proveedores</span>
              <span className="font-medium text-red-600">{formatCurrency(estadisticas.totalCompras)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gastos operativos</span>
              <span className="font-medium text-red-600">{formatCurrency(estadisticas.totalGastos)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">Total Egresos</span>
              <span className="font-bold text-red-600">{formatCurrency(estadisticas.egresos)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-muted-foreground text-sm">Pagado a proveedores</span>
              <span className="text-sm">{formatCurrency(estadisticas.totalPagos)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Pendiente de pago</span>
              <span className="text-sm text-orange-500">{formatCurrency(estadisticas.pendientePago)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Gastos por Categoria</h3>
        <div className="space-y-3">
          {Object.entries(gastosPorCategoria).map(([categoria, monto]) => (
            <div key={categoria} className="flex items-center justify-between">
              <span className="text-sm">{categoria}</span>
              <span className="font-medium">{formatCurrency(monto)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
