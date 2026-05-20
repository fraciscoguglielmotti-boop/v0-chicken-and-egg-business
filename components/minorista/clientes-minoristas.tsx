"use client"

import { useState, useMemo } from "react"
import { Plus, Pencil, Trash2, Search, Phone, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { useConfirm } from "@/components/confirm-dialog"
import { MnCliente, clienteNombre } from "./types"

interface Props {
  clientes: MnCliente[]
  mutate: () => Promise<any>
}

const empty = { nombre: "", telefono: "" }

export function ClientesMinoristas({ clientes, mutate }: Props) {
  const { toast } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MnCliente | null>(null)
  const [form, setForm] = useState(empty)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return clientes
    return clientes.filter((c) =>
      [c.nombre, c.telefono]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [clientes, search])

  const openNew = () => {
    setEditing(null)
    setForm(empty)
    setDialogOpen(true)
  }

  const openEdit = (c: MnCliente) => {
    setEditing(c)
    setForm({ nombre: c.nombre || "", telefono: c.telefono || "" })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    if (!form.telefono.trim()) {
      toast({ title: "Falta teléfono", description: "El teléfono es requerido.", variant: "destructive" })
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim(),
        activo: true,
      }
      if (editing) {
        await updateRow("mn_clientes", editing.id, payload)
        toast({ title: "Cliente actualizado" })
      } else {
        await insertRow("mn_clientes", payload)
        toast({ title: "Cliente creado" })
      }
      await mutate()
      setDialogOpen(false)
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo guardar", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (c: MnCliente) => {
    const ok = await confirm({
      title: `Eliminar cliente ${clienteNombre(c)}?`,
      description: "Esta acción no se puede deshacer.",
      destructive: true,
      confirmLabel: "Eliminar",
    })
    if (!ok) return
    try {
      await deleteRow("mn_clientes", c.id)
      await mutate()
      toast({ title: "Cliente eliminado" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo eliminar", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="pl-9"
          />
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c) => (
          <Card key={c.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge variant="outline" className="text-[10px] mb-1">
                    #{c.id}
                  </Badge>
                  <h3 className="font-semibold leading-tight">{clienteNombre(c)}</h3>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(c)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-rose-600 hover:text-rose-700"
                    onClick={() => handleDelete(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {c.telefono && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <a
                    href={`https://wa.me/${c.telefono.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground"
                  >
                    {c.telefono}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
            <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
            {search
              ? "No hay clientes que coincidan con la búsqueda"
              : "Todavía no hay clientes. Los que usen el bot de WhatsApp se registran automáticamente."}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Editar cliente #${editing.id}` : "Nuevo cliente"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <Label>Teléfono *</Label>
              <Input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="+54 9 11 ..."
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando…" : editing ? "Guardar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </div>
  )
}
