"use client"

import { useState } from "react"
import { Plus, CheckCircle2, Circle, MessageSquare, AlertTriangle, ChevronDown, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils"

interface Tema {
  id: string
  texto: string
  prioridad: "alta" | "media" | "baja"
  estado: "pendiente" | "discutido"
  notas?: string
  fecha_reunion?: string
  created_at: string
}

const PRIORIDAD_CONFIG = {
  alta:  { label: "Alta",  color: "destructive" as const, icon: AlertTriangle },
  media: { label: "Media", color: "secondary" as const,   icon: ChevronDown },
  baja:  { label: "Baja",  color: "outline" as const,     icon: ChevronDown },
}

export function AsesorContent() {
  const { data: temas = [], isLoading, mutate } = useSupabase<Tema>("temas_asesor")
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [notasDialog, setNotasDialog] = useState<Tema | null>(null)
  const [notasText, setNotasText] = useState("")
  const [fechaReunion, setFechaReunion] = useState("")

  const [form, setForm] = useState({ texto: "", prioridad: "media" as Tema["prioridad"] })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.texto.trim()) return
    try {
      await insertRow("temas_asesor", {
        texto: form.texto.trim(),
        prioridad: form.prioridad,
        estado: "pendiente",
      })
      await mutate()
      setForm({ texto: "", prioridad: "media" })
      setDialogOpen(false)
      toast({ title: "Tema agregado" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const toggleEstado = async (tema: Tema) => {
    if (tema.estado === "pendiente") {
      // Abrir dialog para marcar como discutido con notas opcionales
      setNotasDialog(tema)
      setNotasText(tema.notas ?? "")
      setFechaReunion(new Date().toISOString().split("T")[0])
    } else {
      try {
        await updateRow("temas_asesor", tema.id, { estado: "pendiente", notas: null, fecha_reunion: null })
        await mutate()
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" })
      }
    }
  }

  const handleMarcarDiscutido = async () => {
    if (!notasDialog) return
    try {
      await updateRow("temas_asesor", notasDialog.id, {
        estado: "discutido",
        notas: notasText.trim() || null,
        fecha_reunion: fechaReunion || null,
      })
      await mutate()
      setNotasDialog(null)
      toast({ title: "Marcado como discutido" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRow("temas_asesor", id)
      await mutate()
      toast({ title: "Tema eliminado" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const pendientes = temas.filter(t => t.estado === "pendiente")
  const discutidos = temas.filter(t => t.estado === "discutido")

  const proximaReunion = (() => {
    const hoy = new Date()
    // Cada 15 días desde hoy — aproximación visual
    const diff = 15 - (hoy.getDate() % 15)
    const proxima = new Date(hoy)
    proxima.setDate(hoy.getDate() + diff)
    return proxima.toLocaleDateString("es-AR", { day: "numeric", month: "long" })
  })()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Reunión con Federico</h1>
          <p className="text-sm text-muted-foreground">Temas y objetivos para la próxima reunión · aprox. {proximaReunion}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar tema
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{pendientes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alta prioridad</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{pendientes.filter(t => t.prioridad === "alta").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Discutidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{discutidos.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pendientes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Para la próxima reunión</CardTitle>
          <CardDescription>Hacé click en el círculo para marcar un tema como discutido</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : pendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay temas pendientes. ¡Agregá uno!</p>
          ) : (
            [...pendientes]
              .sort((a, b) => {
                const ord = { alta: 0, media: 1, baja: 2 }
                return ord[a.prioridad] - ord[b.prioridad]
              })
              .map((tema) => {
                const cfg = PRIORIDAD_CONFIG[tema.prioridad]
                return (
                  <div key={tema.id} className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                    <button
                      onClick={() => toggleEstado(tema)}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-600 transition-colors"
                      title="Marcar como discutido"
                    >
                      <Circle className="h-5 w-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{tema.texto}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Agregado {formatDate(new Date(tema.created_at))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={cfg.color} className="text-xs">{cfg.label}</Badge>
                      <button
                        onClick={() => handleDelete(tema.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })
          )}
        </CardContent>
      </Card>

      {/* Discutidos */}
      {discutidos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-muted-foreground">Historial — ya discutidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {discutidos.map((tema) => (
              <div key={tema.id} className="flex items-start gap-3 rounded-lg border border-dashed p-3 opacity-70">
                <button
                  onClick={() => toggleEstado(tema)}
                  className="mt-0.5 shrink-0 text-green-600 hover:text-muted-foreground transition-colors"
                  title="Mover a pendientes"
                >
                  <CheckCircle2 className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-through text-muted-foreground">{tema.texto}</p>
                  {tema.notas && (
                    <div className="flex items-start gap-1.5 mt-1">
                      <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground">{tema.notas}</p>
                    </div>
                  )}
                  {tema.fecha_reunion && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Reunión: {formatDate(new Date(tema.fecha_reunion))}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(tema.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Dialog: agregar tema */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo tema para Federico</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>Tema / Objetivo</Label>
              <Textarea
                placeholder="Ej: Revisar estructura de costos del trimestre"
                value={form.texto}
                onChange={(e) => setForm({ ...form, texto: e.target.value })}
                rows={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={form.prioridad} onValueChange={(v) => setForm({ ...form, prioridad: v as Tema["prioridad"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Agregar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: marcar como discutido */}
      <Dialog open={!!notasDialog} onOpenChange={(open) => { if (!open) setNotasDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como discutido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground border rounded-lg p-3 bg-muted/30">
              {notasDialog?.texto}
            </p>
            <div className="space-y-2">
              <Label>Fecha de reunión</Label>
              <Input
                type="date"
                value={fechaReunion}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => setFechaReunion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas / Conclusión (opcional)</Label>
              <Textarea
                placeholder="Qué se decidió, acciones a tomar..."
                value={notasText}
                onChange={(e) => setNotasText(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotasDialog(null)}>Cancelar</Button>
            <Button onClick={handleMarcarDiscutido} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
