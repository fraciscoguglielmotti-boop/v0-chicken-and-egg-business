"use client"

import { useMemo, useState } from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Cobro { fecha: string; monto: number; metodo_pago: string }
interface Pago { fecha: string; monto: number }
interface Gasto { fecha: string; monto: number; categoria: string }

function CashRow({ label, value, sub = false, sign = "" }: { label: string; value: number; sub?: boolean; sign?: string }) {
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-border/40 ${sub ? "pl-5" : ""}`}>
      <span className={`text-sm ${sub ? "text-xs text-muted-foreground" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-sm font-medium tabular-nums ${sign === "-" ? "text-red-500" : sign === "+" ? "text-green-600" : ""}`}>
        {sign === "-" ? "-" : ""}{formatCurrency(value)}
      </span>
    </div>
  )
}

function CashTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className={`flex items-center justify-between py-3 px-4 rounded-lg my-2 ${value >= 0 ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
      <span className="font-semibold text-sm">{label}</span>
      <span className={`font-bold text-base tabular-nums ${value >= 0 ? "text-green-600" : "text-red-600"}`}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export function FlujoContent() {
  const { data: cobros = [] } = useSupabase<Cobro>("cobros")
  const { data: pagos = [] } = useSupabase<Pago>("pagos")
  const { data: gastos = [] } = useSupabase<Gasto>("gastos")

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

  const flujo = useMemo(() => {
    const cobrosFiltrados = cobros.filter(c => c.fecha.startsWith(selectedMonth))
    const pagosFiltrados = pagos.filter(p => p.fecha.startsWith(selectedMonth))
    const gastosFiltrados = gastos.filter(g => g.fecha.startsWith(selectedMonth))

    const totalIngresos = cobrosFiltrados.reduce((s, c) => s + Number(c.monto), 0)
    const cobrosEfectivo = cobrosFiltrados.filter(c => c.metodo_pago === "efectivo").reduce((s, c) => s + Number(c.monto), 0)
    const cobrosTransferencia = totalIngresos - cobrosEfectivo

    const pagosProveedores = pagosFiltrados.reduce((s, p) => s + Number(p.monto), 0)
    const gastosPagados = gastosFiltrados.reduce((s, g) => s + g.monto, 0)

    const resultado = totalIngresos - pagosProveedores - gastosPagados

    return { totalIngresos, cobrosEfectivo, cobrosTransferencia, pagosProveedores, gastosPagados, resultado }
  }, [cobros, pagos, gastos, selectedMonth])

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Label>Período</Label>
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-auto mt-1"
        />
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-base mb-1">Cashflow — Resultado por lo Percibido</h3>
        <p className="text-xs text-muted-foreground mb-5">Análisis financiero sobre lo que efectivamente se cobró y pagó</p>

        <div className="space-y-0">
          <CashRow label="(+) Cobros recibidos" value={flujo.totalIngresos} sign="+" />
          <CashRow label="Efectivo" value={flujo.cobrosEfectivo} sub />
          <CashRow label="Transferencias" value={flujo.cobrosTransferencia} sub />

          <CashRow label="(−) Pagos a proveedores" value={flujo.pagosProveedores} sign="-" />
          <CashRow label="(−) Gastos pagados" value={flujo.gastosPagados} sign="-" />

          <CashTotal label="= Resultado de Caja" value={flujo.resultado} />
        </div>
      </Card>
    </div>
  )
}
