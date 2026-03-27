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
}

const CATEGORIAS = [
  "Combustibles",
  "Sueldos",
  "Comisiones",
  "Servicios",
  "Mantenimiento",
  "Alquiler",
  "Impuestos"
]

const MESES = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" }
]

export function PresupuestosContent() {
  const { data: presupuestos = [], isLoading, mutate } = useSupabase<Presupuesto>("presupuestos")
  const { data: gastos = [] } = useSupabase<Gasto>("gastos")
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
    setFormData({
      categoria: "",
      monto: "",
      mes: new Date().getMonth() + 1,
      anio: new Date().getFullYear()
    })
  }

  const comparacion = useMemo(() => {
    const presupuestosDelMes = presupuestos.filter(
      p => p.mes === selectedMes && p.anio === selectedAnio
    )

    const gastosDelMes = gastos.filter(g => {
      const fecha = new Date(g.fecha)
      return fecha.getMonth() + 1 === selectedMes && fecha.getFullYear() === selectedAnio
    })

    return CATEGORIAS.map(categoria => {
      const presupuesto = presupuestosDelMes.find(p => p.categoria === categoria)
      const gastosCategoria = gastosDelMes
        .filter(g => g.categoria === categoria)
        .reduce((sum, g) => sum + g.monto, 0)

      const montoPresupuestado = presupuesto?.monto || 0
      const diferencia = montoPresupuestado - gastosCategoria
      const porcentajeUsado = montoPresupuestado > 0 
        ? (gastosCategoria / montoPresupuestado) * 100 
        : 0

      return {
        categoria,
        presupuestado: montoPresupuestado,
        gastado: gastosCategoria,
        diferencia,
        porcentajeUsado
      }
    }).filter(c => c.presupuestado > 0 || c.gastado > 0)
  }, [presupuestos, gastos, selectedMes, selectedAnio])

  const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-4">
          <div>
            <Label>Mes</Label>
            <Select value={selectedMes.toString()} onValueChange={(value) => setSelectedMes(parseInt(value))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map(m => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Año</Label>
            <Select value={selectedAnio.toString()} onValueChange={(value) => setSelectedAnio(parseInt(value))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anios.map(a => (
                  <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            setEditingId(null)
            resetForm()
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Presupuesto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Presupuesto" : "Nuevo Presupuesto"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Categoria</Label>
                <Select value={formData.categoria} onValueChange={(value) => setFormData({...formData, categoria: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Monto Presupuestado</Label>
                <Input type="number" step="0.01" value={formData.monto} onChange={(e) => setFormData({...formData, monto: e.target.value})} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Mes</Label>
                  <Select value={formData.mes.toString()} onValueChange={(value) => setFormData({...formData, mes: parseInt(value)})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES.map(m => (
                        <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Año</Label>
                  <Select value={formData.anio.toString()} onValueChange={(value) => setFormData({...formData, anio: parseInt(value)})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {anios.map(a => (
                        <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
                      ))}
                    </SelectContent>
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

      <div className="grid gap-4">
        {comparacion.map((item) => (
          <Card key={item.categoria} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{item.categoria}</h3>
              <Badge variant={item.diferencia >= 0 ? "default" : "destructive"}>
                {item.porcentajeUsado.toFixed(0)}% usado
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Presupuestado</span>
                <span className="font-medium">{formatCurrency(item.presupuestado)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gastado</span>
                <span className="font-medium">{formatCurrency(item.gastado)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="font-semibold">Diferencia</span>
                <span className={`font-bold ${item.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(item.diferencia))} {item.diferencia >= 0 ? 'disponible' : 'excedido'}
                </span>
              </div>
            </div>

            <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${item.porcentajeUsado > 100 ? 'bg-red-600' : item.porcentajeUsado > 80 ? 'bg-orange-600' : 'bg-green-600'}`}
                style={{ width: `${Math.min(item.porcentajeUsado, 100)}%` }}
              />
            </div>

            <div className="mt-4 flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  const pres = presupuestos.find(p => 
                    p.categoria === item.categoria && 
                    p.mes === selectedMes && 
                    p.anio === selectedAnio
                  )
                  if (pres) handleEdit(pres)
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  const pres = presupuestos.find(p => 
                    p.categoria === item.categoria && 
                    p.mes === selectedMes && 
                    p.anio === selectedAnio
                  )
                  if (pres) handleDelete(pres.id)
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
