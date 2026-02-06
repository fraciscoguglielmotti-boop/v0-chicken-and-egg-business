"use client"

import { useState } from "react"
import { Plus, Filter, Search, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { proveedoresIniciales } from "@/lib/store"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

export function ComprasContent() {
  const [searchTerm, setSearchTerm] = useState("")
  const [proveedorFilter, setProveedorFilter] = useState<string>("todos")

  const totalDeuda = proveedoresIniciales.reduce(
    (acc, p) => acc + p.saldoActual,
    0
  )

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Compras del Mes</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(450000)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Proveedores Activos</p>
          <p className="text-2xl font-bold text-foreground">
            {proveedoresIniciales.length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total por Pagar</p>
          <p className="text-2xl font-bold text-destructive">
            {formatCurrency(totalDeuda)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar compras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={proveedorFilter} onValueChange={setProveedorFilter}>
            <SelectTrigger className="w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Proveedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {proveedoresIniciales.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Compra
        </Button>
      </div>

      {/* Empty State */}
      <div className="rounded-xl border bg-card p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Package className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">
          Sin compras registradas
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Registra tu primera compra para comenzar a llevar el control de tus
          proveedores.
        </p>
        <Button className="mt-6">
          <Plus className="mr-2 h-4 w-4" />
          Registrar Compra
        </Button>
      </div>
    </div>
  )
}
