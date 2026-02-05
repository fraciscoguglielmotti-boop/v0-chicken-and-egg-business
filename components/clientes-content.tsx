"use client"

import { useState } from "react"
import { Plus, Search, Phone, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "./data-table"
import { clientesIniciales } from "@/lib/store"
import type { Cliente } from "@/lib/types"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

export function ClientesContent() {
  const [clientes] = useState(clientesIniciales)
  const [searchTerm, setSearchTerm] = useState("")

  const filteredClientes = clientes.filter(
    (cliente) =>
      cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.cuit?.includes(searchTerm)
  )

  const totalPorCobrar = filteredClientes.reduce(
    (acc, c) => acc + c.saldoActual,
    0
  )
  const clientesConDeuda = filteredClientes.filter(
    (c) => c.saldoActual > 0
  ).length

  const columns = [
    {
      key: "nombre",
      header: "Cliente",
      render: (cliente: Cliente) => (
        <div>
          <p className="font-semibold text-foreground">{cliente.nombre}</p>
          {cliente.cuit && (
            <p className="text-xs text-muted-foreground">CUIT: {cliente.cuit}</p>
          )}
        </div>
      ),
    },
    {
      key: "contacto",
      header: "Contacto",
      render: (cliente: Cliente) => (
        <div className="space-y-1">
          {cliente.telefono && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              {cliente.telefono}
            </div>
          )}
          {cliente.direccion && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {cliente.direccion}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "saldoActual",
      header: "Saldo",
      render: (cliente: Cliente) => (
        <div>
          {cliente.saldoActual > 0 ? (
            <Badge variant="outline" className="bg-accent/20 text-accent-foreground border-accent/30">
              {formatCurrency(cliente.saldoActual)}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
              Al dia
            </Badge>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Clientes</p>
          <p className="text-2xl font-bold text-foreground">
            {filteredClientes.length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Con Deuda</p>
          <p className="text-2xl font-bold text-accent">{clientesConDeuda}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total por Cobrar</p>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(totalPorCobrar)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o CUIT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredClientes}
        emptyMessage="No hay clientes registrados"
      />
    </div>
  )
}
