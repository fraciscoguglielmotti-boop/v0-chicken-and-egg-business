"use client"

import { useState } from "react"
import { Plus, Search, Pencil, Trash2, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "./data-table"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Gasto {
  id: string
  fecha: string
  tipo: string
  categoria: string
  descripcion?: string
  monto: number
  medio_pago?: string
  tarjeta?: string
  banco?: string
  cuota_actual?: number
  cuotas_total?: number
}

const CATEGORIAS = [
  "Combustibles",
  "Sueldos",
  "Comisiones",
  "Servicios",
  "Mantenimiento",
  "Alquiler",
  "Impuestos",
  "Otros"
]

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Tarjeta Credito", "Tarjeta Debito"]
const TARJETAS = ["Visa", "Mastercard", "Amex", "Otra"]
const BANCOS = ["Santander", "Galicia", "BBVA", "Macro", "Otro"]

export function GastosContent() {
  const { data: gastos = [], isLoading, mutate } = useSupabase<Gasto>("gastos")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: "Egreso",
    categoria: "",
    descripcion: "",
    monto: "",
    medio_pago: "Efectivo",
    tarjeta: "",
    banco: "",
    cuota_actual: 1,
    cuotas_total: 1
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...formData,
      monto: parseFloat(formData.monto),
      cuota_actual: parseInt(formData.cuota_actual.toString()),
      cuotas_total: parseInt(formData.cuotas_total.toString())
    }
    
    if (editingId) {
      await updateRow("gastos", editingId, data)
      setEditingId(null)
    } else {
      await insertRow("gastos", data)
    }
    mutate()
    setIsDialogOpen(false)
    resetForm()
  }

  const handleEdit = (gasto: Gasto) => {
    setFormData({
      fecha: gasto.fecha,
      tipo: gasto.tipo,
      categoria: gasto.categoria,
      descripcion: gasto.descripcion || "",
      monto: gasto.monto.toString(),
      medio_pago: gasto.medio_pago || "Efectivo",
      tarjeta: gasto.tarjeta || "",
      banco: gasto.banco || "",
      cuota_actual: gasto.cuota_actual || 1,
      cuotas_total: gasto.cuotas_total || 1
    })
    setEditingId(gasto.id)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("¿Eliminar este gasto?")) {
      await deleteRow("gastos", id)
      mutate()
    }
  }

  const resetForm = () => {
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      tipo: "Egreso",
      categoria: "",
      descripcion: "",
      monto: "",
      medio_pago: "Efectivo",
      tarjeta: "",
      banco: "",
      cuota_actual: 1,
      cuotas_total: 1
    })
  }

  const filteredGastos = gastos.filter((g) =>
    g.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.descripcion || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  const gastosPorCategoria = CATEGORIAS.map(cat => ({
    categoria: cat,
    total: gastos.filter(g => g.categoria === cat).reduce((sum, g) => sum + g.monto, 0)
  })).filter(c => c.total > 0)

  const columns = [
    { key: "fecha", header: "Fecha", render: (g: Gasto) => formatDate(new Date(g.fecha)) },
    { key: "categoria", header: "Categoria", render: (g: Gasto) => <Badge variant="outline">{g.categoria}</Badge> },
    { key: "descripcion", header: "Descripcion", render: (g: Gasto) => g.descripcion || "-" },
    { key: "monto", header: "Monto", render: (g: Gasto) => <span className="font-semibold text-destructive">{formatCurrency(g.monto)}</span> },
    { key: "medio_pago", header: "Medio Pago", render: (g: Gasto) => g.medio_pago || "-" },
    { 
      key: "cuotas", 
      header: "Cuotas", 
      render: (g: Gasto) => g.cuotas_total && g.cuotas_total > 1 ? `${g.cuota_actual}/${g.cuotas_total}` : "-" 
    },
    {
      key: "actions",
      header: "Acciones",
      render: (g: Gasto) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(g)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(g.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-6">
      <Tabs defaultValue="listado">
        <TabsList>
          <TabsTrigger value="listado">Listado</TabsTrigger>
          <TabsTrigger value="resumen">Resumen por Categoria</TabsTrigger>
        </TabsList>

        <TabsContent value="listado" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar gastos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
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
                  Nuevo Gasto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar Gasto" : "Nuevo Gasto"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Fecha</Label>
                      <Input 
                        type="date" 
                        value={formData.fecha} 
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setFormData({...formData, fecha: e.target.value})} 
                        required 
                      />
                    </div>
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
                  </div>

                  <div>
                    <Label>Descripcion</Label>
                    <Input value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} placeholder="Detalle del gasto" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Monto</Label>
                      <Input type="number" step="0.01" value={formData.monto} onChange={(e) => setFormData({...formData, monto: e.target.value})} required />
                    </div>
                    <div>
                      <Label>Medio de Pago</Label>
                      <Select value={formData.medio_pago} onValueChange={(value) => setFormData({...formData, medio_pago: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEDIOS_PAGO.map(mp => (
                            <SelectItem key={mp} value={mp}>{mp}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {formData.medio_pago === "Tarjeta Credito" && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Tarjeta</Label>
                          <Select value={formData.tarjeta} onValueChange={(value) => setFormData({...formData, tarjeta: value})}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar tarjeta" />
                            </SelectTrigger>
                            <SelectContent>
                              {TARJETAS.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Banco</Label>
                          <Select value={formData.banco} onValueChange={(value) => setFormData({...formData, banco: value})}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar banco" />
                            </SelectTrigger>
                            <SelectContent>
                              {BANCOS.map(b => (
                                <SelectItem key={b} value={b}>{b}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Cuota Actual</Label>
                          <Input type="number" min="1" value={formData.cuota_actual} onChange={(e) => setFormData({...formData, cuota_actual: parseInt(e.target.value) || 1})} />
                        </div>
                        <div>
                          <Label>Total Cuotas</Label>
                          <Input type="number" min="1" value={formData.cuotas_total} onChange={(e) => setFormData({...formData, cuotas_total: parseInt(e.target.value) || 1})} />
                        </div>
                      </div>
                    </>
                  )}

                  <DialogFooter>
                    <Button type="submit">{editingId ? "Actualizar" : "Guardar"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <DataTable
            columns={columns}
            data={filteredGastos}
            emptyMessage={isLoading ? "Cargando..." : "No hay gastos registrados"}
          />
        </TabsContent>

        <TabsContent value="resumen">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {gastosPorCategoria.map((item) => (
              <div key={item.categoria} className="rounded-lg border p-4">
                <h3 className="font-semibold">{item.categoria}</h3>
                <p className="text-2xl font-bold text-destructive mt-2">{formatCurrency(item.total)}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
