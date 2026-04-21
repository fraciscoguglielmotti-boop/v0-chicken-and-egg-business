"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Package, Tag } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatCurrency } from "@/lib/utils"
import { ProductoMinorista, PromoMinorista } from "./types"

interface Props {
  productos: ProductoMinorista[]
  promos: PromoMinorista[]
  mutateProductos: () => Promise<any>
  mutatePromos: () => Promise<any>
}

export function CatalogoMinoristas({
  productos,
  promos,
  mutateProductos,
  mutatePromos,
}: Props) {
  return (
    <Tabs defaultValue="productos" className="space-y-4">
      <TabsList>
        <TabsTrigger value="productos">
          <Package className="h-4 w-4 mr-1.5" /> Productos
        </TabsTrigger>
        <TabsTrigger value="promos">
          <Tag className="h-4 w-4 mr-1.5" /> Promos
        </TabsTrigger>
      </TabsList>
      <TabsContent value="productos">
        <ProductosTab productos={productos} mutate={mutateProductos} />
      </TabsContent>
      <TabsContent value="promos">
        <PromosTab promos={promos} mutate={mutatePromos} />
      </TabsContent>
    </Tabs>
  )
}

// ----- Productos -----

const emptyProducto = {
  nombre: "",
  descripcion: "",
  unidad: "kg",
  precio: "0",
  activo: true,
}

function ProductosTab({
  productos,
  mutate,
}: {
  productos: ProductoMinorista[]
  mutate: () => Promise<any>
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ProductoMinorista | null>(null)
  const [form, setForm] = useState(emptyProducto)

  const openNew = () => {
    setEditing(null)
    setForm(emptyProducto)
    setOpen(true)
  }

  const openEdit = (p: ProductoMinorista) => {
    setEditing(p)
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      unidad: p.unidad,
      precio: String(p.precio),
      activo: p.activo,
    })
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        unidad: form.unidad,
        precio: Number(form.precio) || 0,
        activo: form.activo,
      }
      if (editing) {
        await updateRow("productos_minoristas", editing.id, payload)
        toast({ title: "Producto actualizado" })
      } else {
        await insertRow("productos_minoristas", payload)
        toast({ title: "Producto creado" })
      }
      await mutate()
      setOpen(false)
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (p: ProductoMinorista) => {
    if (!confirm(`Eliminar ${p.nombre}?`)) return
    try {
      await deleteRow("productos_minoristas", p.id)
      await mutate()
      toast({ title: "Producto eliminado" })
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      })
    }
  }

  const toggleActivo = async (p: ProductoMinorista) => {
    try {
      await updateRow("productos_minoristas", p.id, { activo: !p.activo })
      await mutate()
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {productos.map((p) => (
          <Card key={p.id} className={p.activo ? "" : "opacity-60"}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{p.nombre}</h3>
                  {p.descripcion && (
                    <p className="text-xs text-muted-foreground">{p.descripcion}</p>
                  )}
                </div>
                <Switch
                  checked={p.activo}
                  onCheckedChange={() => toggleActivo(p)}
                />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold">
                  {formatCurrency(p.precio)}
                </span>
                <Badge variant="outline">/ {p.unidad}</Badge>
              </div>
              <div className="flex gap-1 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => openEdit(p)}
                >
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editing ? "Guardar" : "Crear"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ----- Promos -----

const emptyPromo = {
  nombre: "",
  descripcion: "",
  tipo: "precio_fijo" as "precio_fijo" | "descuento_pct",
  valor: "0",
  activo: true,
}

function PromosTab({
  promos,
  mutate,
}: {
  promos: PromoMinorista[]
  mutate: () => Promise<any>
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PromoMinorista | null>(null)
  const [form, setForm] = useState(emptyPromo)

  const openNew = () => {
    setEditing(null)
    setForm(emptyPromo)
    setOpen(true)
  }

  const openEdit = (p: PromoMinorista) => {
    setEditing(p)
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      tipo: p.tipo,
      valor: String(p.valor),
      activo: p.activo,
    })
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        tipo: form.tipo,
        valor: Number(form.valor) || 0,
        activo: form.activo,
      }
      if (editing) {
        await updateRow("promos_minoristas", editing.id, payload)
        toast({ title: "Promo actualizada" })
      } else {
        await insertRow("promos_minoristas", payload)
        toast({ title: "Promo creada" })
      }
      await mutate()
      setOpen(false)
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleDelete = async (p: PromoMinorista) => {
    if (!confirm(`Eliminar promo ${p.nombre}?`)) return
    try {
      await deleteRow("promos_minoristas", p.id)
      await mutate()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Nueva promo
        </Button>
      </div>
      {promos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Tag className="h-10 w-10 mx-auto mb-2 opacity-30" />
          Aún no hay promos. Las promos se aplican manualmente al crear un pedido.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {promos.map((p) => (
            <Card key={p.id} className={p.activo ? "" : "opacity-60"}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="secondary" className="mb-1 text-[10px]">
                      {p.tipo === "precio_fijo" ? "Precio fijo" : "Descuento %"}
                    </Badge>
                    <h3 className="font-semibold">{p.nombre}</h3>
                    {p.descripcion && (
                      <p className="text-xs text-muted-foreground">{p.descripcion}</p>
                    )}
                  </div>
                </div>
                <div className="text-lg font-bold">
                  {p.tipo === "descuento_pct"
                    ? `${p.valor}%`
                    : formatCurrency(p.valor)}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => openEdit(p)}
                  >
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
            <DialogTitle>{editing ? "Editar promo" : "Nueva promo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                placeholder="Ej: Combo familiar"
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
            <div>
              <Label>Tipo *</Label>
              <Select
                value={form.tipo}
                onValueChange={(v: any) => setForm({ ...form, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="precio_fijo">Precio fijo (reemplaza el total)</SelectItem>
                  <SelectItem value="descuento_pct">Descuento %</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                required
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {form.tipo === "precio_fijo"
                  ? "Monto total al que queda el pedido (reemplaza al subtotal)."
                  : "Porcentaje a descontar sobre el subtotal (ej: 10 = 10%)."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.activo}
                onCheckedChange={(v) => setForm({ ...form, activo: v })}
              />
              <Label>Activa</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editing ? "Guardar" : "Crear"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
