"use client"

import { useState } from "react"
import { ArrowUpRight, ArrowDownRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "./data-table"
import {
  clientesIniciales,
  proveedoresIniciales,
  ventasIniciales,
  cobrosIniciales,
} from "@/lib/store"
import type { Cliente, Proveedor } from "@/lib/types"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

export function CuentasContent() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)

  const totalPorCobrar = clientesIniciales.reduce(
    (acc, c) => acc + c.saldoActual,
    0
  )
  const totalPorPagar = proveedoresIniciales.reduce(
    (acc, p) => acc + p.saldoActual,
    0
  )

  const filteredClientes = clientesIniciales.filter((c) =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredProveedores = proveedoresIniciales.filter((p) =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const clienteColumns = [
    {
      key: "nombre",
      header: "Cliente",
      render: (cliente: Cliente) => (
        <span className="font-medium">{cliente.nombre}</span>
      ),
    },
    {
      key: "saldoActual",
      header: "Saldo",
      render: (cliente: Cliente) => (
        <span
          className={
            cliente.saldoActual > 0
              ? "font-semibold text-primary"
              : "text-muted-foreground"
          }
        >
          {formatCurrency(cliente.saldoActual)}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (cliente: Cliente) =>
        cliente.saldoActual > 0 ? (
          <Badge
            variant="outline"
            className="bg-accent/20 text-accent-foreground border-accent/30"
          >
            Deudor
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="bg-primary/20 text-primary border-primary/30"
          >
            Al dia
          </Badge>
        ),
    },
    {
      key: "acciones",
      header: "",
      render: (cliente: Cliente) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedCliente(cliente)}
        >
          Ver movimientos
        </Button>
      ),
    },
  ]

  const proveedorColumns = [
    {
      key: "nombre",
      header: "Proveedor",
      render: (proveedor: Proveedor) => (
        <span className="font-medium">{proveedor.nombre}</span>
      ),
    },
    {
      key: "saldoActual",
      header: "Deuda",
      render: (proveedor: Proveedor) => (
        <span
          className={
            proveedor.saldoActual > 0
              ? "font-semibold text-destructive"
              : "text-muted-foreground"
          }
        >
          {formatCurrency(proveedor.saldoActual)}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (proveedor: Proveedor) =>
        proveedor.saldoActual > 0 ? (
          <Badge
            variant="outline"
            className="bg-destructive/20 text-destructive border-destructive/30"
          >
            Pendiente
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="bg-primary/20 text-primary border-primary/30"
          >
            Pagado
          </Badge>
        ),
    },
  ]

  // Movimientos del cliente seleccionado
  const movimientosCliente = selectedCliente
    ? [
        ...ventasIniciales
          .filter((v) => v.clienteId === selectedCliente.id)
          .map((v) => ({
            id: `v-${v.id}`,
            fecha: v.fecha,
            tipo: "venta" as const,
            descripcion: `Venta - ${v.items.length} producto(s)`,
            debe: v.total,
            haber: 0,
          })),
        ...cobrosIniciales
          .filter((c) => c.clienteId === selectedCliente.id)
          .map((c) => ({
            id: `c-${c.id}`,
            fecha: c.fecha,
            tipo: "cobro" as const,
            descripcion: `Cobro - ${c.metodoPago}`,
            debe: 0,
            haber: c.monto,
          })),
      ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    : []

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ArrowUpRight className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Por Cobrar</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-primary">
            {formatCurrency(totalPorCobrar)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <ArrowDownRight className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">Por Pagar</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-destructive">
            {formatCurrency(totalPorPagar)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Clientes con Deuda</p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {clientesIniciales.filter((c) => c.saldoActual > 0).length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Balance</p>
          <p
            className={`mt-2 text-2xl font-bold ${
              totalPorCobrar - totalPorPagar >= 0
                ? "text-primary"
                : "text-destructive"
            }`}
          >
            {formatCurrency(totalPorCobrar - totalPorPagar)}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cuenta..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="clientes">
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-4">
          {selectedCliente ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedCliente.nombre}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Saldo actual:{" "}
                    <span className="font-semibold text-primary">
                      {formatCurrency(selectedCliente.saldoActual)}
                    </span>
                  </p>
                </div>
                <Button variant="outline" onClick={() => setSelectedCliente(null)}>
                  Volver
                </Button>
              </div>

              <div className="rounded-lg border">
                <div className="grid grid-cols-5 gap-2 border-b bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground">
                  <div>Fecha</div>
                  <div className="col-span-2">Descripcion</div>
                  <div className="text-right">Debe</div>
                  <div className="text-right">Haber</div>
                </div>
                {movimientosCliente.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Sin movimientos
                  </div>
                ) : (
                  movimientosCliente.map((mov) => (
                    <div
                      key={mov.id}
                      className="grid grid-cols-5 gap-2 items-center border-b last:border-0 px-4 py-3 text-sm"
                    >
                      <div>
                        {new Date(mov.fecha).toLocaleDateString("es-AR")}
                      </div>
                      <div className="col-span-2">{mov.descripcion}</div>
                      <div className="text-right font-medium text-foreground">
                        {mov.debe > 0 ? formatCurrency(mov.debe) : "-"}
                      </div>
                      <div className="text-right font-medium text-primary">
                        {mov.haber > 0 ? formatCurrency(mov.haber) : "-"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <DataTable
              columns={clienteColumns}
              data={filteredClientes}
              emptyMessage="No hay clientes"
            />
          )}
        </TabsContent>

        <TabsContent value="proveedores">
          <DataTable
            columns={proveedorColumns}
            data={filteredProveedores}
            emptyMessage="No hay proveedores"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
