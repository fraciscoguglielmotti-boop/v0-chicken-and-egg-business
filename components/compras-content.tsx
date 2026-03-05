"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { CurrencyDisplay } from "./currency-display"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface Compra {
  id: string
  fecha: string
  proveedor_nombre: string
  producto: string
  cantidad: number
  precio_unitario: number
  total: number
  estado: string
}

interface Proveedor {
  id: string
  nombre: string
}

interface Producto {
  id: string
  nombre: string
  activo: boolean
}

export function ComprasContent() {
  const { data: compras = [], isLoading, mutate } = useSupabase<Compra>("compras")
  const { data: proveedores = [] } = useSupabase<Proveedor>("proveedores")
  const { data: productos = [] } = useSupabase<Producto>("productos")
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    proveedor_nombre: "",
    producto: "",
    cantidad: "",
    precio_unitario: "",
    estado: "pendiente"
  })
  const [editingCompra, setEditingCompra] = useState<Compra | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    fecha: "",
    proveedor_nombre: "",
    producto: "",
    cantidad: "",
    precio_unitario: "",
    estado: "pendiente"
  })

  const productosActivos = productos.filter(p => p.activo)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cantidad = parseFloat(formData.cantidad)
    const precio = parseFloat(formData.precio_unitario)
    await insertRow("compras", {
      fecha: formData.fecha,
      proveedor_nombre: formData.proveedor_nombre,
      producto: formData.producto,
      cantidad,
      precio_unitario: precio,
      total: cantidad * precio,
      estado: formData.estado
    })
    mutate()
    setIsDialogOpen(false)
    setFormData({ fecha: new Date().toISOString().split('T')[0], proveedor_nombre: "", producto: "", cantidad: "", precio_unitario: "", estado: "pendiente" })
  }

  const handleEdit = (compra: Compra) => {
    setEditingCompra(compra)
    setEditFormData({
      fecha: compra.fecha?.split('T')[0] ?? "",
      proveedor_nombre: compra.proveedor_nombre ?? "",
      producto: compra.producto ?? "",
      cantidad: String(compra.cantidad ?? ""),
      precio_unitario: String(compra.precio_unitario ?? ""),
      estado: compra.estado ?? "pendiente"
    })
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRow("compras", id)
      mutate()
      toast({ title: "Compra eliminada" })
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" })
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCompra) return
    try {
      const cantidad = parseFloat(editFormData.cantidad)
      const precio = parseFloat(editFormData.precio_unitario)
      await updateRow("compras", editingCompra.id, {
        fecha: editFormData.fecha,
        proveedor_nombre: editFormData.proveedor_nombre,
        producto: editFormData.producto,
        cantidad,
        precio_unitario: precio,
        total: cantidad * precio,
        estado: editFormData.estado
      })
      await mutate()
      setIsEditDialogOpen(false)
      setEditingCompra(null)
      toast({ title: "Compra actualizada", description: "Los cambios se guardaron correctamente." })
    } catch (err: any) {
      toast({ title: "Error al actualizar", description: err.message, variant: "destructive" })
    }
  }

  const filteredCompras = compras
    .filter((c) => c.proveedor_nombre.toLowerCase().includes(searchTerm.toLowerCase()) || c.producto.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((c) => !fechaDesde || c.fecha >= fechaDesde)
    .filter((c) => !fechaHasta || c.fecha <= fechaHasta)

  const columns = [
    { key: "fecha", header: "Fecha", render: (c: Compra) => formatDate(new Date(c.fecha)) },
    { key: "proveedor_nombre", header: "Proveedor" },
    { key: "producto", header: "Producto" },
    { key: "cantidad", header: "Cantidad" },
    { key: "precio_unitario", header: "Precio Unit.", render: (c: Compra) => <CurrencyDisplay amount={c.precio_unitario} /> },
    { key: "total", header: "Total", render: (c: Compra) => <CurrencyDisplay amount={c.total} className="font-semibold" /> },
    { key: "estado", header: "Estado", render: (c: Compra) => (
      <Badge variant={c.estado === "pagado" ? "default" : "outline"}>
        {c.estado}
      </Badge>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar compras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Desde:</Label>
          <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Hasta:</Label>
          <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-auto" />
        </div>
        {(fechaDesde || fechaHasta) && (
          <Button variant="outline" size="sm" onClick={() => { setFechaDesde(""); setFechaHasta("") }}>Limpiar</Button>
        )}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="ml-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Compra
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Compra</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={formData.fecha}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormData({...formData, fecha: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label>Proveedor</Label>
                <Select value={formData.proveedor_nombre} onValueChange={(value) => setFormData({...formData, proveedor_nombre: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.map(p => (
                      <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Producto</Label>
                <Select value={formData.producto} onValueChange={(value) => setFormData({...formData, producto: value})} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {productosActivos.map(p => (
                      <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cantidad</Label>
                  <Input type="number" step="0.01" value={formData.cantidad} onChange={(e) => setFormData({...formData, cantidad: e.target.value})} required />
                </div>
                <div>
                  <Label>Precio Unitario</Label>
                  <Input type="number" step="0.01" value={formData.precio_unitario} onChange={(e) => setFormData({...formData, precio_unitario: e.target.value})} required />
                </div>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={formData.estado} onValueChange={(value) => setFormData({...formData, estado: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="pagado">Pagado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={filteredCompras}
        emptyMessage={isLoading ? "Cargando..." : "No hay compras registradas"}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Compra</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={editFormData.fecha}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setEditFormData({ ...editFormData, fecha: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Proveedor</Label>
              <Select value={editFormData.proveedor_nombre} onValueChange={(value) => setEditFormData({ ...editFormData, proveedor_nombre: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {proveedores.map(p => (
                    <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Producto</Label>
              <Select value={editFormData.producto} onValueChange={(value) => setEditFormData({ ...editFormData, producto: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {productosActivos.map(p => (
                    <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cantidad</Label>
                <Input type="number" step="0.01" value={editFormData.cantidad} onChange={(e) => setEditFormData({ ...editFormData, cantidad: e.target.value })} required />
              </div>
              <div>
                <Label>Precio Unitario</Label>
                <Input type="number" step="0.01" value={editFormData.precio_unitario} onChange={(e) => setEditFormData({ ...editFormData, precio_unitario: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={editFormData.estado} onValueChange={(value) => setEditFormData({ ...editFormData, estado: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="pagado">Pagado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Guardar cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
