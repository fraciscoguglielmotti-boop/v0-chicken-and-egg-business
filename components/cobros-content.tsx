"use client"

import { useState, useMemo } from "react"
import { Plus, Filter, Download, Search, Pencil, CheckCircle2, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "./data-table"
import { SheetsStatus } from "./sheets-status"
import { useSheet, addRow, updateRowData, updateCell, deleteRow, type SheetRow } from "@/hooks/use-sheets"
import { cobrosIniciales } from "@/lib/store"
import type { Cobro } from "@/lib/types"
import { NuevoCobroDialog, type CobroEditData } from "./nuevo-cobro-dialog"
import { formatCurrency, formatDate, formatDateForSheets, formatDateInput, parseDate, parseSheetNumber, resolveEntityName } from "@/lib/utils"

interface CobroRow extends Cobro {
  _rowIndex: number
  verificado: boolean
}

function sheetRowToCobro(row: SheetRow, index: number, clienteLookup: SheetRow[]): CobroRow {
  const clienteNombre = resolveEntityName(row.Cliente || "", row.ClienteID || "", clienteLookup)
  const fecha = parseDate(row.Fecha || "")
  const verif = (row.VerificadoAgroaves || "").toString().toLowerCase()
  return {
    id: row.ID || String(index),
    fecha,
    clienteId: clienteNombre,
    clienteNombre,
    monto: parseSheetNumber(row.Monto),
    metodoPago: (row.MetodoPago as Cobro["metodoPago"]) || "efectivo",
    observaciones: row.Observaciones || undefined,
    createdAt: fecha,
    _rowIndex: index,
    verificado: verif === "true" || verif === "si" || verif === "1" || verif === "verdadero",
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
  const sheetsClientes = useSheet("Clientes")
  const [localCobros, setLocalCobros] = useState(cobrosIniciales)
  const [searchTerm, setSearchTerm] = useState("")
  const [metodoFilter, setMetodoFilter] = useState<string>("todos")
  const [verificadoFilter, setVerificadoFilter] = useState<string>("todos")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editData, setEditData] = useState<CobroEditData | null>(null)
  const [saving, setSaving] = useState(false)
  const [togglingVerif, setTogglingVerif] = useState<number | null>(null)

  const isConnected = !error && !isLoading && rows.length >= 0

  const cobros = useMemo(() => {
    if (isConnected && rows.length > 0) {
      return rows.map((row, i) => sheetRowToCobro(row, i, sheetsClientes.rows))
    }
    return localCobros.map((c, i) => ({ ...c, _rowIndex: i, verificado: false }))
  }, [isConnected, rows, localCobros, sheetsClientes.rows])

  const filteredCobros = cobros.filter((cobro) => {
    const matchesSearch = cobro.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesMetodo = metodoFilter === "todos" || cobro.metodoPago === metodoFilter
    const matchesVerif =
      verificadoFilter === "todos" ||
      (verificadoFilter === "verificados" && cobro.verificado) ||
      (verificadoFilter === "no_verificados" && !cobro.verificado)
    return matchesSearch && matchesMetodo && matchesVerif
  })

  const totalCobros = filteredCobros.reduce((acc, c) => acc + c.monto, 0)
  const cobrosPorMetodo = {
    efectivo: filteredCobros.filter((c) => c.metodoPago === "efectivo").reduce((acc, c) => acc + c.monto, 0),
    transferencia: filteredCobros.filter((c) => c.metodoPago === "transferencia").reduce((acc, c) => acc + c.monto, 0),
  }
  const verificadosCount = cobros.filter((c) => c.verificado).length
  const noVerificadosCount = cobros.filter((c) => !c.verificado).length

  const handleToggleVerificado = async (cobro: CobroRow) => {
    setTogglingVerif(cobro._rowIndex)
    try {
      const newVerif = cobro.verificado ? "FALSE" : "TRUE"
      // Use updateCell to only touch the VerificadoAgroaves column
      // If the column doesn't exist in the sheet, the API will create it automatically
      await updateCell("Cobros", cobro._rowIndex, "Verificado Agroaves", newVerif)
      await mutate()
    } catch {
      // silent
    } finally {
      setTogglingVerif(null)
    }
  }

  const handleExportar = () => {
    const headers = ["Fecha", "Cliente", "Monto", "Metodo de Pago", "Observaciones", "Verificado Agroaves"]
    const csvRows = [headers.join(",")]
    filteredCobros.forEach((c) => {
      csvRows.push([formatDateForSheets(c.fecha), `"${c.clienteNombre}"`, String(c.monto), c.metodoPago, `"${c.observaciones || ""}"`, c.verificado ? "SI" : "NO"].join(","))
    })
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cobros_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleNuevoCobro = async (cobro: Cobro, esProveedor?: boolean, cuentaDestino?: string) => {
    setSaving(true)
    try {
      let obs = cobro.observaciones || ""
      if (cobro.metodoPago === "transferencia" && cuentaDestino) {
        obs = `Cuenta: ${cuentaDestino}${obs ? ` - ${obs}` : ""}`
      }
      const sheetValues = [[cobro.id, formatDateForSheets(cobro.fecha), cobro.clienteNombre, cobro.clienteNombre, String(cobro.monto), cobro.metodoPago, obs, "FALSE"]]
      await addRow("Cobros", sheetValues)
      if (esProveedor || (cobro.metodoPago === "transferencia" && cuentaDestino?.toLowerCase().includes("agroaves"))) {
        const proveedorName = cuentaDestino?.toLowerCase().includes("agroaves") ? "Agroaves SRL" : cobro.clienteNombre
        await addRow("Pagos", [[`pago-${Date.now()}`, formatDateForSheets(cobro.fecha), proveedorName, proveedorName, String(cobro.monto), cobro.metodoPago, `Cobro de ${cobro.clienteNombre} transferido a ${cuentaDestino || proveedorName}`]])
      }
      await mutate()
    } catch {
      setLocalCobros((prev) => [cobro, ...prev])
    } finally { setSaving(false) }
  }

  const handleUpdateCobro = async (rowIndex: number, cobro: Cobro) => {
    setSaving(true)
    try {
      await updateRowData("Cobros", rowIndex, {
        "Fecha": formatDateForSheets(cobro.fecha),
        "Cliente": cobro.clienteNombre,
        "Monto": String(cobro.monto),
        "MetodoPago": cobro.metodoPago,
        "Observaciones": cobro.observaciones || "",
      })
      await mutate()
    } catch { /* silent */ } finally { setSaving(false) }
  }

  const handleDeleteCobro = async (rowIndex: number) => {
    setSaving(true)
    try { await deleteRow("Cobros", rowIndex); await mutate() }
    catch { /* silent */ } finally { setSaving(false) }
  }

  const handleEdit = (cobro: CobroRow) => {
    setEditData({
      rowIndex: cobro._rowIndex,
      fecha: formatDateInput(cobro.fecha),
      clienteId: cobro.clienteId,
      clienteNombre: cobro.clienteNombre,
      monto: cobro.monto,
      metodoPago: cobro.metodoPago,
      observaciones: cobro.observaciones || "",
    })
    setDialogOpen(true)
  }

  const columns = [
    { key: "fecha", header: "Fecha", render: (c: CobroRow) => <span className="font-medium">{formatDate(c.fecha)}</span> },
    {
      key: "clienteNombre", header: "Cliente", render: (c: CobroRow) => (
        <div>
          <p className="font-medium text-foreground">{c.clienteNombre}</p>
          {c.observaciones && <p className="text-xs text-muted-foreground truncate max-w-xs">{c.observaciones}</p>}
        </div>
      ),
    },
    { key: "monto", header: "Monto", render: (c: CobroRow) => <span className="font-semibold text-primary">{formatCurrency(c.monto)}</span> },
    { key: "metodoPago", header: "Metodo", render: (c: CobroRow) => <Badge variant="outline" className={metodoPagoColors[c.metodoPago]}>{metodoPagoLabels[c.metodoPago]}</Badge> },
    {
      key: "verificado",
      header: "Verif. Agroaves",
      render: (c: CobroRow) => (
        <button
          type="button"
          className="flex items-center gap-1.5 disabled:opacity-50"
          disabled={togglingVerif === c._rowIndex}
          onClick={(e) => { e.stopPropagation(); handleToggleVerificado(c) }}
        >
          <Checkbox
            checked={c.verificado}
            className="pointer-events-none"
            aria-label={`Verificado por Agroaves: ${c.verificado ? "Si" : "No"}`}
          />
          <span className={`text-xs ${c.verificado ? "text-primary font-medium" : "text-muted-foreground"}`}>
            {c.verificado ? "Si" : "No"}
          </span>
        </button>
      ),
    },
    {
      key: "acciones", header: "", render: (c: CobroRow) => (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEdit(c) }}>
          <Pencil className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Editar cobro</span>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Cobrado</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(totalCobros)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Efectivo</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(cobrosPorMetodo.efectivo)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Transferencias</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(cobrosPorMetodo.transferencia)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">Verificados</p>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {verificadosCount}<span className="text-sm font-normal text-muted-foreground">/{cobros.length}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={metodoFilter} onValueChange={setMetodoFilter}>
            <SelectTrigger className="w-44">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Metodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los metodos</SelectItem>
              <SelectItem value="efectivo">Efectivo</SelectItem>
              <SelectItem value="transferencia">Transferencia</SelectItem>
            </SelectContent>
          </Select>
          <Select value={verificadoFilter} onValueChange={setVerificadoFilter}>
            <SelectTrigger className="w-48">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Verificacion" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="verificados">Verificados ({verificadosCount})</SelectItem>
              <SelectItem value="no_verificados">No verificados ({noVerificadosCount})</SelectItem>
            </SelectContent>
          </Select>
          <SheetsStatus isLoading={isLoading} error={error} isConnected={isConnected} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportar}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button size="sm" onClick={() => { setEditData(null); setDialogOpen(true) }} disabled={saving}>
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : "Nuevo Cobro"}
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={filteredCobros} emptyMessage={isLoading ? "Cargando cobros..." : "No hay cobros registrados"} />

      <NuevoCobroDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditData(null) }}
        onSubmit={handleNuevoCobro}
        onUpdate={handleUpdateCobro}
        onDelete={handleDeleteCobro}
        editData={editData}
      />
    </div>
  )
}
