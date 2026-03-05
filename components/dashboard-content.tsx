"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useMemo } from "react"
import { ShoppingCart, Receipt, TrendingUp, TrendingDown, ArrowRight } from "lucide-react"
import Link from "next/link"
import { StatCard } from "./stat-card"
import { DataTable } from "./data-table"
import { useSupabase } from "@/hooks/use-supabase"
import { CurrencyDisplay } from "./currency-display"
import { formatDate } from "@/lib/utils"

interface Venta {
  id: string
  fecha: string
  cliente_nombre: string
  cantidad: number
  precio_unitario: number
}

interface Cobro {
  id: string
  fecha: string
  cliente_nombre: string
  monto: number
  metodo_pago: string
}

interface Cliente {
  id: string
  nombre: string
  saldo_inicial: number
}

export function DashboardContent() {
  const { data: ventas = [], isLoading: loadingVentas } = useSupabase<Venta>("ventas")
  const { data: cobros = [], isLoading: loadingCobros } = useSupabase<Cobro>("cobros")
  const { data: clientes = [], isLoading: loadingClientes } = useSupabase<Cliente>("clientes")

  const isLoading = loadingVentas || loadingCobros || loadingClientes

  // Calculate client balances
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

    return Array.from(balances.values())
      .filter((c) => c.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 5)
  }, [ventas, cobros, clientes])

  const stats = useMemo(() => {
    const now = new Date()
    const mesActual = now.getMonth()
    const añoActual = now.getFullYear()
    const mesAnterior = mesActual === 0 ? 11 : mesActual - 1
    const añoMesAnterior = mesActual === 0 ? añoActual - 1 : añoActual

    const semanaActual = Math.floor((now.getTime() - new Date(añoActual, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
    const semanaAnterior = semanaActual - 1

    const ventasMesActual = ventas.filter(v => {
      const fecha = new Date(v.fecha)
      return fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual
    })
    const ventasMesAnterior = ventas.filter(v => {
      const fecha = new Date(v.fecha)
      return fecha.getMonth() === mesAnterior && fecha.getFullYear() === añoMesAnterior
    })

    const ventasSemanaActual = ventas.filter(v => {
      const fecha = new Date(v.fecha)
      const semana = Math.floor((fecha.getTime() - new Date(fecha.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
      return semana === semanaActual
    })
    const ventasSemanaAnterior = ventas.filter(v => {
      const fecha = new Date(v.fecha)
      const semana = Math.floor((fecha.getTime() - new Date(fecha.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
      return semana === semanaAnterior
    })

    const totalVentasMesActual = ventasMesActual.reduce((acc, v) => acc + v.cantidad * v.precio_unitario, 0)
    const totalVentasMesAnterior = ventasMesAnterior.reduce((acc, v) => acc + v.cantidad * v.precio_unitario, 0)
    const totalVentasSemanaActual = ventasSemanaActual.reduce((acc, v) => acc + v.cantidad * v.precio_unitario, 0)
    const totalVentasSemanaAnterior = ventasSemanaAnterior.reduce((acc, v) => acc + v.cantidad * v.precio_unitario, 0)

    const variacionMes = totalVentasMesAnterior > 0 ? ((totalVentasMesActual - totalVentasMesAnterior) / totalVentasMesAnterior) * 100 : 0
    const variacionSemana = totalVentasSemanaAnterior > 0 ? ((totalVentasSemanaActual - totalVentasSemanaAnterior) / totalVentasSemanaAnterior) * 100 : 0

    const totalVentas = ventas.reduce((acc, v) => acc + v.cantidad * v.precio_unitario, 0)
    const totalCobros = cobros.reduce((acc, c) => acc + Number(c.monto), 0)
    const cuentasPorCobrar = clientBalances.reduce((acc, c) => acc + c.saldo, 0)

    return {
      ventasMes: totalVentas,
      ventasMesActual: totalVentasMesActual,
      ventasMesAnterior: totalVentasMesAnterior,
      ventasSemanaActual: totalVentasSemanaActual,
      ventasSemanaAnterior: totalVentasSemanaAnterior,
      variacionMes,
      variacionSemana,
      cobrosMes: totalCobros,
      cuentasPorCobrar,
    }
  }, [ventas, cobros, clientBalances])

  const ventasRecientes = ventas.slice(0, 5).map((v) => ({
    ...v,
    total: v.cantidad * v.precio_unitario,
    estado: "pagada" as const,
  }))

  type VentaRow = Venta & { total: number; estado: string }

  const ventasColumns = [
    { key: "fecha", header: "Fecha", render: (v: VentaRow) => formatDate(new Date(v.fecha)) },
    { key: "cliente_nombre", header: "Cliente" },
    { key: "total", header: "Total", render: (v: VentaRow) => <CurrencyDisplay amount={v.total} className="font-semibold" /> },
    { key: "estado", header: "Estado", render: (_v: VentaRow) => <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">Pagada</Badge> },
  ]

  const cobrosColumns = [
    { key: "fecha", header: "Fecha", render: (c: Cobro) => formatDate(new Date(c.fecha)) },
    { key: "cliente_nombre", header: "Cliente" },
    { key: "monto", header: "Monto", render: (c: Cobro) => <CurrencyDisplay amount={Number(c.monto)} className="font-semibold text-primary" /> },
    { key: "metodo_pago", header: "Metodo", render: (c: Cobro) => <span className="capitalize">{c.metodo_pago}</span> },
  ]

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Ventas" value={<CurrencyDisplay amount={stats.ventasMes} />} subtitle="Registradas" icon={ShoppingCart} variant="success" />
        <StatCard title="Total Cobros" value={<CurrencyDisplay amount={stats.cobrosMes} />} subtitle="Recaudado" icon={TrendingUp} variant="default" />
        <StatCard title="Cobros" value={<CurrencyDisplay amount={stats.cobrosMes} />} subtitle="Total cobrado" icon={Receipt} variant="success" />
        <StatCard title="Por Cobrar" value={<CurrencyDisplay amount={stats.cuentasPorCobrar} />} subtitle="Saldo pendiente" icon={TrendingDown} variant="warning" />
      </div>

      {/* Comparativas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Comparativa Mes vs Mes</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mes Actual</span>
              <CurrencyDisplay amount={stats.ventasMesActual} className="font-semibold" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mes Anterior</span>
              <CurrencyDisplay amount={stats.ventasMesAnterior} className="font-semibold" />
            </div>
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="font-medium">Variación</span>
              <div className="flex items-center gap-2">
                {stats.variacionMes >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={`font-bold ${stats.variacionMes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.variacionMes >= 0 ? '+' : ''}{stats.variacionMes.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Comparativa Semana vs Semana</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Semana Actual</span>
              <CurrencyDisplay amount={stats.ventasSemanaActual} className="font-semibold" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Semana Anterior</span>
              <CurrencyDisplay amount={stats.ventasSemanaAnterior} className="font-semibold" />
            </div>
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="font-medium">Variación</span>
              <div className="flex items-center gap-2">
                {stats.variacionSemana >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={`font-bold ${stats.variacionSemana >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.variacionSemana >= 0 ? '+' : ''}{stats.variacionSemana.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions + Top Deudores */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground">Resumen</h3>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Ventas</span>
              <CurrencyDisplay amount={stats.ventasMes} className="font-semibold text-primary" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Cobros</span>
              <CurrencyDisplay amount={stats.cobrosMes} className="font-semibold text-foreground" />
            </div>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Pendiente de Cobro</span>
                <CurrencyDisplay amount={stats.cuentasPorCobrar} className="text-lg font-bold text-accent" />
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
                    <CurrencyDisplay amount={client.saldo} className="text-sm font-bold text-destructive" />
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
          <DataTable columns={ventasColumns} data={ventasRecientes} emptyMessage={isLoading ? "Cargando..." : "Sin ventas"} />
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
