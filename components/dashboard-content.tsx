"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useMemo } from "react"
import {
  ShoppingCart,
  Receipt,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { StatCard } from "./stat-card"
import { DataTable } from "./data-table"
import { SheetsStatus } from "./sheets-status"
import { useSheet, type SheetRow } from "@/hooks/use-sheets"
import { ventasIniciales, cobrosIniciales, calcularStats } from "@/lib/store"
import type { Venta, Cobro } from "@/lib/types"
import { formatCurrency, formatDate, parseDate, parseSheetNumber, resolveEntityName, resolveVentaMonto } from "@/lib/utils"

function rowToVenta(row: SheetRow, i: number, clienteLookup: SheetRow[]): Venta {
  const { cantidad, precioUnitario, total } = resolveVentaMonto(row)
  const clienteNombre = resolveEntityName(row.Cliente || "", row.ClienteID || "", clienteLookup)
  const fecha = parseDate(row.Fecha || "")
  return {
    id: row.ID || String(i),
    fecha,
    clienteId: clienteNombre,
    clienteNombre,
    items: [{
      productoId: "producto",
      productoNombre: row.Productos || "Producto",
      cantidad,
      precioUnitario,
      subtotal: total,
    }],
    total,
    estado: "pendiente",
    createdAt: fecha,
  }
}

function rowToCobro(row: SheetRow, i: number, clienteLookup: SheetRow[]): Cobro {
  const clienteNombre = resolveEntityName(row.Cliente || "", row.ClienteID || "", clienteLookup)
  const fecha = parseDate(row.Fecha || "")
  return {
    id: row.ID || String(i),
    fecha,
    clienteId: clienteNombre,
    clienteNombre,
      monto: parseSheetNumber(row.Monto),
    metodoPago: (row.MetodoPago as Cobro["metodoPago"]) || "efectivo",
    createdAt: fecha,
  }
}

const estadoColors = {
  pendiente: "bg-accent/20 text-accent-foreground border-accent/30",
  pagada: "bg-primary/20 text-primary border-primary/30",
  parcial: "bg-secondary text-secondary-foreground border-border",
}

const estadoLabels = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  parcial: "Parcial",
}

