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
import { cobrosIniciales } from "@/lib/store"
import type { Cobro } from "@/lib/types"
import { NuevoCobroDialog } from "./nuevo-cobro-dialog"
import { formatCurrency, formatDate, formatDateForSheets } from "@/lib/utils"

function sheetRowToCobro(row: SheetRow, index: number): Cobro {
  // Cliente field is the display name; ClienteID may also hold the name
  const clienteNombre = row.Cliente || row.ClienteID || ""
  return {
    id: row.ID || String(index),
    fecha: new Date(row.Fecha || Date.now()),
    clienteId: clienteNombre, // Use name consistently
    clienteNombre,
    monto: Number(row.Monto) || 0,
    metodoPago: (row.MetodoPago as Cobro["metodoPago"]) || "efectivo",
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

export function CobrosContent() {
  const { rows, isLoading, error, mutate } = useSheet("Cobros")
  const [localCobros, setLocalCobros] = useState(cobrosIniciales)
  const [searchTerm, setSearchTerm] = useState("")
  const [metodoFilter, setMetodoFilter] = useState<string>("todos")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const isConnected = !error && !isLoading && rows.length >= 0

  const cobros: Cobro[] = useMemo(() => {
    if (isConnected && rows.length > 0) {
      return rows.map(sheetRowToCobro)
    }
    return localCobros
  }, [isConnected, rows, localCobros])

  const filteredCobros = cobros.filter((cobro) => {
    const matchesSearch = cobro.clienteNombre
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    const matchesMetodo =
      metodoFilter === "todos" || cobro.metodoPago === metodoFilter
    return matchesSearch && matchesMetodo
  })

  const totalCobros = filteredCobros.reduce((acc, c) => acc + c.monto, 0)

  const handleExportar = () => {
    const headers = ["Fecha", "Cliente", "Monto", "Metodo de Pago", "Observaciones"]
    const csvRows = [headers.join(",")]
    filteredCobros.forEach((c) => {
      csvRows.push([
        formatDateForSheets(c.fecha),
        `"${c.clienteNombre}"`,
        String(c.monto),
        c.metodoPago,
        `"${c.observaciones || ""}"`,
      ].join(","))
    })
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cobros_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const cobrosPorMetodo = {
    efectivo: filteredCobros
      .filter((c) => c.metodoPago === "efectivo")
      .reduce((acc, c) => acc + c.monto, 0),
    transferencia: filteredCobros
      .filter((c) => c.metodoPago === "transferencia")
      .reduce((acc, c) => acc + c.monto, 0),
  }

  const handleNuevoCobro = async (cobro: Cobro, esProveedor?: boolean, cuentaDestino?: string) => {
    setSaving(true)
    try {
      // Build observaciones with cuenta destino for transferencias
      let obs = cobro.observaciones || ""
      if (cobro.metodoPago === "transferencia" && cuentaDestino) {
        obs = `Cuenta: ${cuentaDestino}${obs ? ` - ${obs}` : ""}`
      }

      const sheetValues = [
        [
          cobro.id,
          formatDateForSheets(cobro.fecha),
          cobro.clienteNombre, // Use nombre as ClienteID for consistency
          cobro.clienteNombre,
          String(cobro.monto),
          cobro.metodoPago,
          obs,
          "", // Vendedor column
        ],
      ]
      await addRow("Cobros", sheetValues)

      // If transferencia to Agroaves SRL, also register as Pago to proveedor Agroaves
      if (esProveedor || (cobro.metodoPago === "transferencia" && cuentaDestino?.toLowerCase().includes("agroaves"))) {
        const proveedorName = cuentaDestino?.toLowerCase().includes("agroaves") ? "Agroaves SRL" : cobro.clienteNombre
        const pagoValues = [
          [
            `pago-${Date.now()}`,
            formatDateForSheets(cobro.fecha),
            proveedorName,
            proveedorName,
            String(cobro.monto),
            cobro.metodoPago,
            `Cobro de ${cobro.clienteNombre} transferido a ${cuentaDestino || proveedorName}`,
          ],
        ]
        await addRow("Pagos", pagoValues)
      }

      await mutate()
    } catch {
      setLocalCobros((prev) => [cobro, ...prev])
    } finally {
      setSaving(false)
      setDialogOpen(false)
    }
  }

  const columns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (cobro: Cobro) => (
        <span className="font-medium">{formatDate(cobro.fecha)}</span>
      ),
    },
    {
      key: "clienteNombre",
      header: "Cliente",
      render: (cobro: Cobro) => (
        <div>
          <p className="font-medium text-foreground">{cobro.clienteNombre}</p>
          {cobro.observaciones && (
            <p className="text-xs text-muted-foreground truncate max-w-xs">
              {cobro.observaciones}
            </p>
          )}
        </div>
      ),
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
        <Badge variant="outline" className={metodoPagoColors[cobro.metodoPago]}>
          {metodoPagoLabels[cobro.metodoPago]}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Cobrado</p>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(totalCobros)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Efectivo</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(cobrosPorMetodo.efectivo)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Transferencias</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(cobrosPorMetodo.transferencia)}
          </p>
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
            {saving ? "Guardando..." : "Nuevo Cobro"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredCobros}
        emptyMessage={isLoading ? "Cargando cobros..." : "No hay cobros registrados"}
      />

      {/* Dialog */}
      <NuevoCobroDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleNuevoCobro}
      />
    </div>
  )
}
