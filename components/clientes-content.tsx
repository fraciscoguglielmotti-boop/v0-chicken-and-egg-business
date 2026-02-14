"use client"

import { useState, useMemo } from "react"
import { Plus, Search, Phone, MapPin, ArrowUpDown, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { SheetsStatus } from "./sheets-status"
import { useSheet, addRow, updateRow, deleteRow, type SheetRow } from "@/hooks/use-sheets"
import type { Cliente } from "@/lib/types"
import {
  formatCurrency,
  parseDate,
  parseSheetNumber,
  formatDateForSheets,
  resolveVentaMonto,
  resolveEntityName,
} from "@/lib/utils"

function sheetRowToCliente(row: SheetRow, index: number): Cliente {
  return {
    id: row.ID || String(index),
    nombre: row.Nombre || "",
    cuit: row.CUIT || undefined,
    telefono: row.Telefono || undefined,
    direccion: row.Direccion || undefined,
    saldoActual: parseSheetNumber(row.SaldoInicial),
    createdAt: parseDate(row.FechaAlta || ""),
  }
}

type ClienteConSaldo = Cliente & { saldoCalculado: number; totalVentas: number; totalCobros: number; _rowIndex: number }

export function ClientesContent() {
  const { rows, isLoading, error, mutate } = useSheet("Clientes")
  const sheetsVentas = useSheet("Ventas")
  const sheetsCobros = useSheet("Cobros")

  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<"nombre" | "saldo">("nombre")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editRowIndex, setEditRowIndex] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    nombre: "",
    cuit: "",
    telefono: "",
    direccion: "",
    saldoInicial: "0",
  })

  const isConnected = !error && !isLoading && rows.length >= 0

  // Calculate real balances from Ventas and Cobros
  const clientes: ClienteConSaldo[] = useMemo(() => {
    if (!isConnected) return []
    const base = rows.map((row, i) => ({ ...sheetRowToCliente(row, i), _rowIndex: i }))

    return base.map((cliente) => {
      const clienteKey = cliente.nombre.toLowerCase().trim()
      const saldoInicial = cliente.saldoActual || 0

      // Sum all ventas (Debe) for this client
      let totalVentas = 0
      sheetsVentas.rows.forEach((r) => {
        const c = resolveEntityName(r.Cliente || "", r.ClienteID || "", rows).toLowerCase().trim()
        if (c === clienteKey) {
          const { total } = resolveVentaMonto(r)
          totalVentas += total
        }
      })

      // Sum all cobros (Haber) for this client
      let totalCobros = 0
      sheetsCobros.rows.forEach((r) => {
        const c = resolveEntityName(r.Cliente || "", r.ClienteID || "", rows).toLowerCase().trim()
        if (c === clienteKey) {
          totalCobros += parseSheetNumber(r.Monto)
        }
      })

      const saldoCalculado = saldoInicial + totalVentas - totalCobros

      return {
        ...cliente,
        saldoCalculado,
        totalVentas,
        totalCobros,
      }
    })
  }, [isConnected, rows, sheetsVentas.rows, sheetsCobros.rows])

  const filteredClientes = useMemo(() => {
    const filtered = clientes.filter(
      (cliente) =>
        cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.cuit?.includes(searchTerm),
    )
    if (sortBy === "nombre") {
      return [...filtered].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    }
    return [...filtered].sort((a, b) => b.saldoCalculado - a.saldoCalculado)
  }, [clientes, searchTerm, sortBy])

  const totalPorCobrar = filteredClientes.reduce((acc, c) => acc + Math.max(0, c.saldoCalculado), 0)
  const clientesConDeuda = filteredClientes.filter((c) => c.saldoCalculado > 0).length

  const resetForm = () => {
    setForm({ nombre: "", cuit: "", telefono: "", direccion: "", saldoInicial: "0" })
    setEditRowIndex(null)
    setConfirmDelete(false)
    setFormErrors({})
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    resetForm()
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.nombre.trim()) errs.nombre = "El nombre es obligatorio"
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleGuardar = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const rowData = [
        editRowIndex !== null ? (rows[editRowIndex]?.ID || "") : Date.now().toString(),
        form.nombre.trim(),
        form.cuit.trim(),
        form.telefono.trim(),
        form.direccion.trim(),
        form.saldoInicial || "0",
        editRowIndex !== null ? (rows[editRowIndex]?.FechaAlta || formatDateForSheets(new Date())) : formatDateForSheets(new Date()),
      ]
      if (editRowIndex !== null) {
        await updateRow("Clientes", editRowIndex, rowData)
      } else {
        await addRow("Clientes", [rowData])
      }
      await mutate()
      handleCloseDialog()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    if (editRowIndex === null) return
    setSaving(true)
    try {
      await deleteRow("Clientes", editRowIndex)
      await mutate()
      handleCloseDialog()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (cliente: ClienteConSaldo) => {
    setEditRowIndex(cliente._rowIndex)
    setForm({
      nombre: cliente.nombre,
      cuit: cliente.cuit || "",
      telefono: cliente.telefono || "",
      direccion: cliente.direccion || "",
      saldoInicial: String(cliente.saldoActual || 0),
    })
    setDialogOpen(true)
  }

  const columns = [
    {
      key: "nombre",
      header: "Cliente",
      render: (cliente: ClienteConSaldo) => (
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
      render: (cliente: ClienteConSaldo) => (
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
      key: "ventas",
      header: "Ventas",
      render: (cliente: ClienteConSaldo) => (
        <span className="text-sm text-muted-foreground">{formatCurrency(cliente.totalVentas)}</span>
      ),
    },
    {
      key: "cobros",
      header: "Cobros",
      render: (cliente: ClienteConSaldo) => (
        <span className="text-sm text-muted-foreground">{formatCurrency(cliente.totalCobros)}</span>
      ),
    },
    {
      key: "saldoCalculado",
      header: "Saldo",
      render: (cliente: ClienteConSaldo) => (
        <span
          className={`font-semibold ${
            cliente.saldoCalculado > 0
              ? "text-destructive"
              : cliente.saldoCalculado < 0
                ? "text-primary"
                : "text-muted-foreground"
          }`}
        >
          {formatCurrency(cliente.saldoCalculado)}
        </span>
      ),
    },
    {
      key: "acciones",
      header: "",
      render: (cliente: ClienteConSaldo) => (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(cliente)}>
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="sr-only">Editar cliente</span>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Clientes</p>
          <p className="text-2xl font-bold text-foreground">{filteredClientes.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Con Deuda</p>
          <p className="text-2xl font-bold text-accent">{clientesConDeuda}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total por Cobrar</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(totalPorCobrar)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o CUIT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as "nombre" | "saldo")}>
            <SelectTrigger className="w-48">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nombre">Nombre A - Z</SelectItem>
              <SelectItem value="saldo">Mayor deuda</SelectItem>
            </SelectContent>
          </Select>
          <SheetsStatus isLoading={isLoading} error={error} isConnected={isConnected} />
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredClientes}
        emptyMessage={isLoading ? "Cargando clientes..." : "No hay clientes registrados"}
      />

      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-md" onEscapeKeyDown={handleCloseDialog}>
          <DialogHeader>
            <DialogTitle>{editRowIndex !== null ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
            <DialogDescription>
              {editRowIndex !== null ? "Modifique los datos del cliente" : "Complete los datos del nuevo cliente"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => { setForm({ ...form, nombre: e.target.value }); setFormErrors((er) => ({ ...er, nombre: "" })) }}
                placeholder="Nombre del cliente"
                className={formErrors.nombre ? "border-destructive" : ""}
              />
              {formErrors.nombre && <p className="text-xs text-destructive">{formErrors.nombre}</p>}
            </div>
            <div className="space-y-2">
              <Label>CUIT</Label>
              <Input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} placeholder="XX-XXXXXXXX-X" />
            </div>
            <div className="space-y-2">
              <Label>Telefono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="11-XXXX-XXXX" />
            </div>
            <div className="space-y-2">
              <Label>Direccion</Label>
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Calle 123" />
            </div>
            <div className="space-y-2">
              <Label>Saldo Inicial</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={form.saldoInicial}
                  onChange={(e) => setForm({ ...form, saldoInicial: e.target.value })}
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Si el cliente tiene una deuda previa al sistema, ingrese el monto aca. Las ventas y cobros registrados se suman automaticamente.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {editRowIndex !== null && (
              <Button variant="destructive" onClick={handleDelete} className="sm:mr-auto" disabled={saving}>
                {confirmDelete ? "Confirmar Eliminacion" : "Eliminar"}
              </Button>
            )}
            <Button variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={saving}>
              {saving ? "Guardando..." : editRowIndex !== null ? "Guardar Cambios" : "Guardar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