export function DashboardContent() {
  const sheetsVentas = useSheet("Ventas")
  const sheetsCobros = useSheet("Cobros")
  const sheetsClientes = useSheet("Clientes")

  const isLoading = sheetsVentas.isLoading || sheetsCobros.isLoading
  const hasError = sheetsVentas.error || sheetsCobros.error || null
  const isConnected = !hasError && !isLoading

  // Calculate client balances: ventas - cobros
  const clientBalances = useMemo(() => {
    const balances = new Map<string, { nombre: string; saldo: number }>()

    // Add ventas (debt)
    sheetsVentas.rows.forEach((row) => {
      const cliente = resolveEntityName(row.Cliente || "", row.ClienteID || "", sheetsClientes.rows)
      if (!cliente) return
      const key = cliente.toLowerCase().trim()
      const { total } = resolveVentaMonto(row)
      const existing = balances.get(key) || { nombre: cliente, saldo: 0 }
      existing.saldo += total
      balances.set(key, existing)
    })

    // Subtract cobros (payments)
    sheetsCobros.rows.forEach((row) => {
      const cliente = resolveEntityName(row.Cliente || "", row.ClienteID || "", sheetsClientes.rows)
      if (!cliente) return
      const key = cliente.toLowerCase().trim()
      const existing = balances.get(key)
      if (existing) {
        existing.saldo -= parseSheetNumber(row.Monto)
      }
    })

    return Array.from(balances.values())
      .filter((c) => c.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 5)
  }, [sheetsVentas.rows, sheetsCobros.rows, sheetsClientes.rows])

  const ventas: Venta[] = useMemo(() => {
    if (isConnected && sheetsVentas.rows.length > 0) return sheetsVentas.rows.map((row, i) => rowToVenta(row, i, sheetsClientes.rows))
    return ventasIniciales
  }, [isConnected, sheetsVentas.rows, sheetsClientes.rows])

  const cobros: Cobro[] = useMemo(() => {
    if (isConnected && sheetsCobros.rows.length > 0) return sheetsCobros.rows.map((row, i) => rowToCobro(row, i, sheetsClientes.rows))
    return cobrosIniciales
  }, [isConnected, sheetsCobros.rows, sheetsClientes.rows])

  const stats = useMemo(() => {
    if (!isConnected) return calcularStats()

    const totalVentas = ventas.reduce((acc, v) => acc + v.total, 0)
    const totalCobros = cobros.reduce((acc, c) => acc + c.monto, 0)
    const cuentasPorCobrar = sheetsClientes.rows.reduce(
      (acc, r) => acc + parseSheetNumber(r.Saldo),
      0
    )

    return {
      ventasHoy: totalVentas,
      ventasMes: totalVentas,
      cobrosHoy: totalCobros,
      cobrosMes: totalCobros,
      cuentasPorCobrar,
      cuentasPorPagar: 0,
    }
  }, [isConnected, ventas, cobros, sheetsClientes.rows])

  const ventasColumns = [
    { key: "fecha", header: "Fecha", render: (v: Venta) => formatDate(v.fecha) },
    { key: "clienteNombre", header: "Cliente" },
    {
      key: "total",
      header: "Total",
      render: (v: Venta) => <span className="font-semibold">{formatCurrency(v.total)}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      render: (v: Venta) => (
        <Badge variant="outline" className={estadoColors[v.estado]}>{estadoLabels[v.estado]}</Badge>
      ),
    },
  ]

  const cobrosColumns = [
    { key: "fecha", header: "Fecha", render: (c: Cobro) => formatDate(c.fecha) },
    { key: "clienteNombre", header: "Cliente" },
    {
      key: "monto",
      header: "Monto",
      render: (c: Cobro) => <span className="font-semibold text-primary">{formatCurrency(c.monto)}</span>,
    },
    {
      key: "metodoPago",
      header: "Metodo",
      render: (c: Cobro) => <span className="capitalize">{c.metodoPago}</span>,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Connection Status */}
      <div className="flex justify-end">
        <SheetsStatus isLoading={isLoading} error={hasError} isConnected={isConnected} />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Ventas"
          value={formatCurrency(stats.ventasMes)}
          subtitle="Registradas"
          icon={ShoppingCart}
          variant="success"
        />
        <StatCard
          title="Total Cobros"
          value={formatCurrency(stats.cobrosMes)}
          subtitle="Recaudado"
          icon={TrendingUp}
          variant="default"
        />
        <StatCard
          title="Cobros"
          value={formatCurrency(stats.cobrosHoy)}
          subtitle="Total cobrado"
          icon={Receipt}
          variant="success"
        />
        <StatCard
          title="Por Cobrar"
          value={formatCurrency(stats.cuentasPorCobrar)}
          subtitle="Saldo pendiente"
          icon={TrendingDown}
          variant="warning"
        />
      </div>

      {/* Quick Actions + Top Deudores */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground">Resumen</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Ventas</span>
              <span className="font-semibold text-primary">{formatCurrency(stats.ventasMes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Cobros</span>
              <span className="font-semibold text-foreground">{formatCurrency(stats.cobrosMes)}</span>
            </div>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Pendiente de Cobro</span>
                <span className="text-lg font-bold text-accent">
                  {formatCurrency(stats.ventasMes - stats.cobrosMes)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground">Acciones Rapidas</h3>
          <div className="mt-4 grid gap-3">
            <Link href="/ventas">
              <Button className="w-full justify-start gap-2 bg-transparent" variant="outline">
                <ShoppingCart className="h-4 w-4" />
                Ir a Ventas
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
            <Link href="/cobros">
              <Button className="w-full justify-start gap-2 bg-transparent" variant="outline">
                <Receipt className="h-4 w-4" />
                Ir a Cobros
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            Top Deudores
          </h3>
          <div className="mt-4 space-y-3">
            {clientBalances.length > 0 ? (
              clientBalances.map((client, idx) => (
                <Link key={idx} href="/cuentas">
                  <div className="flex items-center justify-between rounded-lg border bg-accent/5 p-3 hover:bg-accent/10 transition-colors cursor-pointer">
                    <span className="text-sm font-medium text-foreground truncate">{client.nombre}</span>
                    <span className="text-sm font-bold text-destructive">{formatCurrency(client.saldo)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No hay deudas pendientes</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Ultimas Ventas</h3>
            <Link href="/ventas">
              <Button variant="ghost" size="sm" className="gap-1">
                Ver todas
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <DataTable columns={ventasColumns} data={ventas.slice(0, 5)} emptyMessage={isLoading ? "Cargando..." : "Sin ventas"} />
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Ultimos Cobros</h3>
            <Link href="/cobros">
              <Button variant="ghost" size="sm" className="gap-1">
                Ver todas
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <DataTable columns={cobrosColumns} data={cobros.slice(0, 5)} emptyMessage={isLoading ? "Cargando..." : "Sin cobros"} />
        </div>
      </div>
    </div>
  )
}
