"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface Proveedor {
  id: string
  nombre: string
  created_at: string
}

export function ProveedoresContent() {
  const { data: proveedores = [], mutate, isLoading } = useSupabase<Proveedor>("proveedores")
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null)
  const [form, setForm] = useState({ nombre: "" })

  const filteredProveedores = proveedores.filter((p) =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingProveedor) {
        await updateRow("proveedores", editingProveedor.id, { nombre: form.nombre })
      } else {
        await insertRow("proveedores", { nombre: form.nombre })
      }
      await mutate()
      setDialogOpen(false)
      setForm({ nombre: "" })
      setEditingProveedor(null)
      toast({ title: editingProveedor ? "Proveedor actualizado" : "Proveedor creado" })
    } catch (error: any) {
      toast({ title: "Error al guardar", description: error?.message ?? "No se pudo guardar el proveedor", variant: "destructive" })
    }
  }

  const handleEdit = (proveedor: Proveedor) => {
    setEditingProveedor(proveedor)
    setForm({ nombre: proveedor.nombre })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este proveedor?")) return
    try {
      await deleteRow("proveedores", id)
      await mutate()
      toast({ title: "Proveedor eliminado" })
    } catch (error: any) {
      toast({ title: "Error al eliminar", description: error?.message ?? "No se pudo eliminar el proveedor", variant: "destructive" })
    }
  }

  const columns = [
    { key: "nombre", header: "Nombre", render: (p: Proveedor) => <span className="font-medium">{p.nombre}</span> },
    { key: "created_at", header: "Fecha Alta", render: (p: Proveedor) => formatDate(new Date(p.created_at)) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar proveedores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setForm({ nombre: "" }); setEditingProveedor(null); }}}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Proveedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProveedor ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  placeholder="Nombre del proveedor"
                  value={form.nombre}
                  onChange={(e) => setForm({ nombre: e.target.value })}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">{editingProveedor ? "Guardar" : "Crear"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={filteredProveedores}
        emptyMessage={isLoading ? "Cargando..." : "No hay proveedores"}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  )
}
