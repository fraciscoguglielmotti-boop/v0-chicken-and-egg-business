"use client"

import { useState, useEffect, useCallback } from "react"
import { parseDate, parseSheetNumber, formatCurrency, formatDateInput } from "@/lib/utils"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { clientesIniciales } from "@/lib/store"
import { PRODUCTOS, type Venta, type VentaItem, type ProductoTipo } from "@/lib/types"
import { useSheet } from "@/hooks/use-sheets"

export interface VentaEditData {
  rowIndex: number
  fecha: string
  clienteId: string
  clienteNombre: string
  vendedor: string
  items: VentaItem[]
  total: number
}

interface NuevaVentaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (venta: Venta & { vendedor?: string }) => void
  onUpdate?: (rowIndex: number, venta: Venta & { vendedor?: string }) => void
  onDelete?: (rowIndex: number) => void
  editData?: VentaEditData | null
}

export function NuevaVentaDialog({
  open,
  onOpenChange,
  onSubmit,
  onUpdate,
  onDelete,
  editData,
}: NuevaVentaDialogProps) {
  const sheetsVendedores = useSheet("Vendedores")
  const sheetsClientes = useSheet("Clientes")
  const [clienteId, setClienteId] = useState("")
  const [vendedor, setVendedor] = useState("")
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [items, setItems] = useState<VentaItem[]>([])
  const [nuevoProducto, setNuevoProducto] = useState<ProductoTipo | "">("")
  const [cantidad, setCantidad] = useState("")
  const [precioUnitario, setPrecioUnitario] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const allClientes = sheetsClientes.rows.length > 0
    ? sheetsClientes.rows.map((r, i) => ({
        id: r.ID || String(i),
        nombre: r.Nombre || "",
        saldo: parseSheetNumber(r.Saldo),
      }))
    : clientesIniciales.map((c) => ({ id: c.id, nombre: c.nombre, saldo: c.saldoActual || 0 }))

  const allVendedores = sheetsVendedores.rows
    .filter((r) => r.Nombre)
    .map((r) => r.Nombre)

  const cliente = allClientes.find((c) => c.id === clienteId)
  const total = items.reduce((acc, item) => acc + item.subtotal, 0)

  // Populate form when editing
  useEffect(() => {
    if (editData && open) {
      setFecha(editData.fecha)
      setVendedor(editData.vendedor || "")
      setItems(editData.items)
      // Find client by name
      const c = allClientes.find((cl) => cl.nombre === editData.clienteNombre)
      setClienteId(c?.id || "")
    } else if (!open) {
      resetForm()
    }
  }, [editData, open])

  const resetForm = () => {
    setClienteId("")
    setVendedor("")
    setFecha(new Date().toISOString().split("T")[0])
    setItems([])
    setNuevoProducto("")
    setCantidad("")
    setPrecioUnitario("")
    setErrors({})
    setConfirmDelete(false)
  }

  const handleClose = useCallback(() => {
    onOpenChange(false)
    resetForm()
  }, [onOpenChange])

  const validateItem = (): boolean => {
    const newErrors: Record<string, string> = {}
    const cantNum = Number.parseFloat(cantidad)
    const precioNum = Number.parseFloat(precioUnitario)
    if (!nuevoProducto) newErrors.producto = "Seleccione un producto"
    if (!cantidad || cantNum <= 0) newErrors.cantidad = "Cantidad debe ser mayor a 0"
    if (!precioUnitario || precioNum <= 0) newErrors.precioUnitario = "Precio debe ser mayor a 0"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAgregarItem = () => {
    if (!validateItem()) return
    const producto = PRODUCTOS.find((p) => p.id === nuevoProducto)
    if (!producto) return
    const cantidadNum = Number.parseFloat(cantidad)
    const precioNum = Number.parseFloat(precioUnitario)
    const item: VentaItem = {
      productoId: nuevoProducto as ProductoTipo,
      productoNombre: producto.nombre,
      cantidad: cantidadNum,
      precioUnitario: precioNum,
      subtotal: cantidadNum * precioNum,
    }
    setItems([...items, item])
    setNuevoProducto("")
    setCantidad("")
    setPrecioUnitario("")
    setErrors({})
  }

  const handleEliminarItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {}
    if (!clienteId) newErrors.cliente = "Seleccione un cliente"
    if (items.length === 0) newErrors.items = "Agregue al menos un producto"
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    const venta: Venta & { vendedor?: string } = {
      id: editData ? String(editData.rowIndex) : Date.now().toString(),
      fecha: parseDate(fecha),
      clienteId: cliente?.nombre || "",
      clienteNombre: cliente?.nombre || "",
      items,
      total,
      estado: "pendiente",
      createdAt: new Date(),
      vendedor: vendedor || "",
    }

    if (editData && onUpdate) {
      onUpdate(editData.rowIndex, venta)
    } else {
      onSubmit(venta)
    }
    handleClose()
  }

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    if (editData && onDelete) {
      onDelete(editData.rowIndex)
      handleClose()
    }
  }

  const isEditing = !!editData

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" onEscapeKeyDown={handleClose}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Venta" : "Nueva Venta"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Modifique los datos de la venta" : "Complete los datos de la venta y agregue los productos"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={(v) => { setClienteId(v); setErrors((e) => ({ ...e, cliente: "" })) }}>
                <SelectTrigger className={errors.cliente ? "border-destructive" : ""}>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {allClientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span>{c.nombre}</span>
                        {c.saldo > 0 && (
                          <span className="text-xs text-destructive font-medium">
                            Debe: {formatCurrency(c.saldo)}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.cliente && <p className="text-xs text-destructive">{errors.cliente}</p>}
            </div>
            <div className="space-y-2">
              <Label>Vendedor</Label>
              {allVendedores.length > 0 ? (
                <Select value={vendedor} onValueChange={setVendedor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {allVendedores.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={vendedor} onChange={(e) => setVendedor(e.target.value)} placeholder="Nombre del vendedor" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Agregar Producto</Label>
            <div className="flex flex-wrap gap-2">
              <Select value={nuevoProducto} onValueChange={(v) => { setNuevoProducto(v as ProductoTipo); setErrors((e) => ({ ...e, producto: "" })) }}>
                <SelectTrigger className={`w-48 ${errors.producto ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Producto" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTOS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <Input
                  type="number"
                  placeholder="Cantidad"
                  value={cantidad}
                  onChange={(e) => { setCantidad(e.target.value); setErrors((er) => ({ ...er, cantidad: "" })) }}
                  className={`w-28 ${errors.cantidad ? "border-destructive" : ""}`}
                  min="0.01"
                  step="any"
                />
                {errors.cantidad && <p className="text-xs text-destructive">{errors.cantidad}</p>}
              </div>
              <div className="space-y-1">
                <Input
                  type="number"
                  placeholder="Precio"
                  value={precioUnitario}
                  onChange={(e) => { setPrecioUnitario(e.target.value); setErrors((er) => ({ ...er, precioUnitario: "" })) }}
                  className={`w-32 ${errors.precioUnitario ? "border-destructive" : ""}`}
                  min="0.01"
                  step="any"
                />
                {errors.precioUnitario && <p className="text-xs text-destructive">{errors.precioUnitario}</p>}
              </div>
              <Button type="button" variant="secondary" onClick={handleAgregarItem} disabled={!nuevoProducto || !cantidad || !precioUnitario}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
          </div>

          {items.length > 0 && (
            <div className="rounded-lg border">
              <div className="grid grid-cols-12 gap-2 border-b bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground">
                <div className="col-span-5">Producto</div>
                <div className="col-span-2 text-right">Cant.</div>
                <div className="col-span-2 text-right">Precio</div>
                <div className="col-span-2 text-right">Subtotal</div>
                <div className="col-span-1" />
              </div>
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm border-b last:border-0">
                  <div className="col-span-5 font-medium">{item.productoNombre}</div>
                  <div className="col-span-2 text-right">{item.cantidad}</div>
                  <div className="col-span-2 text-right">{formatCurrency(item.precioUnitario)}</div>
                  <div className="col-span-2 text-right font-semibold">{formatCurrency(item.subtotal)}</div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleEliminarItem(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between px-4 py-3 bg-muted/30">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {isEditing && onDelete && (
            <Button variant="destructive" onClick={handleDelete} className="sm:mr-auto">
              {confirmDelete ? "Confirmar Eliminacion" : "Eliminar"}
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!clienteId || items.length === 0}>
            {isEditing ? "Guardar Cambios" : "Guardar Venta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
