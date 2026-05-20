"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { formatCurrency } from "@/lib/utils"
import { MnProducto } from "./types"

interface Props {
  productos: MnProducto[]
  mutateProductos: () => Promise<any>
}

const empty = {
  nombre: "",
  descripcion: "",
  unidad: "kg",
  precio: "0",
  activo: true,
}

export function CatalogoMinoristas({ productos, mutateProductos }: Props) {
  const { toast } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MnProducto | null>(null)
  const [form, setForm] = useState(empty)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openNew = () => {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  const openEdit = (p: MnProducto) => {
    setEditing(p)
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      unidad: p.unidad || "kg",
      precio: String(p.precio),
      activo: p.activo !== false,
    })
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        unidad: form.unidad,
        precio: Number(form.precio) || 0,
        activo: form.activo,
      }
      if (editing) {
        await updateRow("mn_productos", editing.id, payload)
        toast({ title: "Producto actualizado" })
      } else {
        await insertRow("mn_productos", payload)
        toast({ title: "Producto creado" })
      }
      await mutateProductos()
      setOpen(false)
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (p: MnProducto) => {
    const ok = await confirm({
      title: `Eliminar ${p.nombre}?`,
      destructive: true,
      confirmLabel: "Eliminar",
    })
    if (!ok) return
    try {
      await deleteRow("mn_productos", p.id)
      await mutateProductos()
      toast({ title: "Producto eliminado" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const toggleActivo = async (p: MnProducto) => {
    try {
      await updateRow("mn_productos", p.id, { activo: !p.activo })
      await mutateProductos()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo producto
        </Button>
      </div>

      {productos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
          No hay productos. Los productos que usa el bot viven en mn_productos.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {productos.map((p) => (
            <Card key={p.id} className={p.activo === false ? "opacity-60" : ""}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{p.nombre}</h3>
                    {p.descripcion && (
                      <p className="text-xs text-muted-foreground">{p.descripcion}</p>
                    )}
                  </div>
                  <Switch
                    checked={p.activo !== false}
                    onCheckedChange={() => toggleActivo(p)}
                  />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">{formatCurrency(p.precio)}</span>
                  <Badge variant="outline">/ {p.unidad ?? "u"}</Badge>
                </div>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-600"
                    onClick={() => handleDelete(p)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unidad *</Label>
                <Select
                  value={form.unidad}
                  onValueChange={(v) => setForm({ ...form, unidad: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="unidad">unidad</SelectItem>
                    <SelectItem value="docena">docena</SelectItem>
                    <SelectItem value="maple">maple</SelectItem>
                    <SelectItem value="bandeja">bandeja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Precio *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.activo}
                onCheckedChange={(v) => setForm({ ...form, activo: v })}
              />
              <Label>Activo (visible para pedidos)</Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
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
