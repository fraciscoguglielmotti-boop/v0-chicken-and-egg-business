"use client"

import { useState, useMemo } from "react"
import { Plus, Pencil, Trash2, Search, Phone, MapPin, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { ClienteMinorista, nextCustomerId } from "./types"

interface Props {
  clientes: ClienteMinorista[]
  mutate: () => Promise<any>
}

const empty = {
  nombre: "",
  apellido: "",
  telefono: "",
  direccion: "",
  lat: "",
  lng: "",
  notas: "",
}

export function ClientesMinoristas({ clientes, mutate }: Props) {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ClienteMinorista | null>(null)
  const [form, setForm] = useState(empty)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return clientes
    return clientes.filter((c) =>
      [c.customer_id, c.nombre, c.apellido, c.telefono, c.direccion]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [clientes, search])

  const openNew = () => {
    setEditing(null)
    setForm(empty)
    setDialogOpen(true)
  }

  const openEdit = (c: ClienteMinorista) => {
    setEditing(c)
    setForm({
      nombre: c.nombre || "",
      apellido: c.apellido || "",
      telefono: c.telefono || "",
      direccion: c.direccion || "",
      lat: c.lat != null ? String(c.lat) : "",
      lng: c.lng != null ? String(c.lng) : "",
      notas: c.notas || "",
    })
    setDialogOpen(true)
  }

  const parseLatLng = (s: string): { lat: number | null; lng: number | null } => {
    if (!s) return { lat: null, lng: null }
    const m = s.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/)
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) }
    return { lat: null, lng: null }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const lat = form.lat ? Number(form.lat) : null
      const lng = form.lng ? Number(form.lng) : null
      const payload = {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        lat,
        lng,
        notas: form.notas.trim() || null,
      }
      if (editing) {
        await updateRow("clientes_minoristas", editing.id, payload)
        toast({ title: "Cliente actualizado" })
      } else {
        await insertRow("clientes_minoristas", {
          ...payload,
          customer_id: nextCustomerId(clientes),
          activo: true,
        })
        toast({ title: "Cliente creado" })
      }
      await mutate()
      setDialogOpen(false)
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "No se pudo guardar",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (c: ClienteMinorista) => {
    if (!confirm(`Eliminar cliente ${c.nombre} ${c.apellido}?`)) return
    try {
      await deleteRow("clientes_minoristas", c.id)
      await mutate()
      toast({ title: "Cliente eliminado" })
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "No se pudo eliminar",
        variant: "destructive",
      })
    }
  }

  const handleLatLngPaste = (value: string) => {
    const { lat, lng } = parseLatLng(value)
    if (lat != null && lng != null) {
      setForm((f) => ({ ...f, lat: String(lat), lng: String(lng) }))
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
            placeholder="Buscar por nombre, teléfono, dirección..."
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
                    {c.customer_id}
                  </Badge>
                  <h3 className="font-semibold leading-tight">
                    {c.nombre} {c.apellido}
                  </h3>
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
              <div className="space-y-1 text-sm text-muted-foreground">
                {c.telefono && (
                  <div className="flex items-center gap-2">
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
                {c.direccion && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <a
                      href={
                        c.lat != null && c.lng != null
                          ? `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.direccion)}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-foreground leading-tight"
                    >
                      {c.direccion}
                    </a>
                  </div>
                )}
                {c.notas && (
                  <p className="text-xs italic text-muted-foreground/80 pt-1">
                    {c.notas}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
            <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
            {search
              ? "No hay clientes que coincidan con la búsqueda"
              : "Todavía no hay clientes minoristas. Cargá el primero."}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Editar ${editing.customer_id}` : "Nuevo cliente minorista"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Apellido *</Label>
                <Input
                  value={form.apellido}
                  onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="+54 9 11 ..."
              />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                placeholder="Calle, altura, localidad"
              />
            </div>
            <div>
              <Label>Coordenadas (opcional)</Label>
              <Input
                placeholder="Pegá 'lat, lng' de Google Maps"
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text")
                  if (text.includes(",")) {
                    e.preventDefault()
                    handleLatLngPaste(text)
                  }
                }}
                value={form.lat && form.lng ? `${form.lat}, ${form.lng}` : ""}
                onChange={(e) => handleLatLngPaste(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                En Google Maps: click derecho sobre el punto → copiar coordenadas
              </p>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={2}
                placeholder="Referencias, horarios, etc."
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
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
