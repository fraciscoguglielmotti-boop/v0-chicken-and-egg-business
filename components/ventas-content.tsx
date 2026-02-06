"use client"

import { useState } from "react"
import { Plus, Filter, Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "./data-table"
import { NuevaVentaDialog } from "./nueva-venta-dialog"
import { ventasIniciales } from "@/lib/store"
import type { Venta } from "@/lib/types"

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

export function VentasContent() {
  const [ventas, setVentas] = useState(ventasIniciales)
  const [searchTerm, setSearchTerm] = useState("")
  const [estadoFilter, setEstadoFilter] = useState<string>("todos")
  const [dialogOpen, setDialogOpen] = useState(false)

  const filteredVentas = ventas.filter((venta) => {
    const matchesSearch = venta.clienteNombre
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    const matchesEstado =
      estadoFilter === "todos" || venta.estado === estadoFilter
    return matchesSearch && matchesEstado
  })

  const totalVentas = filteredVentas.reduce((acc, v) => acc + v.total, 0)
  const ventasPendientes = filteredVentas.filter(
    (v) => v.estado === "pendiente"
  ).length

  const handleNuevaVenta = (venta: Venta) => {
    setVentas([venta, ...ventas])
    setDialogOpen(false)
  }

  const columns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (venta: Venta) => (
        <span className="font-medium">{formatDate(venta.fecha)}</span>
      ),
    },
    {
      key: "clienteNombre",
      header: "Cliente",
      render: (venta: Venta) => (
        <div>
          <p className="font-medium text-foreground">{venta.clienteNombre}</p>
          <p className="text-xs text-muted-foreground">
            {venta.items.length} producto(s)
          </p>
        </div>
      ),
    },
    {
      key: "items",
      header: "Productos",
      render: (venta: Venta) => (
        <div className="max-w-xs">
          {venta.items.slice(0, 2).map((item, idx) => (
            <p key={idx} className="text-sm text-muted-foreground truncate">
              {item.cantidad} {item.productoNombre}
            </p>
          ))}
          {venta.items.length > 2 && (
            <p className="text-xs text-muted-foreground">
              +{venta.items.length - 2} mas
            </p>
          )}
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      render: (venta: Venta) => (
        <span className="font-semibold text-foreground">
          {formatCurrency(venta.total)}
        </span>
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

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Ventas</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(totalVentas)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Cantidad</p>
          <p className="text-2xl font-bold text-foreground">
            {filteredVentas.length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pendientes</p>
          <p className="text-2xl font-bold text-accent">{ventasPendientes}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-40">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="pagada">Pagada</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Venta
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredVentas}
        emptyMessage="No hay ventas registradas"
      />

      {/* Dialog */}
      <NuevaVentaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleNuevaVenta}
      />
    </div>
  )
}
