"use client"

import { useState, useMemo } from "react"
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
import { SheetsStatus } from "./sheets-status"
import { NuevaVentaDialog } from "./nueva-venta-dialog"
import { useSheet, addRow, type SheetRow } from "@/hooks/use-sheets"
import { ventasIniciales } from "@/lib/store"
import type { Venta } from "@/lib/types"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

function sheetRowToVenta(row: SheetRow, index: number): Venta {
  return {
    id: row.ID || String(index),
    fecha: new Date(row.Fecha || Date.now()),
    clienteId: row.ClienteID || "",
    clienteNombre: row.Cliente || "",
    items: [
      {
        productoId: "pollo_a",
        productoNombre: row.Productos || "Producto",
        cantidad: Number(row.Cantidad) || 0,
        precioUnitario: Number(row.PrecioUnitario) || 0,
        subtotal: Number(row.Total) || 0,
      },
    ],
    total: Number(row.Total) || 0,
    estado: (row.Estado as Venta["estado"]) || "pendiente",
    createdAt: new Date(row.Fecha || Date.now()),
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

export function VentasContent() {
  const { rows, isLoading, error, mutate } = useSheet("Ventas")
  const [localVentas, setLocalVentas] = useState(ventasIniciales)
  const [searchTerm, setSearchTerm] = useState("")
  const [estadoFilter, setEstadoFilter] = useState<string>("todos")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const isConnected = !error && !isLoading && rows.length >= 0 && !isLoading

  const ventas: Venta[] = useMemo(() => {
    if (isConnected && rows.length > 0) {
      return rows.map(sheetRowToVenta)
    }
    return localVentas
  }, [isConnected, rows, localVentas])

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

  const handleNuevaVenta = async (venta: Venta) => {
    setSaving(true)
    try {
      // Build products summary
      const productos = venta.items
        .map((i) => `${i.cantidad} ${i.productoNombre}`)
        .join(", ")

      const sheetValues = [
        [
          venta.id,
          new Date(venta.fecha).toLocaleDateString("es-AR"),
          venta.clienteId,
          venta.clienteNombre,
          productos,
          String(venta.items.reduce((a, i) => a + i.cantidad, 0)),
          String(
            venta.items.length > 0 ? venta.items[0].precioUnitario : 0
          ),
          String(venta.total),
          venta.estado,
        ],
      ]

      await addRow("Ventas", sheetValues)
      await mutate()
    } catch {
      // If Sheets fails, save locally
      setLocalVentas((prev) => [venta, ...prev])
    } finally {
      setSaving(false)
      setDialogOpen(false)
    }
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
        <div className="flex flex-1 items-center gap-3">
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
          <SheetsStatus isLoading={isLoading} error={error} isConnected={isConnected} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={saving}>
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : "Nueva Venta"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredVentas}
        emptyMessage={isLoading ? "Cargando ventas..." : "No hay ventas registradas"}
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
