"use client"

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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  calcularStats,
  ventasIniciales,
  cobrosIniciales,
} from "@/lib/store"
import type { Venta, Cobro } from "@/lib/types"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
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
  const stats = calcularStats()

  const ventasColumns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (venta: Venta) => formatDate(venta.fecha),
    },
    {
      key: "clienteNombre",
      header: "Cliente",
    },
    {
      key: "total",
      header: "Total",
      render: (venta: Venta) => (
        <span className="font-semibold">{formatCurrency(venta.total)}</span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (venta: Venta) => (
        <Badge variant="outline" className={estadoColors[venta.estado]}>
          {estadoLabels[venta.estado]}
        </Badge>
      ),
    },
  ]

  const cobrosColumns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (cobro: Cobro) => formatDate(cobro.fecha),
    },
    {
      key: "clienteNombre",
      header: "Cliente",
    },
    {
      key: "monto",
      header: "Monto",
      render: (cobro: Cobro) => (
        <span className="font-semibold text-primary">
          {formatCurrency(cobro.monto)}
        </span>
      ),
    },
    {
      key: "metodoPago",
      header: "Metodo",
      render: (cobro: Cobro) => (
        <span className="capitalize">{cobro.metodoPago}</span>
      ),
    },
  ]

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ventas Hoy"
          value={formatCurrency(stats.ventasHoy)}
          subtitle="Total del dia"
          icon={ShoppingCart}
          variant="success"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Ventas del Mes"
          value={formatCurrency(stats.ventasMes)}
          subtitle="Acumulado mensual"
          icon={TrendingUp}
          variant="default"
        />
        <StatCard
          title="Cobros Hoy"
          value={formatCurrency(stats.cobrosHoy)}
          subtitle="Recaudado hoy"
          icon={Receipt}
          variant="success"
        />
        <StatCard
          title="Por Cobrar"
          value={formatCurrency(stats.cuentasPorCobrar)}
          subtitle="Saldo pendiente clientes"
          icon={TrendingDown}
          variant="warning"
        />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground">
            Resumen de Cuentas
          </h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cuentas por Cobrar</span>
              <span className="font-semibold text-primary">
                {formatCurrency(stats.cuentasPorCobrar)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cuentas por Pagar</span>
              <span className="font-semibold text-destructive">
                {formatCurrency(stats.cuentasPorPagar)}
              </span>
            </div>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Balance</span>
                <span
                  className={`text-lg font-bold ${
                    stats.cuentasPorCobrar - stats.cuentasPorPagar >= 0
                      ? "text-primary"
                      : "text-destructive"
                  }`}
                >
                  {formatCurrency(stats.cuentasPorCobrar - stats.cuentasPorPagar)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground">
            Acciones Rapidas
          </h3>
          <div className="mt-4 grid gap-3">
            <Link href="/ventas/nueva">
              <Button className="w-full justify-start gap-2 bg-transparent" variant="outline">
                <ShoppingCart className="h-4 w-4" />
                Nueva Venta
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
            <Link href="/cobros/nuevo">
              <Button className="w-full justify-start gap-2 bg-transparent" variant="outline">
                <Receipt className="h-4 w-4" />
                Registrar Cobro
                <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              Ultimas Ventas
            </h3>
            <Link href="/ventas">
              <Button variant="ghost" size="sm" className="gap-1">
                Ver todas
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <DataTable
            columns={ventasColumns}
            data={ventasIniciales.slice(0, 5)}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              Ultimos Cobros
            </h3>
            <Link href="/cobros">
              <Button variant="ghost" size="sm" className="gap-1">
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <DataTable
            columns={cobrosColumns}
            data={cobrosIniciales.slice(0, 5)}
          />
        </div>
      </div>
    </div>
  )
}
