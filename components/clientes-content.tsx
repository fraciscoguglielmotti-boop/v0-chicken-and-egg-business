"use client"

import { useState, useMemo } from "react"
import { Plus, Search, Phone, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { useSheet, addRow, type SheetRow } from "@/hooks/use-sheets"
import { clientesIniciales } from "@/lib/store"
import type { Cliente } from "@/lib/types"
import { formatCurrency, parseDate } from "@/lib/utils"

function sheetRowToCliente(row: SheetRow, index: number): Cliente {
  return {
    id: row.ID || String(index),
    nombre: row.Nombre || "",
    cuit: row.CUIT || undefined,
    telefono: row.Telefono || undefined,
    direccion: row.Direccion || undefined,
    saldoActual: Number(row.Saldo) || 0,
    createdAt: parseDate(row.FechaAlta || ""),
  }
}

export function ClientesContent() {
  const { rows, isLoading, error, mutate } = useSheet("Clientes")
  const [localClientes] = useState(clientesIniciales)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nombre: "", cuit: "", telefono: "", direccion: "" })

  const isConnected = !error && !isLoading && rows.length >= 0

  const clientes: Cliente[] = useMemo(() => {
    if (isConnected && rows.length > 0) {
      return rows.map(sheetRowToCliente)
    }
    return localClientes
  }, [isConnected, rows, localClientes])

  const filteredClientes = clientes.filter(
    (cliente) =>
      cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.cuit?.includes(searchTerm)
  )

  const totalPorCobrar = filteredClientes.reduce((acc, c) => acc + c.saldoActual, 0)
  const clientesConDeuda = filteredClientes.filter((c) => c.saldoActual > 0).length

  const handleNuevoCliente = async () => {
    if (!form.nombre) return
    setSaving(true)
    try {
      const id = Date.now().toString()
      await addRow("Clientes", [
        [id, form.nombre, form.cuit, form.telefono, form.direccion, "0", new Date().toLocaleDateString("es-AR")],
      ])
      await mutate()
      setForm({ nombre: "", cuit: "", telefono: "", direccion: "" })
      setDialogOpen(false)
    } catch {
      // Silently handle error
    } finally {
      setSaving(false)
    }
  }

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
        <span className={`font-semibold ${cliente.saldoActual > 0 ? "text-destructive" : cliente.saldoActual < 0 ? "text-primary" : "text-muted-foreground"}`}>
          {formatCurrency(cliente.saldoActual)}
        </span>
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
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o CUIT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
            <DialogDescription>Complete los datos del nuevo cliente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del cliente" />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleNuevoCliente} disabled={!form.nombre || saving}>
              {saving ? "Guardando..." : "Guardar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
