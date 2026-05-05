"use client"

import { useState, useMemo } from "react"
import { Plus, Search, Pencil, Trash2, CreditCard, Tag, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "./data-table"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { esMPGasto } from "@/lib/mp-constants"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { LoadingTable } from "@/components/loading-states"
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
  fecha_pago?: string
  pagado?: boolean
}

interface MovimientoMP {
  id: number
  fecha: string
  tipo: string
  monto: number
  descripcion?: string
  categoria?: string
}

interface GastoUnificado {
  fecha: string
  categoria: string
  descripcion?: string
  monto: number
  fuente: "gastos" | "mercadopago"
}

function mpAGastoUnificado(m: MovimientoMP): GastoUnificado {
  return { fecha: m.fecha, categoria: m.categoria || "Sin categoría (MP)", descripcion: m.descripcion, monto: m.monto, fuente: "mercadopago" }
}

const MEDIOS_PAGO = ["Efectivo", "Cuenta Francisco", "Cuenta Diego", "MercadoPago", "Tarjeta Credito"]
const TARJETAS = ["Visa (empresa)", "Visa (personal Francisco)", "Visa (Damián)", "Master", "Tarjeta MP"]

export function GastosContent() {
  const { data: gastos = [], isLoading, mutate } = useSupabase<Gasto>("gastos")
  const { data: categorias = [], mutate: mutateCategorias } = useSupabase<CategoriaGasto>("categorias_gastos")
  const { data: movimientosMp = [] } = useSupabase<MovimientoMP>("movimientos_mp")
  const { toast } = useToast()
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<CategoriaGasto | null>(null)
  const [catNombre, setCatNombre] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas")
  const [medioPagoFiltro, setMedioPagoFiltro] = useState("todos")
  const [tarjetaFiltro, setTarjetaFiltro] = useState("todas")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
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
    cuotas_total: 1,
    pagado: true,
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
      cuotas_total: gasto.cuotas_total || 1,
      pagado: gasto.pagado !== false,
    })
    setEditingId(gasto.id)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este gasto?")) return
    try {
      await deleteRow("gastos", id)
      await mutate()
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err?.message ?? "No se pudo eliminar el gasto", variant: "destructive" })
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
      cuotas_total: 1,
      pagado: true,
    })
  }

  if (isLoading) return <LoadingTable />

  const filteredGastos = gastos
    .filter((g) => {
      const matchSearch =
        g.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.descripcion || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.tarjeta || "").toLowerCase().includes(searchTerm.toLowerCase())
      const matchCategoria = categoriaFiltro === "todas" || g.categoria === categoriaFiltro
      const matchMedio = medioPagoFiltro === "todos" || g.medio_pago === medioPagoFiltro
      const matchTarjeta = tarjetaFiltro === "todas" || g.tarjeta === tarjetaFiltro
      return matchSearch && matchCategoria && matchMedio && matchTarjeta
    })
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  const categoriaNombres = categorias.map(c => c.nombre)

  // When editing, include the gasto's current category even if it's not in the table
  const categoriaOptions = useMemo(() => {
    const set = new Set(categoriaNombres)
    if (editingId && formData.categoria && !set.has(formData.categoria)) {
      return [...categoriaNombres, formData.categoria]
    }
    return categoriaNombres
  }, [categoriaNombres, editingId, formData.categoria])

  // Unified list: gastos table + categorized MP egresos
  // Solo gastos ya pagados en el resumen (los pendientes son compromisos futuros)
  const gastosUnificados = useMemo<GastoUnificado[]>(() => [
    ...gastos.filter(g => g.pagado !== false).map(g => ({ fecha: g.fecha, categoria: g.categoria, descripcion: g.descripcion, monto: g.monto, fuente: "gastos" as const })),
    ...movimientosMp.filter(esMPGasto).map(mpAGastoUnificado),
  ], [gastos, movimientosMp])

  const gastosPorCategoria = useMemo(() => {
    // Include categories that appear in unified list even if not in categorias table
    const allCats = new Set([
      ...categoriaNombres,
      ...gastosUnificados.map(g => g.categoria).filter(Boolean),
    ])
    return Array.from(allCats).map(cat => ({
      categoria: cat,
      total: gastosUnificados.filter(g => g.categoria === cat).reduce((sum, g) => sum + g.monto, 0),
      movimientos: gastosUnificados
        .filter(g => g.categoria === cat)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
  }, [gastosUnificados, categoriaNombres])

  const handleMarcarPagado = async (g: Gasto) => {
    try {
      await updateRow("gastos", g.id, { pagado: true })
      await mutate()
      toast({ title: "Marcado como pagado", description: `${g.categoria} — ${formatCurrency(g.monto)}` })
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    }
  }

  const columns = [
    {
      key: "fecha", header: "Fecha", render: (g: Gasto) => (
        <div>
          <p>{formatDate(new Date(g.fecha))}</p>
          {g.pagado === false && <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 mt-0.5">Pendiente</Badge>}
        </div>
      )
    },
    { key: "categoria", header: "Categoría", render: (g: Gasto) => <Badge variant="outline">{g.categoria}</Badge> },
    { key: "descripcion", header: "Descripción", render: (g: Gasto) => g.descripcion || "-" },
    { key: "monto", header: "Monto", render: (g: Gasto) => <span className="font-semibold text-destructive">{formatCurrency(g.monto)}</span> },
    {
      key: "medio_pago",
      header: "Medio de Pago",
      render: (g: Gasto) => (
        <div className="space-y-0.5">
          <p className="text-sm">{g.medio_pago || "-"}</p>
          {g.tarjeta && <p className="text-xs text-muted-foreground">{g.tarjeta}</p>}
          {g.fecha_pago && (
            <p className="text-xs text-muted-foreground">
              Vence: {formatDate(new Date(g.fecha_pago + "T12:00:00"))}
            </p>
          )}
        </div>
      )
    },
    {
      key: "cuotas",
      header: "Cuotas",
      render: (g: Gasto) => g.cuotas_total && g.cuotas_total > 1 ? `${g.cuota_actual}/${g.cuotas_total}` : "-"
    },
    {
      key: "actions",
      header: "Acciones",
      render: (g: Gasto) => (
        <div className="flex gap-1">
          {g.pagado === false && (
            <Button variant="outline" size="sm" className="text-xs h-7 text-green-700 border-green-400 hover:bg-green-50" onClick={() => handleMarcarPagado(g)}>
              ✓ Pagar
            </Button>
          )}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar gastos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las categorías</SelectItem>
                  {categoriaNombres.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={medioPagoFiltro} onValueChange={(v) => { setMedioPagoFiltro(v); setTarjetaFiltro("todas") }}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Medio de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los medios</SelectItem>
                  {MEDIOS_PAGO.map((mp) => (
                    <SelectItem key={mp} value={mp}>{mp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {medioPagoFiltro === "Tarjeta Credito" && (
                <Select value={tarjetaFiltro} onValueChange={setTarjetaFiltro}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Tarjeta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las tarjetas</SelectItem>
                    {TARJETAS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
                        onChange={(e) => {
                          const fecha = e.target.value
                          const esFuturo = fecha > new Date().toISOString().split('T')[0]
                          setFormData({ ...formData, fecha, pagado: !esFuturo })
                        }}
                        required
                      />
                      {formData.fecha > new Date().toISOString().split('T')[0] && (
                        <p className="text-xs text-amber-600 mt-1">Fecha futura → se guardará como pendiente</p>
                      )}
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select value={formData.categoria} onValueChange={(value) => setFormData({...formData, categoria: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoriaOptions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">Agregá categorías en la pestaña "Categorías"</div>
                          ) : (
                            categoriaOptions.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {categoriaNombres.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">Primero creá categorías en la pestaña "Categorías"</p>
                      )}
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

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, pagado: !formData.pagado })}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${formData.pagado ? "bg-green-50 border-green-400 text-green-700" : "bg-amber-50 border-amber-400 text-amber-700"}`}
                    >
                      {formData.pagado ? "✓ Ya pagado" : "⏳ Pendiente de pago"}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {formData.pagado ? "Impacta en gastos reales" : "No impacta hasta que lo marques como pagado"}
                    </span>
                  </div>

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

        <TabsContent value="resumen" className="space-y-6">
          {/* Total por categoría con desglose expandible */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Total por categoría — {formatCurrency(gastosUnificados.reduce((s, g) => s + g.monto, 0))}
            </h3>
            <div className="space-y-2">
              {gastosPorCategoria.map((item) => {
                const isOpen = expandedCat === item.categoria
                return (
                  <div key={item.categoria} className="rounded-lg border overflow-hidden">
                    <button
                      className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                      onClick={() => setExpandedCat(isOpen ? null : item.categoria)}
                    >
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-semibold">{item.categoria}</span>
                        <span className="text-xs text-muted-foreground">({item.movimientos.length} movimientos)</span>
                      </div>
                      <span className="font-bold text-destructive tabular-nums">{formatCurrency(item.total)}</span>
                    </button>
                    {isOpen && (
                      <div className="border-t bg-muted/10">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/20">
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Fecha</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Descripción</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Fuente</th>
                              <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.movimientos.map((m, i) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(new Date(m.fecha))}</td>
                                <td className="px-4 py-2 text-muted-foreground max-w-xs truncate">{m.descripcion || "—"}</td>
                                <td className="px-4 py-2">
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${m.fuente === "mercadopago" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-muted text-muted-foreground"}`}>
                                    {m.fuente === "mercadopago" ? "MercadoPago" : "Gasto"}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right font-medium text-destructive tabular-nums">{formatCurrency(m.monto)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Gastos de tarjeta por categoría */}
          {TARJETAS.map((tarjeta) => {
            const gastosTarjeta = gastos.filter(g => g.medio_pago === "Tarjeta Credito" && g.tarjeta === tarjeta)
            if (gastosTarjeta.length === 0) return null
            const totalTarjeta = gastosTarjeta.reduce((s, g) => s + g.monto, 0)
            const porCategoria = categoriaNombres
              .map(cat => ({
                cat,
                total: gastosTarjeta.filter(g => g.categoria === cat).reduce((s, g) => s + g.monto, 0)
              }))
              .filter(x => x.total > 0)
              .sort((a, b) => b.total - a.total)
            return (
              <div key={tarjeta}>
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{tarjeta}</h3>
                  <span className="ml-auto text-sm font-semibold text-destructive">{formatCurrency(totalTarjeta)}</span>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {porCategoria.map(({ cat, total }) => (
                        <tr key={cat} className="border-b last:border-0">
                          <td className="px-4 py-2 text-muted-foreground">{cat}</td>
                          <td className="px-4 py-2 text-right font-medium text-destructive">{formatCurrency(total)}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                            {((total / totalTarjeta) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
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
