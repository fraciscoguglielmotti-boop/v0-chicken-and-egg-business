"use client"

import { useState, useMemo } from "react"
import { Plus, Filter, Download, Search, Pencil } from "lucide-react"
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
import { useSheet, addRow, updateRowData, deleteRow, type SheetRow } from "@/hooks/use-sheets"
import type { Pago } from "@/lib/types"
import { NuevoPagoDialog, type PagoEditData } from "./nuevo-pago-dialog"
import { formatCurrency, formatDateForSheets, formatDate, formatDateInput, parseDate, parseSheetNumber, resolveEntityName } from "@/lib/utils"

function sheetRowToPago(row: SheetRow, index: number, proveedorLookup: SheetRow[]): Pago & { _rowIndex: number } {
  const proveedorNombre = resolveEntityName(row.Proveedor || "", row.ProveedorID || "", proveedorLookup)
  const fecha = parseDate(row.Fecha || "")
  return {
    id: row.ID || String(index),
    fecha,
    proveedorId: proveedorNombre,
    proveedorNombre,
    monto: parseSheetNumber(row.Monto),
    metodoPago: (row.MetodoPago as Pago["metodoPago"]) || "efectivo",
    observaciones: row.Observaciones || undefined,
    createdAt: fecha,
    _rowIndex: index,
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

function isCobroTransferenciaAgroaves(row: SheetRow): boolean {
  if ((row.MetodoPago || "").toLowerCase() !== "transferencia") return false
  const obs = (row.Observaciones || "").toLowerCase()
  return obs.includes("agroaves")
}

export function PagosContent() {
  const { rows, isLoading, error, mutate } = useSheet("Pagos")
  const sheetsCobros = useSheet("Cobros")
  const sheetsProveedores = useSheet("Proveedores")
  const [searchTerm, setSearchTerm] = useState("")
  const [metodoFilter, setMetodoFilter] = useState<string>("todos")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editData, setEditData] = useState<PagoEditData | null>(null)
  const [saving, setSaving] = useState(false)

  const isConnected = !error && !isLoading && rows.length >= 0

  const pagos = useMemo(() => {
    const result: (Pago & { _rowIndex: number; _isVirtual?: boolean })[] = []
    if (isConnected && rows.length > 0) {
      rows.forEach((row, i) => result.push(sheetRowToPago(row, i, sheetsProveedores.rows)))
    }
    if (isConnected && sheetsCobros.rows.length > 0) {
      sheetsCobros.rows.forEach((row, i) => {
        if (isCobroTransferenciaAgroaves(row)) {
          const obs = row.Observaciones || ""
          const cuentaMatch = obs.match(/Cuenta:\s*([^-]+)/i)
          const cuentaDestino = cuentaMatch ? cuentaMatch[1].trim() : "Agroaves SRL"
          const clienteNombre = row.Cliente || row.ClienteID || ""
          const fechaCobro = parseDate(row.Fecha || "")
          result.push({
            id: `cobro-pago-${row.ID || i}`,
            fecha: fechaCobro,
            proveedorId: "Agroaves SRL",
            proveedorNombre: "Agroaves SRL",
            monto: parseSheetNumber(row.Monto),
            metodoPago: "transferencia",
            observaciones: `Transferencia de ${clienteNombre} a ${cuentaDestino}`,
            createdAt: fechaCobro,
            _rowIndex: -1,
            _isVirtual: true,
          })
        }
      })
    }
    return result.sort((a, b) => parseDate(b.fecha).getTime() - parseDate(a.fecha).getTime())
  }, [isConnected, rows, sheetsProveedores.rows, sheetsCobros.rows])

  const filteredPagos = pagos.filter((pago) => {
    const matchesSearch = pago.proveedorNombre.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesMetodo = metodoFilter === "todos" || pago.metodoPago === metodoFilter
    return matchesSearch && matchesMetodo
  })

  const totalPagos = filteredPagos.reduce((acc, p) => acc + p.monto, 0)
  const pagosPorMetodo = {
    efectivo: filteredPagos.filter((p) => p.metodoPago === "efectivo").reduce((acc, p) => acc + p.monto, 0),
    transferencia: filteredPagos.filter((p) => p.metodoPago === "transferencia").reduce((acc, p) => acc + p.monto, 0),
  }

  const handleExportar = () => {
    const headers = ["Fecha", "Proveedor", "Monto", "Metodo de Pago", "Observaciones"]
    const csvRows = [headers.join(",")]
    filteredPagos.forEach((p) => {
      csvRows.push([formatDate(p.fecha), `"${p.proveedorNombre}"`, String(p.monto), p.metodoPago, `"${p.observaciones || ""}"`].join(","))
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
      const sheetValues = [[pago.id, formatDateForSheets(pago.fecha), pago.proveedorNombre, pago.proveedorNombre, String(pago.monto), pago.metodoPago, pago.observaciones || ""]]
      await addRow("Pagos", sheetValues)
      await mutate()
    } catch { /* silent */ } finally { setSaving(false) }
  }

  const handleUpdatePago = async (rowIndex: number, pago: Pago) => {
    setSaving(true)
    try {
      await updateRowData("Pagos", rowIndex, {
        "Fecha": formatDateForSheets(pago.fecha),
        "Proveedor": pago.proveedorNombre,
        "Monto": String(pago.monto),
        "MetodoPago": pago.metodoPago,
        "Observaciones": pago.observaciones || "",
      })
      await mutate()
    } catch { /* silent */ } finally { setSaving(false) }
  }

  const handleDeletePago = async (rowIndex: number) => {
    setSaving(true)
    try { await deleteRow("Pagos", rowIndex); await mutate() }
    catch { /* silent */ } finally { setSaving(false) }
  }

  const handleEdit = (pago: Pago & { _rowIndex: number; _isVirtual?: boolean }) => {
    if (pago._isVirtual || pago._rowIndex < 0) return // Can't edit virtual pagos from cobros
    setEditData({
      rowIndex: pago._rowIndex,
      fecha: formatDateInput(pago.fecha),
      proveedorId: pago.proveedorId,
      proveedorNombre: pago.proveedorNombre,
      monto: pago.monto,
      metodoPago: pago.metodoPago,
      observaciones: pago.observaciones || "",
    })
    setDialogOpen(true)
  }

  const columns = [
    { key: "fecha", header: "Fecha", render: (p: Pago & { _rowIndex: number; _isVirtual?: boolean }) => <span className="font-medium">{formatDate(p.fecha)}</span> },
    {
      key: "proveedorNombre", header: "Proveedor", render: (p: Pago & { _rowIndex: number; _isVirtual?: boolean }) => (
        <div>
          <p className="font-medium text-foreground">{p.proveedorNombre}</p>
          {p.observaciones && <p className="text-xs text-muted-foreground truncate max-w-xs">{p.observaciones}</p>}
        </div>
      ),
    },
    { key: "monto", header: "Monto", render: (p: Pago & { _rowIndex: number }) => <span className="font-semibold text-destructive">{formatCurrency(p.monto)}</span> },
    { key: "metodoPago", header: "Metodo", render: (p: Pago & { _rowIndex: number }) => <Badge variant="outline" className={metodoPagoColors[p.metodoPago]}>{metodoPagoLabels[p.metodoPago]}</Badge> },
    {
      key: "acciones", header: "", render: (p: Pago & { _rowIndex: number; _isVirtual?: boolean }) => (
        p._isVirtual ? <span className="text-xs text-muted-foreground italic">Auto</span> : (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEdit(p) }}>
            <Pencil className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Editar pago</span>
          </Button>
        )
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Pagado</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalPagos)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Efectivo</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(pagosPorMetodo.efectivo)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Transferencias</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(pagosPorMetodo.transferencia)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por proveedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
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
          <Button size="sm" onClick={() => { setEditData(null); setDialogOpen(true) }} disabled={saving}>
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : "Nuevo Pago"}
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={filteredPagos} emptyMessage={isLoading ? "Cargando pagos..." : "No hay pagos registrados"} />

      <NuevoPagoDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditData(null) }}
        onSubmit={handleNuevoPago}
        onUpdate={handleUpdatePago}
        onDelete={handleDeletePago}
        editData={editData}
      />
    </div>
  )
}
