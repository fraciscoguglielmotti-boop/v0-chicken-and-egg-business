"use client"

import { useState, useMemo } from "react"
import { Plus, Filter, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { PRODUCTOS, type Compra, type ProductoTipo } from "@/lib/types"
import { formatCurrency, formatDate, formatDateForSheets } from "@/lib/utils"

function sheetRowToCompra(row: SheetRow, index: number): Compra {
  const cantidad = Number(row.Cantidad) || 0
  const precioUnitario = Number(row.PrecioUnitario) || Number(row["Precio Unitario"]) || 0
  const total = cantidad * precioUnitario

  return {
    id: row.ID || String(index),
    fecha: new Date(row.Fecha || Date.now()),
    proveedorId: row.ProveedorID || "",
    proveedorNombre: row.Proveedor || "",
    items: [{
      productoId: (row.ProductoID || "pollo_a") as ProductoTipo,
      productoNombre: row.Producto || "",
      cantidad,
      precioUnitario,
      subtotal: total,
    }],
    total,
    estado: (row.Estado as Compra["estado"]) || "pendiente",
    createdAt: new Date(row.Fecha || Date.now()),
  }
}

const estadoColors = {
  pendiente: "bg-accent/20 text-accent-foreground border-accent/30",
  pagada: "bg-primary/20 text-primary border-primary/30",
  parcial: "bg-secondary text-secondary-foreground border-border",
}

export function ComprasContent() {
  const sheetsCompras = useSheet("Compras")
  const sheetsProveedores = useSheet("Proveedores")
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    proveedorId: "",
    proveedorNombre: "",
    fecha: new Date().toISOString().split("T")[0],
    productoId: "" as ProductoTipo | "",
    cantidad: "",
    precioUnitario: "",
  })

  const isConnected = !sheetsCompras.error && !sheetsCompras.isLoading

  const compras: Compra[] = useMemo(() => {
    if (isConnected && sheetsCompras.rows.length > 0) {
      return sheetsCompras.rows.map(sheetRowToCompra)
    }
    return []
  }, [isConnected, sheetsCompras.rows])

  const proveedoresFromSheets = useMemo(() => {
    return sheetsProveedores.rows.map((row) => ({
      id: row.ID || "",
      nombre: row.Nombre || "",
    }))
  }, [sheetsProveedores.rows])

  const filteredCompras = compras.filter((c) =>
    c.proveedorNombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalCompras = filteredCompras.reduce((acc, c) => acc + c.total, 0)
  const subtotal = form.cantidad && form.precioUnitario
    ? Number(form.cantidad) * Number(form.precioUnitario)
    : 0

  const handleNuevaCompra = async () => {
    if (!form.proveedorId || !form.productoId || !form.cantidad || !form.precioUnitario) return
    setSaving(true)
    try {
      const producto = PRODUCTOS.find((p) => p.id === form.productoId)
      const id = Date.now().toString()
      await addRow("Compras", [
        [
          id,
          formatDateForSheets(form.fecha),
          form.proveedorId,
          form.proveedorNombre,
          form.productoId,
          producto?.nombre || "",
          form.cantidad,
          form.precioUnitario,
          String(subtotal),
          "pendiente",
        ],
      ])
      await sheetsCompras.mutate()
      setForm({ proveedorId: "", proveedorNombre: "", fecha: new Date().toISOString().split("T")[0], productoId: "", cantidad: "", precioUnitario: "" })
      setDialogOpen(false)
    } catch {
      // handle error
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (c: Compra) => <span className="font-medium">{formatDate(c.fecha)}</span>,
    },
    {
      key: "proveedorNombre",
      header: "Proveedor",
      render: (c: Compra) => <span className="font-medium text-foreground">{c.proveedorNombre}</span>,
    },
    {
      key: "producto",
      header: "Producto",
      render: (c: Compra) => (
        <div>
          {c.items.map((item, idx) => (
            <p key={idx} className="text-sm text-muted-foreground">
              {item.cantidad} x {item.productoNombre}
            </p>
          ))}
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      render: (c: Compra) => <span className="font-semibold text-foreground">{formatCurrency(c.total)}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      render: (c: Compra) => (
        <Badge variant="outline" className={estadoColors[c.estado]}>
          {c.estado.charAt(0).toUpperCase() + c.estado.slice(1)}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Compras Registradas</p>
          <p className="text-2xl font-bold text-foreground">{filteredCompras.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Compras</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalCompras)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Proveedores</p>
          <p className="text-2xl font-bold text-foreground">{proveedoresFromSheets.length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar compras..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <SheetsStatus isLoading={sheetsCompras.isLoading} error={sheetsCompras.error} isConnected={isConnected} />
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Compra
        </Button>
      </div>

      <DataTable columns={columns} data={filteredCompras} emptyMessage={sheetsCompras.isLoading ? "Cargando..." : "No hay compras registradas. Crea la primera desde el boton Nueva Compra."} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Compra</DialogTitle>
            <DialogDescription>
              Registre una nueva compra a proveedor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Select
                value={form.proveedorId}
                onValueChange={(v) => {
                  const prov = proveedoresFromSheets.find((p) => p.id === v)
                  setForm({ ...form, proveedorId: v, proveedorNombre: prov?.nombre || "" })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {proveedoresFromSheets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Producto</Label>
              <Select value={form.productoId} onValueChange={(v) => setForm({ ...form, productoId: v as ProductoTipo })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTOS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input type="number" placeholder="0" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Precio Unitario</Label>
                <Input type="number" placeholder="0" value={form.precioUnitario} onChange={(e) => setForm({ ...form, precioUnitario: e.target.value })} />
              </div>
            </div>
            {subtotal > 0 && (
              <div className="rounded-lg bg-muted/50 p-4 flex items-center justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-xl font-bold text-foreground">{formatCurrency(subtotal)}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleNuevaCompra} disabled={!form.proveedorId || !form.productoId || !form.cantidad || !form.precioUnitario || saving}>
              {saving ? "Guardando..." : "Guardar Compra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
