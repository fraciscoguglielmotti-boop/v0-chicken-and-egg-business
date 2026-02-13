"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { Plus, Search, Pencil } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "./data-table"
import { SheetsStatus } from "./sheets-status"
import { useSheet, addRow, updateRow, deleteRow, type SheetRow } from "@/hooks/use-sheets"
import { PRODUCTOS, type Compra, type ProductoTipo } from "@/lib/types"
import { formatCurrency, formatDate, formatDateForSheets, formatDateInput, parseDate, resolveEntityName, resolveVentaMonto } from "@/lib/utils"

function sheetRowToCompra(row: SheetRow, index: number, proveedorLookup: SheetRow[]): Compra & { _rowIndex: number } {
  const { cantidad, precioUnitario, total } = resolveVentaMonto(row)
  const fecha = parseDate(row.Fecha || "")
  const proveedorNombre = resolveEntityName(row.Proveedor || "", row.ProveedorID || "", proveedorLookup)
  return {
    id: row.ID || String(index),
    fecha,
    proveedorId: proveedorNombre,
    proveedorNombre,
    items: [{
      productoId: (row.ProductoID || "pollo_a") as ProductoTipo,
      productoNombre: row.Producto || "",
      cantidad,
      precioUnitario,
      subtotal: total,
    }],
    total,
    estado: (row.Estado as Compra["estado"]) || "pendiente",
    createdAt: fecha,
    _rowIndex: index,
  }
}

const estadoColors = {
  pendiente: "bg-accent/20 text-accent-foreground border-accent/30",
  pagada: "bg-primary/20 text-primary border-primary/30",
  parcial: "bg-secondary text-secondary-foreground border-border",
}

interface CompraEditData {
  rowIndex: number
  proveedorId: string
  proveedorNombre: string
  fecha: string
  productoId: string
  cantidad: string
  precioUnitario: string
}

