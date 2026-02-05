"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
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

interface NuevaVentaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (venta: Venta) => void
}

export function NuevaVentaDialog({
  open,
  onOpenChange,
  onSubmit,
}: NuevaVentaDialogProps) {
  const [clienteId, setClienteId] = useState("")
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [items, setItems] = useState<VentaItem[]>([])
  const [nuevoProducto, setNuevoProducto] = useState<ProductoTipo | "">("")
  const [cantidad, setCantidad] = useState("")
  const [precioUnitario, setPrecioUnitario] = useState("")

  const cliente = clientesIniciales.find((c) => c.id === clienteId)
  const total = items.reduce((acc, item) => acc + item.subtotal, 0)

  const handleAgregarItem = () => {
    if (!nuevoProducto || !cantidad || !precioUnitario) return

    const producto = PRODUCTOS.find((p) => p.id === nuevoProducto)
    if (!producto) return

    const cantidadNum = Number.parseFloat(cantidad)
    const precioNum = Number.parseFloat(precioUnitario)

    const item: VentaItem = {
      productoId: nuevoProducto,
      productoNombre: producto.nombre,
      cantidad: cantidadNum,
      precioUnitario: precioNum,
      subtotal: cantidadNum * precioNum,
    }

    setItems([...items, item])
    setNuevoProducto("")
    setCantidad("")
    setPrecioUnitario("")
  }

  const handleEliminarItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!clienteId || items.length === 0) return

    const venta: Venta = {
      id: Date.now().toString(),
      fecha: new Date(fecha),
      clienteId,
      clienteNombre: cliente?.nombre || "",
      items,
      total,
      estado: "pendiente",
      createdAt: new Date(),
    }

    onSubmit(venta)
    resetForm()
  }

  const resetForm = () => {
    setClienteId("")
    setFecha(new Date().toISOString().split("T")[0])
    setItems([])
    setNuevoProducto("")
    setCantidad("")
    setPrecioUnitario("")
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
    }).format(amount)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva Venta</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Cliente y Fecha */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientesIniciales.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          {/* Agregar Producto */}
          <div className="space-y-3">
            <Label>Agregar Producto</Label>
            <div className="flex flex-wrap gap-2">
              <Select
                value={nuevoProducto}
                onValueChange={(v) => setNuevoProducto(v as ProductoTipo)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Producto" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTOS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Cantidad"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="w-28"
              />
              <Input
                type="number"
                placeholder="Precio"
                value={precioUnitario}
                onChange={(e) => setPrecioUnitario(e.target.value)}
                className="w-32"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAgregarItem}
                disabled={!nuevoProducto || !cantidad || !precioUnitario}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Lista de Items */}
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
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm border-b last:border-0"
                >
                  <div className="col-span-5 font-medium">
                    {item.productoNombre}
                  </div>
                  <div className="col-span-2 text-right">{item.cantidad}</div>
                  <div className="col-span-2 text-right">
                    {formatCurrency(item.precioUnitario)}
                  </div>
                  <div className="col-span-2 text-right font-semibold">
                    {formatCurrency(item.subtotal)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleEliminarItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between px-4 py-3 bg-muted/30">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!clienteId || items.length === 0}
          >
            Guardar Venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
