"use client"

import { useState } from "react"
import { Plus, Search, Phone, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "./data-table"
import { proveedoresIniciales } from "@/lib/store"
import type { Proveedor } from "@/lib/types"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

export function ProveedoresContent() {
  const [proveedores] = useState(proveedoresIniciales)
  const [searchTerm, setSearchTerm] = useState("")

  const filteredProveedores = proveedores.filter(
    (proveedor) =>
      proveedor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proveedor.cuit?.includes(searchTerm)
  )

  const totalPorPagar = filteredProveedores.reduce(
    (acc, p) => acc + p.saldoActual,
    0
  )

  const columns = [
    {
      key: "nombre",
      header: "Proveedor",
      render: (proveedor: Proveedor) => (
        <div>
          <p className="font-semibold text-foreground">{proveedor.nombre}</p>
          {proveedor.cuit && (
            <p className="text-xs text-muted-foreground">
              CUIT: {proveedor.cuit}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "contacto",
      header: "Contacto",
      render: (proveedor: Proveedor) => (
        <div className="space-y-1">
          {proveedor.telefono && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              {proveedor.telefono}
            </div>
          )}
          {proveedor.direccion && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {proveedor.direccion}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "saldoActual",
      header: "Deuda",
      render: (proveedor: Proveedor) => (
        <div>
          {proveedor.saldoActual > 0 ? (
            <Badge
              variant="outline"
              className="bg-destructive/20 text-destructive border-destructive/30"
            >
              {formatCurrency(proveedor.saldoActual)}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-primary/20 text-primary border-primary/30"
            >
              Sin deuda
            </Badge>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Proveedores</p>
          <p className="text-2xl font-bold text-foreground">
            {filteredProveedores.length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total por Pagar</p>
          <p className="text-2xl font-bold text-destructive">
            {formatCurrency(totalPorPagar)}
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
          Nuevo Proveedor
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredProveedores}
        emptyMessage="No hay proveedores registrados"
      />
    </div>
  )
}