export function ComprasContent() {
  const sheetsCompras = useSheet("Compras")
  const sheetsProveedores = useSheet("Proveedores")
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editData, setEditData] = useState<CompraEditData | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    proveedorId: "",
    proveedorNombre: "",
    fecha: new Date().toISOString().split("T")[0],
    productoId: "" as ProductoTipo | "",
    cantidad: "",
    precioUnitario: "",
  })

  const isConnected = !sheetsCompras.error && !sheetsCompras.isLoading

  const compras = useMemo(() => {
    if (isConnected && sheetsCompras.rows.length > 0) {
      return sheetsCompras.rows.map((row, i) => sheetRowToCompra(row, i, sheetsProveedores.rows))
    }
    return []
  }, [isConnected, sheetsCompras.rows, sheetsProveedores.rows])

  const proveedoresFromSheets = useMemo(() => {
    return sheetsProveedores.rows.map((row) => ({ id: row.ID || "", nombre: row.Nombre || "" }))
  }, [sheetsProveedores.rows])

  const filteredCompras = compras.filter((c) =>
    c.proveedorNombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalCompras = filteredCompras.reduce((acc, c) => acc + c.total, 0)
  const subtotal = form.cantidad && form.precioUnitario ? Number(form.cantidad) * Number(form.precioUnitario) : 0

  // Populate form on edit
  useEffect(() => {
    if (editData && dialogOpen) {
      const prov = proveedoresFromSheets.find((p) => p.nombre === editData.proveedorNombre)
      setForm({
        proveedorId: prov?.id || editData.proveedorId,
        proveedorNombre: editData.proveedorNombre,
        fecha: editData.fecha,
        productoId: editData.productoId as ProductoTipo,
        cantidad: editData.cantidad,
        precioUnitario: editData.precioUnitario,
      })
    }
  }, [editData, dialogOpen])

  const resetForm = () => {
    setForm({ proveedorId: "", proveedorNombre: "", fecha: new Date().toISOString().split("T")[0], productoId: "", cantidad: "", precioUnitario: "" })
    setErrors({})
    setConfirmDelete(false)
    setEditData(null)
  }

  const handleClose = useCallback(() => {
    setDialogOpen(false)
    resetForm()
  }, [])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!form.proveedorId) newErrors.proveedor = "Seleccione un proveedor"
    if (!form.productoId) newErrors.producto = "Seleccione un producto"
    if (!form.cantidad || Number(form.cantidad) <= 0) newErrors.cantidad = "Cantidad debe ser mayor a 0"
    if (!form.precioUnitario || Number(form.precioUnitario) <= 0) newErrors.precio = "Precio debe ser mayor a 0"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleGuardar = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const producto = PRODUCTOS.find((p) => p.id === form.productoId)
      if (editData) {
        const values = [sheetsCompras.rows[editData.rowIndex]?.ID || "", formatDateForSheets(form.fecha), form.proveedorNombre, producto?.nombre || "", form.cantidad, form.precioUnitario, String(subtotal), "pendiente"]
        await updateRow("Compras", editData.rowIndex, values)
      } else {
        const id = Date.now().toString()
        await addRow("Compras", [[id, formatDateForSheets(form.fecha), form.proveedorNombre, producto?.nombre || "", form.cantidad, form.precioUnitario, String(subtotal), "pendiente"]])
      }
      await sheetsCompras.mutate()
      handleClose()
    } catch { /* silent */ } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    if (!editData) return
    setSaving(true)
    try { await deleteRow("Compras", editData.rowIndex); await sheetsCompras.mutate(); handleClose() }
    catch { /* silent */ } finally { setSaving(false) }
  }

  const handleEdit = (compra: Compra & { _rowIndex: number }) => {
    setEditData({
      rowIndex: compra._rowIndex,
      proveedorId: compra.proveedorId,
      proveedorNombre: compra.proveedorNombre,
      fecha: formatDateInput(compra.fecha),
      productoId: compra.items[0]?.productoId || "",
      cantidad: String(compra.items[0]?.cantidad || ""),
      precioUnitario: String(compra.items[0]?.precioUnitario || ""),
    })
    setDialogOpen(true)
  }

  const isEditing = !!editData

  const columns = [
    { key: "fecha", header: "Fecha", render: (c: Compra & { _rowIndex: number }) => <span className="font-medium">{formatDate(c.fecha)}</span> },
    { key: "proveedorNombre", header: "Proveedor", render: (c: Compra & { _rowIndex: number }) => <span className="font-medium text-foreground">{c.proveedorNombre}</span> },
    {
      key: "producto", header: "Producto", render: (c: Compra & { _rowIndex: number }) => (
        <div>{c.items.map((item, idx) => (<p key={idx} className="text-sm text-muted-foreground">{item.cantidad} x {item.productoNombre}</p>))}</div>
      ),
    },
    { key: "total", header: "Total", render: (c: Compra & { _rowIndex: number }) => <span className="font-semibold text-foreground">{formatCurrency(c.total)}</span> },
    { key: "estado", header: "Estado", render: (c: Compra & { _rowIndex: number }) => <Badge variant="outline" className={estadoColors[c.estado]}>{c.estado.charAt(0).toUpperCase() + c.estado.slice(1)}</Badge> },
    {
      key: "acciones", header: "", render: (c: Compra & { _rowIndex: number }) => (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEdit(c) }}>
          <Pencil className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Editar compra</span>
        </Button>
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
        <Button size="sm" onClick={() => { setEditData(null); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Compra
        </Button>
      </div>

      <DataTable columns={columns} data={filteredCompras} emptyMessage={sheetsCompras.isLoading ? "Cargando..." : "No hay compras registradas."} />

      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md" onEscapeKeyDown={handleClose}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Compra" : "Nueva Compra"}</DialogTitle>
            <DialogDescription>{isEditing ? "Modifique los datos de la compra" : "Registre una nueva compra a proveedor"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Select
                value={form.proveedorId}
                onValueChange={(v) => {
                  const prov = proveedoresFromSheets.find((p) => p.id === v)
                  setForm({ ...form, proveedorId: v, proveedorNombre: prov?.nombre || "" })
                  setErrors((e) => ({ ...e, proveedor: "" }))
                }}
              >
                <SelectTrigger className={errors.proveedor ? "border-destructive" : ""}>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {proveedoresFromSheets.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>))}
                </SelectContent>
              </Select>
              {errors.proveedor && <p className="text-xs text-destructive">{errors.proveedor}</p>}
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Producto</Label>
              <Select value={form.productoId} onValueChange={(v) => { setForm({ ...form, productoId: v as ProductoTipo }); setErrors((e) => ({ ...e, producto: "" })) }}>
                <SelectTrigger className={errors.producto ? "border-destructive" : ""}>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTOS.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>))}
                </SelectContent>
              </Select>
              {errors.producto && <p className="text-xs text-destructive">{errors.producto}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input type="number" placeholder="0" value={form.cantidad} onChange={(e) => { setForm({ ...form, cantidad: e.target.value }); setErrors((er) => ({ ...er, cantidad: "" })) }} className={errors.cantidad ? "border-destructive" : ""} min="0.01" step="any" />
                {errors.cantidad && <p className="text-xs text-destructive">{errors.cantidad}</p>}
              </div>
              <div className="space-y-2">
                <Label>Precio Unitario</Label>
                <Input type="number" placeholder="0" value={form.precioUnitario} onChange={(e) => { setForm({ ...form, precioUnitario: e.target.value }); setErrors((er) => ({ ...er, precio: "" })) }} className={errors.precio ? "border-destructive" : ""} min="0.01" step="any" />
                {errors.precio && <p className="text-xs text-destructive">{errors.precio}</p>}
              </div>
            </div>
            {subtotal > 0 && (
              <div className="rounded-lg bg-muted/50 p-4 flex items-center justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-xl font-bold text-foreground">{formatCurrency(subtotal)}</span>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {isEditing && (
              <Button variant="destructive" onClick={handleDelete} className="sm:mr-auto">
                {confirmDelete ? "Confirmar Eliminacion" : "Eliminar"}
              </Button>
            )}
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={saving}>
              {saving ? "Guardando..." : isEditing ? "Guardar Cambios" : "Guardar Compra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
