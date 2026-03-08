"use client"

import { useState } from "react"
import { Plus, Search, Pencil, Trash2, CreditCard, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "./data-table"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImportarTarjeta } from "./importar-tarjeta"

interface CategoriaGasto {
  id: string
  nombre: string
}

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

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Tarjeta Credito", "Tarjeta Debito"]
const TARJETAS = ["Visa", "Mastercard", "Amex", "Otra"]
const BANCOS = ["Santander", "Galicia", "BBVA", "Macro", "Otro"]

export function GastosContent() {
  const { data: gastos = [], isLoading, mutate } = useSupabase<Gasto>("gastos")
  const { data: categorias = [], mutate: mutateCategorias } = useSupabase<CategoriaGasto>("categorias_gastos")
  const { toast } = useToast()
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<CategoriaGasto | null>(null)
  const [catNombre, setCatNombre] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
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

  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nombre = catNombre.trim()
    if (!nombre) return
    try {
      if (editingCat) {
        await updateRow("categorias_gastos", editingCat.id, { nombre })
        toast({ title: "Categoría actualizada" })
      } else {
        await insertRow("categorias_gastos", { nombre })
        toast({ title: "Categoría agregada" })
      }
      await mutateCategorias()
      setCatDialogOpen(false)
      setEditingCat(null)
      setCatNombre("")
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    }
  }

  const handleCatDelete = async (id: string) => {
    try {
      await deleteRow("categorias_gastos", id)
      await mutateCategorias()
      toast({ title: "Categoría eliminada" })
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...formData,
      monto: parseFloat(formData.monto),
      cuota_actual: parseInt(formData.cuota_actual.toString()),
      cuotas_total: parseInt(formData.cuotas_total.toString())
    }

    try {
      if (editingId) {
        await updateRow("gastos", editingId, data)
        setEditingId(null)
        toast({ title: "Gasto actualizado", description: "Los cambios se guardaron correctamente." })
      } else {
        await insertRow("gastos", data)
        toast({ title: "Gasto agregado", description: `${data.categoria} — ${formatCurrency(data.monto)}` })
      }
      mutate()
      setIsDialogOpen(false)
      resetForm()
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err?.message ?? "Error desconocido", variant: "destructive" })
    }
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

  const filteredGastos = gastos.filter((g) => {
    const matchSearch =
      g.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.descripcion || "").toLowerCase().includes(searchTerm.toLowerCase())
    const matchCategoria = categoriaFiltro === "todas" || g.categoria === categoriaFiltro
    return matchSearch && matchCategoria
  })

  const categoriaNombres = categorias.map(c => c.nombre)

  const gastosPorCategoria = categoriaNombres.map(cat => ({
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
          <TabsTrigger value="categorias"><Tag className="h-3.5 w-3.5 mr-1" />Categorías</TabsTrigger>
        </TabsList>

        <TabsContent value="listado" className="space-y-4">
          {showImport ? (
            <ImportarTarjeta
              onClose={() => setShowImport(false)}
              onImportComplete={() => mutate()}
            />
          ) : (
          <>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-3 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar gastos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las categorías</SelectItem>
                  {categoriaNombres.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Importar resumen de tarjeta
            </Button>
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
                          {categoriaNombres.map(cat => (
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
          </div>

          <DataTable
            columns={columns}
            data={filteredGastos}
            emptyMessage={isLoading ? "Cargando..." : "No hay gastos registrados"}
          />
          </>
          )}
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

        <TabsContent value="categorias" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{categorias.length} categorías</p>
            <Button size="sm" onClick={() => { setEditingCat(null); setCatNombre(""); setCatDialogOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva categoría
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {categorias.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <span className="font-medium">{cat.nombre}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCat(cat); setCatNombre(cat.nombre); setCatDialogOpen(true) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleCatDelete(cat.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={catDialogOpen} onOpenChange={(open) => { setCatDialogOpen(open); if (!open) { setEditingCat(null); setCatNombre("") } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCat ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCatSubmit} className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input value={catNombre} onChange={(e) => setCatNombre(e.target.value)} placeholder="Ej: Fletes" autoFocus required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingCat ? "Guardar cambios" : "Agregar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
