"use client"

import { useState, useMemo } from "react"
import {
  Plus,
  Target,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Pencil,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { SheetsStatus } from "./sheets-status"
import { useSheet, addRow, updateRow } from "@/hooks/use-sheets"
import { formatCurrency, parseDate } from "@/lib/utils"

const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const CATEGORIAS_PRESUPUESTO = [
  "Sueldos",
  "Comisiones Vendedores",
  "Bonos / Premios",
  "Mantenimiento",
  "Reparaciones",
  "Combustible",
  "Peajes / Fletes",
  "Servicios (Luz, Gas, etc.)",
  "Impuestos / Tasas",
  "Alquiler",
  "Insumos / Materiales",
  "Tarjeta de Credito",
  "Otros",
]

interface Presupuesto {
  id: string
  categoria: string
  montoPresupuestado: number
  mes: number
  anio: number
  rowIndex: number
}

interface PresupuestoConGasto extends Presupuesto {
  montoGastado: number
  porcentaje: number
  excedido: boolean
}

export function PresupuestosContent() {
  const sheetsPresupuestos = useSheet("Presupuestos")
  const sheetsGastos = useSheet("Gastos")
  const [mesFilter, setMesFilter] = useState(String(new Date().getMonth()))
  const [anioFilter, setAnioFilter] = useState(String(new Date().getFullYear()))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [nuevoPres, setNuevoPres] = useState({
    categoria: "",
    monto: "",
    mes: String(new Date().getMonth()),
    anio: String(new Date().getFullYear()),
  })

  const isLoading = sheetsPresupuestos.isLoading || sheetsGastos.isLoading
  const hasError = sheetsPresupuestos.error
  const isConnected = !hasError && !isLoading

  // Parse presupuestos from sheet
  const presupuestos: Presupuesto[] = useMemo(() => {
    return sheetsPresupuestos.rows.map((r, i) => ({
      id: r.ID || `p-${i}`,
      categoria: r.Categoria || "",
      montoPresupuestado: Number(r.Monto) || 0,
      mes: Number(r.Mes) || 0,
      anio: Number(r.Anio) || new Date().getFullYear(),
      rowIndex: i,
    }))
  }, [sheetsPresupuestos.rows])

  // Gastos by category for selected month
  const gastosPorCategoria = useMemo(() => {
    const mes = Number(mesFilter)
    const anio = Number(anioFilter)
    const map = new Map<string, number>()

    sheetsGastos.rows.forEach((r) => {
      if (r.Tipo?.toLowerCase() === "ingreso") return
      const fecha = parseDate(r.Fecha || "")
      if (fecha.getUTCMonth() === mes && fecha.getUTCFullYear() === anio) {
        const cat = r.Categoria || "Otros"
        map.set(cat, (map.get(cat) || 0) + (Number(r.Monto) || 0))
      }
    })

    return map
  }, [sheetsGastos.rows, mesFilter, anioFilter])

  // Merge presupuestos with actual spending
  const presupuestosConGasto: PresupuestoConGasto[] = useMemo(() => {
    const mes = Number(mesFilter)
    const anio = Number(anioFilter)

    return presupuestos
      .filter((p) => p.mes === mes && p.anio === anio)
      .map((p) => {
        const gastado = gastosPorCategoria.get(p.categoria) || 0
        const porcentaje = p.montoPresupuestado > 0 ? (gastado / p.montoPresupuestado) * 100 : 0
        return {
          ...p,
          montoGastado: gastado,
          porcentaje,
          excedido: gastado > p.montoPresupuestado,
        }
      })
      .sort((a, b) => b.porcentaje - a.porcentaje)
  }, [presupuestos, gastosPorCategoria, mesFilter, anioFilter])

  // Totals
  const totalPresupuestado = presupuestosConGasto.reduce((a, p) => a + p.montoPresupuestado, 0)
  const totalGastado = presupuestosConGasto.reduce((a, p) => a + p.montoGastado, 0)
  const totalPorcentaje = totalPresupuestado > 0 ? (totalGastado / totalPresupuestado) * 100 : 0
  const categoriasExcedidas = presupuestosConGasto.filter((p) => p.excedido).length

  // Categories without budget
  const categoriasSinPresupuesto = useMemo(() => {
    const presupuestadasMes = new Set(presupuestosConGasto.map((p) => p.categoria))
    const gastadas: Array<{ categoria: string; monto: number }> = []
    gastosPorCategoria.forEach((monto, cat) => {
      if (!presupuestadasMes.has(cat)) {
        gastadas.push({ categoria: cat, monto })
      }
    })
    return gastadas.sort((a, b) => b.monto - a.monto)
  }, [presupuestosConGasto, gastosPorCategoria])

  // Years available
  const aniosDisponibles = useMemo(() => {
    const set = new Set<number>()
    set.add(new Date().getFullYear())
    presupuestos.forEach((p) => set.add(p.anio))
    return Array.from(set).sort((a, b) => b - a)
  }, [presupuestos])

  const handleGuardar = async () => {
    if (!nuevoPres.monto || !nuevoPres.categoria) return
    setSaving(true)
    try {
      if (editingId) {
        // Update existing
        const pres = presupuestos.find((p) => p.id === editingId)
        if (pres) {
          await updateRow("Presupuestos", pres.rowIndex, [
            pres.id,
            nuevoPres.categoria,
            nuevoPres.monto,
            nuevoPres.mes,
            nuevoPres.anio,
          ])
        }
      } else {
        // New
        const id = `PR${Date.now()}`
        await addRow("Presupuestos", [[
          id,
          nuevoPres.categoria,
          nuevoPres.monto,
          nuevoPres.mes,
          nuevoPres.anio,
        ]])
      }
      await sheetsPresupuestos.mutate()
      setNuevoPres({ categoria: "", monto: "", mes: mesFilter, anio: anioFilter })
      setEditingId(null)
      setDialogOpen(false)
    } catch {
      // Handle silently
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (p: PresupuestoConGasto) => {
    setEditingId(p.id)
    setNuevoPres({
      categoria: p.categoria,
      monto: String(p.montoPresupuestado),
      mes: String(p.mes),
      anio: String(p.anio),
    })
    setDialogOpen(true)
  }

  const handleDelete = async (p: PresupuestoConGasto) => {
    // Update with zero to "delete"
    try {
      await updateRow("Presupuestos", p.rowIndex, [p.id, p.categoria, "0", String(p.mes), String(p.anio)])
      await sheetsPresupuestos.mutate()
    } catch {
      // Handle silently
    }
  }

  function getStatusColor(porcentaje: number): string {
    if (porcentaje > 100) return "text-destructive"
    if (porcentaje > 80) return "text-accent-foreground"
    return "text-primary"
  }

  function getBarColor(porcentaje: number): string {
    if (porcentaje > 100) return "bg-destructive"
    if (porcentaje > 80) return "bg-accent"
    return "bg-primary"
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Presupuestado</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(totalPresupuestado)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">Gastado</p>
          </div>
          <p className={`mt-2 text-2xl font-bold ${totalGastado > totalPresupuestado ? "text-destructive" : "text-foreground"}`}>
            {formatCurrency(totalGastado)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${totalPorcentaje > 100 ? "bg-destructive/10" : "bg-primary/10"}`}>
              {totalPorcentaje > 100 ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">Ejecucion</p>
          </div>
          <p className={`mt-2 text-2xl font-bold ${getStatusColor(totalPorcentaje)}`}>
            {totalPorcentaje.toFixed(0)}%
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">Excedidos</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-destructive">{categoriasExcedidas}</p>
          <p className="text-xs text-muted-foreground">de {presupuestosConGasto.length} categorias</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Select value={mesFilter} onValueChange={setMesFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES_NOMBRES.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anioFilter} onValueChange={setAnioFilter}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {aniosDisponibles.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SheetsStatus isLoading={isLoading} error={hasError} isConnected={isConnected} />
        </div>
        <Button size="sm" onClick={() => { setEditingId(null); setNuevoPres({ categoria: "", monto: "", mes: mesFilter, anio: anioFilter }); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Presupuesto
        </Button>
      </div>

      {/* Budget Items */}
      <div className="space-y-3">
        {presupuestosConGasto.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <Target className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="font-medium text-foreground">Sin presupuestos para {MESES_NOMBRES[Number(mesFilter)]} {anioFilter}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crea la pestana "Presupuestos" en tu hoja con encabezados: ID, Categoria, Monto, Mes, Anio.
              {" "}Luego agrega presupuestos para cada categoria de gastos.
            </p>
          </div>
        ) : (
          presupuestosConGasto.filter((p) => p.montoPresupuestado > 0).map((p) => (
            <div key={p.id} className={`rounded-xl border bg-card p-4 ${p.excedido ? "border-destructive/30" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{p.categoria}</span>
                  {p.excedido && (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                      EXCEDIDO
                    </Badge>
                  )}
                  {p.porcentaje >= 80 && !p.excedido && (
                    <Badge variant="outline" className="bg-accent/10 text-accent-foreground border-accent/30 text-[10px]">
                      ALERTA
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only">Editar presupuesto</span>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(p)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Eliminar presupuesto</span>
                  </Button>
                </div>
              </div>
              <div className="flex items-end justify-between mb-2">
                <div className="flex items-baseline gap-1">
                  <span className={`text-xl font-bold ${getStatusColor(p.porcentaje)}`}>
                    {formatCurrency(p.montoGastado)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {formatCurrency(p.montoPresupuestado)}
                  </span>
                </div>
                <span className={`text-sm font-semibold ${getStatusColor(p.porcentaje)}`}>
                  {p.porcentaje.toFixed(0)}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getBarColor(p.porcentaje)}`}
                  style={{ width: `${Math.min(p.porcentaje, 100)}%` }}
                />
              </div>
              {p.excedido && (
                <p className="mt-1.5 text-xs text-destructive">
                  Excedido por {formatCurrency(p.montoGastado - p.montoPresupuestado)}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Categories without budget */}
      {categoriasSinPresupuesto.length > 0 && (
        <div className="rounded-xl border border-dashed bg-muted/20 p-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            Gastos sin presupuesto asignado en {MESES_NOMBRES[Number(mesFilter)]}:
          </p>
          <div className="flex flex-wrap gap-2">
            {categoriasSinPresupuesto.map((g) => (
              <Badge key={g.categoria} variant="outline" className="text-muted-foreground">
                {g.categoria}: {formatCurrency(g.monto)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Overall progress bar */}
      {presupuestosConGasto.length > 0 && (
        <div className={`rounded-xl border-2 p-4 ${totalGastado > totalPresupuestado ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-foreground">Presupuesto Total del Mes</span>
            <span className={`text-lg font-bold ${getStatusColor(totalPorcentaje)}`}>
              {formatCurrency(totalGastado)} / {formatCurrency(totalPresupuestado)}
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getBarColor(totalPorcentaje)}`}
              style={{ width: `${Math.min(totalPorcentaje, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-muted-foreground">
              {totalPorcentaje > 100
                ? `Excedido por ${formatCurrency(totalGastado - totalPresupuestado)}`
                : `Disponible: ${formatCurrency(totalPresupuestado - totalGastado)}`}
            </span>
            <span className={`text-xs font-semibold ${getStatusColor(totalPorcentaje)}`}>
              {totalPorcentaje.toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* New/Edit Budget Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Presupuesto" : "Nuevo Presupuesto"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifica el monto presupuestado para esta categoria" : "Define un limite de gasto mensual por categoria"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={nuevoPres.categoria} onValueChange={(v) => setNuevoPres({ ...nuevoPres, categoria: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_PRESUPUESTO.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto Presupuestado</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={nuevoPres.monto}
                  onChange={(e) => setNuevoPres({ ...nuevoPres, monto: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mes</Label>
                <Select value={nuevoPres.mes} onValueChange={(v) => setNuevoPres({ ...nuevoPres, mes: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES_NOMBRES.map((m, i) => (
                      <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Anio</Label>
                <Input
                  type="number"
                  value={nuevoPres.anio}
                  onChange={(e) => setNuevoPres({ ...nuevoPres, anio: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null) }}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={saving || !nuevoPres.monto || !nuevoPres.categoria}>
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
