"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { useSupabase, insertRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

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

export function ComprasContent() {
  const { data: compras = [], isLoading, mutate } = useSupabase<Compra>("compras")
  const { data: proveedores = [] } = useSupabase<Proveedor>("proveedores")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    proveedor_nombre: "",
    producto: "",
    cantidad: "",
    precio_unitario: "",
    estado: "pendiente"
  })

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

  const filteredCompras = compras.filter((c) =>
    c.proveedor_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.producto.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns = [
    { key: "fecha", header: "Fecha", render: (c: Compra) => formatDate(new Date(c.fecha)) },
    { key: "proveedor_nombre", header: "Proveedor" },
    { key: "producto", header: "Producto" },
    { key: "cantidad", header: "Cantidad" },
    { key: "precio_unitario", header: "Precio Unit.", render: (c: Compra) => formatCurrency(c.precio_unitario) },
    { key: "total", header: "Total", render: (c: Compra) => <span className="font-semibold">{formatCurrency(c.total)}</span> },
    { key: "estado", header: "Estado", render: (c: Compra) => (
      <Badge variant={c.estado === "pagado" ? "default" : "outline"}>
        {c.estado}
      </Badge>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar compras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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
                <Input type="date" value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} required />
              </div>
              <div>
                <Label>Proveedor</Label>
                <Input list="proveedores-compras" value={formData.proveedor_nombre} onChange={(e) => setFormData({...formData, proveedor_nombre: e.target.value})} required />
                <datalist id="proveedores-compras">
                  {proveedores.map(p => <option key={p.id} value={p.nombre} />)}
                </datalist>
              </div>
              <div>
                <Label>Producto</Label>
                <Input value={formData.producto} onChange={(e) => setFormData({...formData, producto: e.target.value})} required />
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
      />
    </div>
  )
}
