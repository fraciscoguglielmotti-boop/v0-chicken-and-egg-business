"use client"

import { useMemo, useState } from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDownCircle, ArrowUpCircle, TrendingDown, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface Venta { id: string; cantidad: number; precio_unitario: number; fecha: string }
interface Cobro { id: string; monto: number; metodo_pago: string; fecha: string }
interface Compra { id: string; cantidad: number; precio_unitario: number; fecha: string }
interface Pago { id: string; monto: number; fecha: string }
interface Gasto { id: string; monto: number; categoria: string; fecha: string }

export function FlujoContent() {
  const { data: ventas = [] } = useSupabase<Venta>("ventas")
  const { data: cobros = [] } = useSupabase<Cobro>("cobros")
  const { data: compras = [] } = useSupabase<Compra>("compras")
  const { data: pagos = [] } = useSupabase<Pago>("pagos")
  const { data: gastos = [] } = useSupabase<Gasto>("gastos")

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

  const flujoMensual = useMemo(() => {
    const ingresos = {
      cobrosEfectivo: 0,
      cobrosTransferencia: 0,
      total: 0
    }
    const egresos = {
      pagos: 0,
      gastos: 0,
      total: 0
    }

    cobros.filter(c => c.fecha.startsWith(selectedMonth)).forEach(c => {
      const monto = Number(c.monto)
      if (c.metodo_pago === 'efectivo') {
        ingresos.cobrosEfectivo += monto
      } else {
        ingresos.cobrosTransferencia += monto
      }
      ingresos.total += monto
    })

    pagos.filter(p => p.fecha.startsWith(selectedMonth)).forEach(p => {
      const monto = Number(p.monto)
      egresos.pagos += monto
      egresos.total += monto
    })

    gastos.filter(g => g.fecha.startsWith(selectedMonth)).forEach(g => {
      const monto = Number(g.monto)
      egresos.gastos += monto
      egresos.total += monto
    })

    const flujoNeto = ingresos.total - egresos.total

    return { ingresos, egresos, flujoNeto }
  }, [cobros, pagos, gastos, selectedMonth])

  const movimientosDiarios = useMemo(() => {
    const movimientos: Array<{ fecha: string; tipo: 'ingreso' | 'egreso'; concepto: string; monto: number }> = []

    cobros.filter(c => c.fecha.startsWith(selectedMonth)).forEach(c => {
      movimientos.push({
        fecha: c.fecha,
        tipo: 'ingreso',
        concepto: `Cobro (${c.metodo_pago})`,
        monto: Number(c.monto)
      })
    })

    pagos.filter(p => p.fecha.startsWith(selectedMonth)).forEach(p => {
      movimientos.push({
        fecha: p.fecha,
        tipo: 'egreso',
        concepto: 'Pago a proveedor',
        monto: Number(p.monto)
      })
    })

    gastos.filter(g => g.fecha.startsWith(selectedMonth)).forEach(g => {
      movimientos.push({
        fecha: g.fecha,
        tipo: 'egreso',
        concepto: `Gasto - ${g.categoria}`,
        monto: Number(g.monto)
      })
    })

    return movimientos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [cobros, pagos, gastos, selectedMonth])

  // Flujo acumulado (sorted ascending so accumulation goes forward in time)
  const flujoAcumulado = useMemo(() => {
    let acumulado = 0
    const datos: Array<{ fecha: string; saldo: number }> = []

    const movimientosAsc = [...movimientosDiarios].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    )

    movimientosAsc.forEach(mov => {
      acumulado += mov.tipo === 'ingreso' ? mov.monto : -mov.monto
      const existing = datos.find(d => d.fecha === mov.fecha)
      if (existing) {
        existing.saldo = acumulado
      } else {
        datos.push({ fecha: mov.fecha, saldo: acumulado })
      }
    })

    return datos
  }, [movimientosDiarios])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Label>Mes:</Label>
        <Input 
          type="month" 
          value={selectedMonth} 
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(flujoMensual.ingresos.total)}</div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div>Efectivo: {formatCurrency(flujoMensual.ingresos.cobrosEfectivo)}</div>
              <div>Transferencia: {formatCurrency(flujoMensual.ingresos.cobrosTransferencia)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Egresos del Mes</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(flujoMensual.egresos.total)}</div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div>Pagos: {formatCurrency(flujoMensual.egresos.pagos)}</div>
              <div>Gastos: {formatCurrency(flujoMensual.egresos.gastos)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Flujo Neto</CardTitle>
            {flujoMensual.flujoNeto >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${flujoMensual.flujoNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(flujoMensual.flujoNeto)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos Diarios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {movimientosDiarios.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay movimientos en este período</p>
            ) : (
              movimientosDiarios.map((mov, idx) => (
                <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{mov.concepto}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(new Date(mov.fecha))}</p>
                  </div>
                  <Badge variant={mov.tipo === 'ingreso' ? 'default' : 'destructive'}>
                    {mov.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(mov.monto)}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saldo Acumulado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {flujoAcumulado.map((dia, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{formatDate(new Date(dia.fecha))}</span>
                <span className={`font-semibold ${dia.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(dia.saldo)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
