"use client"

import { useMemo } from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { DataTable } from "./data-table"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface Cliente {
  id: string
  nombre: string
  saldo_inicial: number
}

interface Venta {
  id: string
  cliente_nombre: string
  cantidad: number
  precio_unitario: number
}

interface Cobro {
  id: string
  cliente_nombre: string
  monto: number
}

export function CuentasContent() {
  const { data: clientes = [] } = useSupabase<Cliente>("clientes")
  const { data: ventas = [] } = useSupabase<Venta>("ventas")
  const { data: cobros = [] } = useSupabase<Cobro>("cobros")

  const clientBalances = useMemo(() => {
    const balances = new Map<string, { nombre: string; saldo: number }>()

    clientes.forEach((c) => {
      const key = c.nombre.toLowerCase().trim()
      balances.set(key, { nombre: c.nombre, saldo: c.saldo_inicial || 0 })
    })

    ventas.forEach((v) => {
      const key = v.cliente_nombre.toLowerCase().trim()
      const total = v.cantidad * v.precio_unitario
      const existing = balances.get(key) || { nombre: v.cliente_nombre, saldo: 0 }
      existing.saldo += total
      balances.set(key, existing)
    })

    cobros.forEach((c) => {
      const key = c.cliente_nombre.toLowerCase().trim()
      const existing = balances.get(key)
      if (existing) {
        existing.saldo -= Number(c.monto)
      }
    })

    return Array.from(balances.values()).sort((a, b) => b.saldo - a.saldo)
  }, [ventas, cobros, clientes])

  const columns = [
    { key: "nombre", header: "Cliente", render: (c: any) => <span className="font-medium">{c.nombre}</span> },
    { key: "saldo", header: "Saldo", render: (c: any) => (
      <Badge variant={c.saldo > 0 ? "destructive" : c.saldo < 0 ? "default" : "outline"}>
        {formatCurrency(c.saldo)}
      </Badge>
    )},
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Cuentas Corrientes</h2>
      <DataTable
        columns={columns}
        data={clientBalances}
        emptyMessage="No hay datos de cuentas corrientes"
      />
    </div>
  )
}
