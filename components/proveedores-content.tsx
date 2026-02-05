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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { SheetsStatus } from "./sheets-status"
import { useSheet, addRow, type SheetRow } from "@/hooks/use-sheets"
import { proveedoresIniciales } from "@/lib/store"
import type { Proveedor } from "@/lib/types"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

function sheetRowToProveedor(row: SheetRow, index: number): Proveedor {
  return {
    id: row.ID || String(index),
    nombre: row.Nombre || "",
    cuit: row.CUIT || undefined,
    telefono: row.Telefono || undefined,
    direccion: row.Direccion || undefined,
    saldoActual: Number(row.Saldo) || 0,
    createdAt: new Date(row.FechaAlta || Date.now()),
  }
}

export function ProveedoresContent() {
  const { rows, isLoading, error, mutate } = useSheet("Proveedores")
  const [localProveedores] = useState(proveedoresIniciales)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nombre: "", cuit: "", telefono: "", direccion: "" })

  const isConnected = !error && !isLoading && rows.length >= 0

  const proveedores: Proveedor[] = useMemo(() => {
    if (isConnected && rows.length > 0) {
      return rows.map(sheetRowToProveedor)
    }
    return localProveedores
  }, [isConnected, rows, localProveedores])

  const filteredProveedores = proveedores.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cuit?.includes(searchTerm)
  )

  const totalPorPagar = filteredProveedores.reduce((acc, p) => acc + p.saldoActual, 0)

  const handleNuevoProveedor = async () => {
    if (!form.nombre) return
    setSaving(true)
    try {
      const id = Date.now().toString()
      await addRow("Proveedores", [
        [id, form.nombre, form.cuit, form.telefono, form.direccion, "0", new Date().toLocaleDateString("es-AR")],
      ])
      await mutate()
      setForm({ nombre: "", cuit: "", telefono: "", direccion: "" })
      setDialogOpen(false)
    } catch {
      // Silently handle
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      key: "nombre",
      header: "Proveedor",
      render: (p: Proveedor) => (
        <div>
          <p className="font-semibold text-foreground">{p.nombre}</p>
          {p.cuit && <p className="text-xs text-muted-foreground">CUIT: {p.cuit}</p>}
        </div>
      ),
    },
    {
      key: "contacto",
      header: "Contacto",
      render: (p: Proveedor) => (
        <div className="space-y-1">
          {p.telefono && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              {p.telefono}
            </div>
          )}
          {p.direccion && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {p.direccion}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "saldoActual",
      header: "Deuda",
      render: (p: Proveedor) => (
        <div>
          {p.saldoActual > 0 ? (
            <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">
              {formatCurrency(p.saldoActual)}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
              Sin deuda
            </Badge>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Proveedores</p>
          <p className="text-2xl font-bold text-foreground">{filteredProveedores.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total por Pagar</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalPorPagar)}</p>
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
          Nuevo Proveedor
        </Button>
      </div>

      <DataTable columns={columns} data={filteredProveedores} emptyMessage={isLoading ? "Cargando..." : "No hay proveedores registrados"} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Proveedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del proveedor" />
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
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Ruta 8 km 45" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleNuevoProveedor} disabled={!form.nombre || saving}>
              {saving ? "Guardando..." : "Guardar Proveedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
