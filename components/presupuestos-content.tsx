"use client"

import { useState, useMemo } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatCurrency } from "@/lib/utils"
import { esMPGasto } from "@/lib/mp-constants"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface Presupuesto {
  id: string
  categoria: string
  monto: number
  mes: number
  anio: number
}

interface Gasto {
  categoria: string
  monto: number
  fecha: string
  pagado?: boolean
}

interface MovimientoMP {
  fecha: string
  tipo: string
  monto: number
  descripcion?: string
  categoria?: string
}

interface CategoriaGasto {
  id: string
  nombre: string
}

const MESES = [
  { value: 1, label: "Enero" }, { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" }, { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" }, { value: 6, label: "Junio" },
  { value: 7, label: "Julio" }, { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" }, { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" }, { value: 12, label: "Diciembre" },
]

export function PresupuestosContent() {
  const { data: presupuestos = [], isLoading, mutate } = useSupabase<Presupuesto>("presupuestos")
  const { data: gastos = [] } = useSupabase<Gasto>("gastos")
  const { data: movimientosMp = [] } = useSupabase<MovimientoMP>("movimientos_mp")
  const { data: categorias = [] } = useSupabase<CategoriaGasto>("categorias_gastos")
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1)
  const [selectedAnio, setSelectedAnio] = useState(new Date().getFullYear())

  const [formData, setFormData] = useState({
    categoria: "",
    monto: "",
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear()
  })

  const categoriaNombres = categorias.map(c => c.nombre)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = {
        ...formData,
        monto: parseFloat(formData.monto),
        mes: parseInt(formData.mes.toString()),
        anio: parseInt(formData.anio.toString())
      }
      if (editingId) {
        await updateRow("presupuestos", editingId, data)
        setEditingId(null)
      } else {
        await insertRow("presupuestos", data)
      }
      await mutate()
      setIsDialogOpen(false)
      resetForm()
      toast({ title: editingId ? "Presupuesto actualizado" : "Presupuesto creado" })
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err?.message ?? "No se pudo guardar el presupuesto", variant: "destructive" })
    }
  }

  const handleEdit = (presupuesto: Presupuesto) => {
    setFormData({
      categoria: presupuesto.categoria,
      monto: presupuesto.monto.toString(),
      mes: presupuesto.mes,
      anio: presupuesto.anio
    })
    setEditingId(presupuesto.id)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este presupuesto?")) return
    try {
      await deleteRow("presupuestos", id)
      await mutate()
      toast({ title: "Presupuesto eliminado" })
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err?.message ?? "No se pudo eliminar el presupuesto", variant: "destructive" })
    }
  }

  const resetForm = () => {
    setFormData({ categoria: "", monto: "", mes: new Date().getMonth() + 1, anio: new Date().getFullYear() })
  }

  const comparacion = useMemo(() => {
    const prefixMes = `${selectedAnio}-${String(selectedMes).padStart(2, "0")}`
    const presupuestosDelMes = presupuestos.filter(p => p.mes === selectedMes && p.anio === selectedAnio)

    // Gastos reales pagados del mes (tabla gastos)
    const gastosDelMes = gastos.filter(g => g.fecha.startsWith(prefixMes) && g.pagado !== false)

    // Egresos MP del mes que son gastos operativos
    const mpDelMes = movimientosMp.filter(m => esMPGasto(m) && m.fecha.startsWith(prefixMes))

    // Categorías con presupuesto o con gastos reales
    const todasCats = new Set([
      ...presupuestosDelMes.map(p => p.categoria),
      ...(gastosDelMes.map(g => g.categoria).filter(Boolean) as string[]),
      ...(mpDelMes.map(m => m.categoria).filter(Boolean) as string[]),
    ])

    return Array.from(todasCats).map(categoria => {
      const presupuesto = presupuestosDelMes.find(p => p.categoria === categoria)
      const gastadoGastos = gastosDelMes.filter(g => g.categoria === categoria).reduce((s, g) => s + g.monto, 0)
      const gastadoMP = mpDelMes.filter(m => m.categoria === categoria).reduce((s, m) => s + m.monto, 0)
      const gastado = gastadoGastos + gastadoMP
      const presupuestado = presupuesto?.monto ?? 0
      const diferencia = presupuestado - gastado
      const porcentajeUsado = presupuestado > 0 ? (gastado / presupuestado) * 100 : 0
      return { categoria, presupuestado, gastado, diferencia, porcentajeUsado, tienePresupuesto: !!presupuesto, presupuestoId: presupuesto?.id }
    }).sort((a, b) => {
      if (a.tienePresupuesto !== b.tienePresupuesto) return a.tienePresupuesto ? -1 : 1
      return b.gastado - a.gastado
    })
  }, [presupuestos, gastos, movimientosMp, selectedMes, selectedAnio])

  const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-4">
          <div>
            <Label>Mes</Label>
            <Select value={selectedMes.toString()} onValueChange={(v) => setSelectedMes(parseInt(v))}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Año</Label>
            <Select value={selectedAnio.toString()} onValueChange={(v) => setSelectedAnio(parseInt(v))}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anios.map(a => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingId(null); resetForm() } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nuevo Presupuesto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Presupuesto" : "Nuevo Presupuesto"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Categoría</Label>
                <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                  <SelectContent>
                    {categoriaNombres.length === 0
                      ? <div className="px-3 py-2 text-xs text-muted-foreground">Sin categorías — agregá en Gastos → Categorías</div>
                      : categoriaNombres.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monto Presupuestado</Label>
                <Input type="number" step="0.01" value={formData.monto} onChange={(e) => setFormData({ ...formData, monto: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Mes</Label>
                  <Select value={formData.mes.toString()} onValueChange={(v) => setFormData({ ...formData, mes: parseInt(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MESES.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Año</Label>
                  <Select value={formData.anio.toString()} onValueChange={(v) => setFormData({ ...formData, anio: parseInt(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{anios.map(a => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">{editingId ? "Actualizar" : "Guardar"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {comparacion.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground text-sm">No hay presupuestos ni gastos para este mes.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {comparacion.map((item) => (
            <Card key={item.categoria} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{item.categoria}</h3>
                {item.tienePresupuesto ? (
                  <Badge variant={item.diferencia >= 0 ? "default" : "destructive"}>
                    {item.porcentajeUsado.toFixed(0)}% usado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">Sin presupuesto</Badge>
                )}
              </div>

              <div className="space-y-1.5 text-sm">
                {item.tienePresupuesto && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Presupuestado</span>
                    <span className="font-medium">{formatCurrency(item.presupuestado)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gastado</span>
                  <span className="font-medium">{formatCurrency(item.gastado)}</span>
                </div>
                {item.tienePresupuesto && (
                  <div className="flex justify-between border-t pt-1.5">
                    <span className="font-semibold">Diferencia</span>
                    <span className={`font-bold ${item.diferencia >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(Math.abs(item.diferencia))} {item.diferencia >= 0 ? "disponible" : "excedido"}
                    </span>
                  </div>
                )}
              </div>

              {item.tienePresupuesto && (
                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${item.porcentajeUsado > 100 ? "bg-red-600" : item.porcentajeUsado > 80 ? "bg-orange-500" : "bg-green-600"}`}
                    style={{ width: `${Math.min(item.porcentajeUsado, 100)}%` }}
                  />
                </div>
              )}

              <div className="mt-3 flex gap-1">
                {item.tienePresupuesto && item.presupuestoId ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => { const p = presupuestos.find(p => p.id === item.presupuestoId); if (p) handleEdit(p) }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => item.presupuestoId && handleDelete(item.presupuestoId)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />Eliminar
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setFormData({ categoria: item.categoria ?? "", monto: "", mes: selectedMes, anio: selectedAnio })
                    setIsDialogOpen(true)
                  }}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Agregar presupuesto
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
