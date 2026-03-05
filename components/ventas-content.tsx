"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { CurrencyDisplay } from "./currency-display"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface Venta {
  id: string
  fecha: string
  cliente_nombre: string
  producto_nombre?: string
  cantidad: number
  precio_unitario: number
  vendedor?: string
  observaciones?: string
}

interface Cliente {
  id: string
  nombre: string
}

interface Producto {
  id: string
  nombre: string
  activo: boolean
}

export function VentasContent() {
  const { data: ventas = [], isLoading, mutate } = useSupabase<Venta>("ventas")
  const { data: clientes = [] } = useSupabase<Cliente>("clientes")
  const { data: productos = [] } = useSupabase<Producto>("productos")
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    cliente_nombre: "",
    producto: "",
    cantidad: "",
    precio_unitario: "",
    vendedor: ""
  })
  const [editingVenta, setEditingVenta] = useState<Venta | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    fecha: "",
    cliente_nombre: "",
    producto_nombre: "",
    cantidad: "",
    precio_unitario: "",
    observaciones: ""
  })

  const productosActivos = productos.filter(p => p.activo)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await insertRow("ventas", {
        fecha: formData.fecha,
        cliente_nombre: formData.cliente_nombre,
        producto_nombre: formData.producto,
        cantidad: parseFloat(formData.cantidad),
        precio_unitario: parseFloat(formData.precio_unitario),
        vendedor: formData.vendedor || null
      })
      mutate()
      setIsDialogOpen(false)
      setFormData({ fecha: new Date().toISOString().split('T')[0], cliente_nombre: "", producto: "", cantidad: "", precio_unitario: "", vendedor: "" })
      toast({ title: "Venta registrada", description: `${formData.cliente_nombre} — ${formData.producto}` })
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err?.message ?? "Error desconocido", variant: "destructive" })
    }
  }

  const handleEdit = (venta: Venta) => {
    setEditingVenta(venta)
    setEditFormData({
      fecha: venta.fecha?.split('T')[0] ?? "",
      cliente_nombre: venta.cliente_nombre ?? "",
      producto_nombre: venta.producto_nombre ?? "",
      cantidad: String(venta.cantidad ?? ""),
      precio_unitario: String(venta.precio_unitario ?? ""),
      observaciones: venta.observaciones ?? ""
    })
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRow("ventas", id)
      mutate()
      toast({ title: "Venta eliminada" })
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" })
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingVenta) return
    try {
      await updateRow("ventas", editingVenta.id, {
        fecha: editFormData.fecha,
        cliente_nombre: editFormData.cliente_nombre,
        producto_nombre: editFormData.producto_nombre || null,
        cantidad: parseFloat(editFormData.cantidad),
        precio_unitario: parseFloat(editFormData.precio_unitario),
      })
      await mutate()
      setIsEditDialogOpen(false)
      setEditingVenta(null)
      toast({ title: "Venta actualizada", description: "Los cambios se guardaron correctamente." })
    } catch (err: any) {
      toast({ title: "Error al actualizar", description: err.message, variant: "destructive" })
    }
  }

  const filteredVentas = ventas
    .filter((v) => v.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((v) => !fechaDesde || v.fecha >= fechaDesde)
    .filter((v) => !fechaHasta || v.fecha <= fechaHasta)

  const columns = [
    { key: "fecha", header: "Fecha", render: (v: Venta) => formatDate(new Date(v.fecha)) },
    { key: "cliente_nombre", header: "Cliente" },
    { key: "producto_nombre", header: "Producto", render: (v: Venta) => v.producto_nombre || "-" },
    { key: "cantidad", header: "Cantidad" },
    { key: "precio_unitario", header: "Precio Unit.", render: (v: Venta) => <CurrencyDisplay amount={v.precio_unitario} /> },
    { key: "total", header: "Total", render: (v: Venta) => <CurrencyDisplay amount={v.cantidad * v.precio_unitario} className="font-semibold" /> },
    { key: "vendedor", header: "Vendedor", render: (v: Venta) => v.vendedor || "-" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar ventas..."
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
              Nueva Venta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Venta</DialogTitle>
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
                <Label>Cliente</Label>
                <Select value={formData.cliente_nombre} onValueChange={(value) => setFormData({...formData, cliente_nombre: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Label>Vendedor (opcional)</Label>
                <Input value={formData.vendedor} onChange={(e) => setFormData({...formData, vendedor: e.target.value})} />
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
        data={filteredVentas}
        emptyMessage={isLoading ? "Cargando..." : "No hay ventas registradas"}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Venta</DialogTitle>
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
              <Label>Cliente</Label>
              <Select value={editFormData.cliente_nombre} onValueChange={(value) => setEditFormData({ ...editFormData, cliente_nombre: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map(c => (
                    <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Producto</Label>
              <Select value={editFormData.producto_nombre} onValueChange={(value) => setEditFormData({ ...editFormData, producto_nombre: value })}>
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
