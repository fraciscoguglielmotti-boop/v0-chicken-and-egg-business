"use client"

import { useState } from "react"
import { Plus, Search, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { DataTable } from "./data-table"
import { useSupabase, insertRow, updateRow } from "@/hooks/use-supabase"
import { Badge } from "@/components/ui/badge"

interface Producto {
  id: string
  nombre: string
  descripcion: string
  activo: boolean
}

export function StockContent() {
  const { data: productos = [], isLoading, mutate } = useSupabase<Producto>("productos")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    activo: true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      await updateRow("productos", editingId, formData)
      setEditingId(null)
    } else {
      await insertRow("productos", formData)
    }
    mutate()
    setIsDialogOpen(false)
    setFormData({ nombre: "", descripcion: "", activo: true })
  }

  const handleEdit = (producto: Producto) => {
    setFormData({
      nombre: producto.nombre,
      descripcion: producto.descripcion || "",
      activo: producto.activo
    })
    setEditingId(producto.id)
    setIsDialogOpen(true)
  }

  const toggleActivo = async (producto: Producto) => {
    await updateRow("productos", producto.id, { activo: !producto.activo })
    mutate()
  }

  const filteredProductos = productos.filter((p) =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns = [
    { key: "nombre", header: "Producto", render: (p: Producto) => <span className="font-medium">{p.nombre}</span> },
    { key: "descripcion", header: "Descripción", render: (p: Producto) => p.descripcion || "-" },
    { 
      key: "activo", 
      header: "Estado", 
      render: (p: Producto) => (
        <Badge variant={p.activo ? "default" : "outline"}>
          {p.activo ? "Activo" : "Inactivo"}
        </Badge>
      )
    },
    {
      key: "actions",
      header: "Acciones",
      render: (p: Producto) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => toggleActivo(p)}
            className={p.activo ? "text-destructive" : "text-green-600"}
          >
            {p.activo ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          </Button>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            setEditingId(null)
            setFormData({ nombre: "", descripcion: "", activo: true })
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input 
                  value={formData.nombre} 
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})} 
                  placeholder="Ej: Pollo A, Cajon N1"
                  required 
                />
              </div>
              <div>
                <Label>Descripción (opcional)</Label>
                <Input 
                  value={formData.descripcion} 
                  onChange={(e) => setFormData({...formData, descripcion: e.target.value})} 
                  placeholder="Descripción del producto"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Activo</Label>
                <Switch 
                  checked={formData.activo} 
                  onCheckedChange={(checked) => setFormData({...formData, activo: checked})} 
                />
              </div>
              <DialogFooter>
                <Button type="submit">{editingId ? "Actualizar" : "Guardar"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={filteredProductos}
        emptyMessage={isLoading ? "Cargando..." : "No hay productos registrados"}
      />
    </div>
  )
}
