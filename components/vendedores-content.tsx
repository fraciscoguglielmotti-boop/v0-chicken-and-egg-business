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

interface Vendedor {
  id: string
  nombre: string
  comision: number
  fecha_alta: string
}

export function VendedoresContent() {
  const { data: vendedores = [], mutate, isLoading } = useSupabase<Vendedor>("vendedores")
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null)
  const [form, setForm] = useState({ nombre: "", comision: "0" })

  const filteredVendedores = vendedores.filter((v) =>
    v.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingVendedor) {
        await updateRow("vendedores", editingVendedor.id, { nombre: form.nombre, comision: Number(form.comision) })
      } else {
        await insertRow("vendedores", { nombre: form.nombre, comision: Number(form.comision) })
      }
      await mutate()
      setDialogOpen(false)
      setForm({ nombre: "", comision: "0" })
      setEditingVendedor(null)
    } catch (error) {
      console.error("Error guardando vendedor:", error)
    }
  }

  const handleEdit = (vendedor: Vendedor) => {
    setEditingVendedor(vendedor)
    setForm({ nombre: vendedor.nombre, comision: String(vendedor.comision) })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este vendedor?")) return
    try {
      await deleteRow("vendedores", id)
      await mutate()
    } catch (error) {
      console.error("Error eliminando vendedor:", error)
    }
  }

  const columns = [
    { key: "nombre", header: "Nombre", render: (v: Vendedor) => <span className="font-medium">{v.nombre}</span> },
    { key: "comision", header: "Comision %", render: (v: Vendedor) => `${v.comision}%` },
    { key: "fecha_alta", header: "Fecha Alta", render: (v: Vendedor) => formatDate(new Date(v.fecha_alta)) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar vendedores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setForm({ nombre: "", comision: "0" }); setEditingVendedor(null); }}}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Vendedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingVendedor ? "Editar Vendedor" : "Nuevo Vendedor"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  placeholder="Nombre del vendedor"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comision">Comision %</Label>
                <Input
                  id="comision"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={form.comision}
                  onChange={(e) => setForm({ ...form, comision: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">{editingVendedor ? "Guardar" : "Crear"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={filteredVendedores}
        emptyMessage={isLoading ? "Cargando..." : "No hay vendedores"}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  )
}
