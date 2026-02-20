"use client"

import { useState } from "react"
import { Plus, Search, Phone, MapPin, CreditCard, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface Cliente {
  id: string
  nombre: string
  cuit?: string
  telefono?: string
  direccion?: string
  saldo_inicial: number
  fecha_alta: string
  created_at: string
}

export function ClientesContent() {
  const { data: clientes = [], mutate, isLoading } = useSupabase<Cliente>("clientes")
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [form, setForm] = useState({
    nombre: "",
    cuit: "",
    telefono: "",
    direccion: "",
    saldo_inicial: "0",
  })

  const filteredClientes = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cuit || "").includes(searchTerm)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCliente) {
        await updateRow("clientes", editingCliente.id, {
          nombre: form.nombre,
          cuit: form.cuit || null,
          telefono: form.telefono || null,
          direccion: form.direccion || null,
          saldo_inicial: Number(form.saldo_inicial),
        })
      } else {
        await insertRow("clientes", {
          nombre: form.nombre,
          cuit: form.cuit || null,
          telefono: form.telefono || null,
          direccion: form.direccion || null,
          saldo_inicial: Number(form.saldo_inicial),
        })
      }
      await mutate()
      setDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("[v0] Error guardando cliente:", error)
    }
  }

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente)
    setForm({
      nombre: cliente.nombre,
      cuit: cliente.cuit || "",
      telefono: cliente.telefono || "",
      direccion: cliente.direccion || "",
      saldo_inicial: String(cliente.saldo_inicial || 0),
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este cliente?")) return
    try {
      await deleteRow("clientes", id)
      await mutate()
    } catch (error) {
      console.error("[v0] Error eliminando cliente:", error)
    }
  }

  const resetForm = () => {
    setForm({ nombre: "", cuit: "", telefono: "", direccion: "", saldo_inicial: "0" })
    setEditingCliente(null)
  }

  const columns = [
    { key: "nombre", header: "Nombre", render: (c: Cliente) => <span className="font-medium">{c.nombre}</span> },
    { key: "cuit", header: "CUIT", render: (c: Cliente) => c.cuit || "-" },
    { key: "telefono", header: "Telefono", render: (c: Cliente) => c.telefono || "-" },
    { key: "direccion", header: "Direccion", render: (c: Cliente) => c.direccion || "-" },
    { key: "saldo_inicial", header: "Saldo Inicial", render: (c: Cliente) => <Badge variant={c.saldo_inicial > 0 ? "destructive" : "outline"}>{formatCurrency(c.saldo_inicial)}</Badge> },
    { key: "fecha_alta", header: "Fecha Alta", render: (c: Cliente) => formatDate(new Date(c.fecha_alta)) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCliente ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="nombre"
                    placeholder="Nombre del cliente"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cuit">CUIT</Label>
                <Input
                  id="cuit"
                  placeholder="XX-XXXXXXXX-X"
                  value={form.cuit}
                  onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="telefono">Telefono</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="telefono"
                      placeholder="Telefono"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saldo_inicial">Saldo Inicial</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="saldo_inicial"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.saldo_inicial}
                      onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccion">Direccion</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="direccion"
                    placeholder="Direccion completa"
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">{editingCliente ? "Guardar" : "Crear"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={filteredClientes}
        emptyMessage={isLoading ? "Cargando..." : "No hay clientes"}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  )
}
