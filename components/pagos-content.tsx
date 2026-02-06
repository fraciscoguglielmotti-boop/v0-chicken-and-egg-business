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
import { useSheet, addRow, type SheetRow } from "@/hooks/use-sheets"
import type { Pago } from "@/lib/types"
import { NuevoPagoDialog } from "./nuevo-pago-dialog"
import { formatCurrency, formatDateForSheets, formatDate, resolveEntityName } from "@/lib/utils"

function sheetRowToPago(row: SheetRow, index: number, proveedorLookup: SheetRow[]): Pago {
  // Resolve proveedor name robustly (handles ID/name swaps from manual data entry)
  const proveedorNombre = resolveEntityName(row.Proveedor || "", row.ProveedorID || "", proveedorLookup)
  return {
    id: row.ID || String(index),
    fecha: new Date(row.Fecha || Date.now()),
    proveedorId: proveedorNombre,
    proveedorNombre,
    monto: Number(row.Monto) || 0,
    metodoPago: (row.MetodoPago as Pago["metodoPago"]) || "efectivo",
    observaciones: row.Observaciones || undefined,
    createdAt: new Date(row.Fecha || Date.now()),
  }
}

const metodoPagoColors: Record<string, string> = {
  efectivo: "bg-primary/20 text-primary border-primary/30",
  transferencia: "bg-blue-500/20 text-blue-700 border-blue-500/30",
}

const metodoPagoLabels: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
}

export function PagosContent() {
  const { rows, isLoading, error, mutate } = useSheet("Pagos")
  const sheetsProveedores = useSheet("Proveedores")
  const [searchTerm, setSearchTerm] = useState("")
  const [metodoFilter, setMetodoFilter] = useState<string>("todos")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const isConnected = !error && !isLoading && rows.length >= 0

  const pagos: Pago[] = useMemo(() => {
    if (isConnected && rows.length > 0) {
      return rows.map((row, i) => sheetRowToPago(row, i, sheetsProveedores.rows))
    }
    return []
  }, [isConnected, rows, sheetsProveedores.rows])

  const filteredPagos = pagos.filter((pago) => {
    const matchesSearch = pago.proveedorNombre
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    const matchesMetodo =
      metodoFilter === "todos" || pago.metodoPago === metodoFilter
    return matchesSearch && matchesMetodo
  })

  const totalPagos = filteredPagos.reduce((acc, p) => acc + p.monto, 0)

  const pagosPorMetodo = {
    efectivo: filteredPagos
      .filter((p) => p.metodoPago === "efectivo")
      .reduce((acc, p) => acc + p.monto, 0),
    transferencia: filteredPagos
      .filter((p) => p.metodoPago === "transferencia")
      .reduce((acc, p) => acc + p.monto, 0),
  }

  const handleExportar = () => {
    const headers = ["Fecha", "Proveedor", "Monto", "Metodo de Pago", "Observaciones"]
    const csvRows = [headers.join(",")]
    filteredPagos.forEach((p) => {
      csvRows.push([
        formatDate(p.fecha),
        `"${p.proveedorNombre}"`,
        String(p.monto),
        p.metodoPago,
        `"${p.observaciones || ""}"`,
      ].join(","))
    })
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pagos_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleNuevoPago = async (pago: Pago) => {
    setSaving(true)
    try {
      const sheetValues = [
        [
          pago.id,
          formatDateForSheets(pago.fecha),
          pago.proveedorNombre, // Use nombre as ProveedorID for consistency
          pago.proveedorNombre,
          String(pago.monto),
          pago.metodoPago,
          pago.observaciones || "",
        ],
      ]
      await addRow("Pagos", sheetValues)
      await mutate()
    } catch (err) {
      console.error("[v0] Error saving pago:", err)
    } finally {
      setSaving(false)
      setDialogOpen(false)
    }
  }

  const columns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (pago: Pago) => (
        <span className="font-medium">{formatDate(pago.fecha)}</span>
      ),
    },
    {
      key: "proveedorNombre",
      header: "Proveedor",
      render: (pago: Pago) => (
        <div>
          <p className="font-medium text-foreground">{pago.proveedorNombre}</p>
          {pago.observaciones && (
            <p className="text-xs text-muted-foreground truncate max-w-xs">
              {pago.observaciones}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "monto",
      header: "Monto",
      render: (pago: Pago) => (
        <span className="font-semibold text-destructive">
          {formatCurrency(pago.monto)}
        </span>
      ),
    },
    {
      key: "metodoPago",
      header: "Metodo",
      render: (pago: Pago) => (
        <Badge variant="outline" className={metodoPagoColors[pago.metodoPago]}>
          {metodoPagoLabels[pago.metodoPago]}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Pagado</p>
          <p className="text-2xl font-bold text-destructive">
            {formatCurrency(totalPagos)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Efectivo</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(pagosPorMetodo.efectivo)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Transferencias</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(pagosPorMetodo.transferencia)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={metodoFilter} onValueChange={setMetodoFilter}>
            <SelectTrigger className="w-44">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Metodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="efectivo">Efectivo</SelectItem>
              <SelectItem value="transferencia">Transferencia</SelectItem>
            </SelectContent>
          </Select>
          <SheetsStatus isLoading={isLoading} error={error} isConnected={isConnected} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportar}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={saving}>
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : "Nuevo Pago"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredPagos}
        emptyMessage={isLoading ? "Cargando pagos..." : "No hay pagos registrados"}
      />

      {/* Dialog */}
      <NuevoPagoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleNuevoPago}
      />
    </div>
  )
}
