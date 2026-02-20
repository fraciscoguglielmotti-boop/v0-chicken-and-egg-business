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

interface Venta {
  id: string
  fecha: string
  cliente_nombre: string
  productos: any
  cantidad: number
  precio_unitario: number
  vendedor?: string
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
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    cliente_nombre: "",
    producto: "",
    cantidad: "",
    precio_unitario: "",
    vendedor: ""
  })

  const productosActivos = productos.filter(p => p.activo)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await insertRow("ventas", {
      fecha: formData.fecha,
      cliente_nombre: formData.cliente_nombre,
      productos: { nombre: formData.producto },
      cantidad: parseFloat(formData.cantidad),
      precio_unitario: parseFloat(formData.precio_unitario),
      vendedor: formData.vendedor || null
    })
    mutate()
    setIsDialogOpen(false)
    setFormData({ fecha: new Date().toISOString().split('T')[0], cliente_nombre: "", producto: "", cantidad: "", precio_unitario: "", vendedor: "" })
  }

  const filteredVentas = ventas.filter((v) =>
    v.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns = [
    { key: "fecha", header: "Fecha", render: (v: Venta) => formatDate(new Date(v.fecha)) },
    { key: "cliente_nombre", header: "Cliente" },
    { key: "productos", header: "Producto", render: (v: Venta) => v.productos?.nombre || v.productos?.descripcion || "-" },
    { key: "cantidad", header: "Cantidad" },
    { key: "precio_unitario", header: "Precio Unit.", render: (v: Venta) => formatCurrency(v.precio_unitario) },
    { key: "total", header: "Total", render: (v: Venta) => <span className="font-semibold">{formatCurrency(v.cantidad * v.precio_unitario)}</span> },
    { key: "vendedor", header: "Vendedor", render: (v: Venta) => v.vendedor || "-" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar ventas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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
                <Input type="date" value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} required />
              </div>
              <div>
                <Label>Cliente</Label>
                <Input list="clientes" value={formData.cliente_nombre} onChange={(e) => setFormData({...formData, cliente_nombre: e.target.value})} required />
                <datalist id="clientes">
                  {clientes.map(c => <option key={c.id} value={c.nombre} />)}
                </datalist>
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
      />
    </div>
  )
}
