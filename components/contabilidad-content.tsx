"use client"

import { useState, useMemo } from "react"
import { Plus, TrendingUp, TrendingDown, DollarSign, Minus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { SheetsStatus } from "./sheets-status"
import { useSheet, addRow, type SheetRow } from "@/hooks/use-sheets"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-"
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

interface MovimientoContable {
  id: string
  fecha: string
  tipo: "ingreso" | "egreso"
  categoria: string
  descripcion: string
  monto: number
  origen: "venta" | "cobro" | "compra" | "gasto" | "manual"
}

const CATEGORIAS_INGRESO = [
  "Ventas Pollo",
  "Ventas Huevo",
  "Cobros Clientes",
  "Otros Ingresos",
]

const CATEGORIAS_EGRESO = [
  "Compras Mercaderia",
  "Sueldos",
  "Comisiones",
  "Combustible",
  "Mantenimiento",
  "Alquiler",
  "Impuestos",
  "Servicios",
  "Otros Gastos",
]

export function ContabilidadContent() {
  const sheetsVentas = useSheet("Ventas")
  const sheetsCobros = useSheet("Cobros")
  const sheetsCompras = useSheet("Compras")
  const sheetsGastos = useSheet("Gastos")
  const [mesFilter, setMesFilter] = useState("todos")
  const [categoriaFilter, setCategoriaFilter] = useState("todas")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nuevoMov, setNuevoMov] = useState({
    tipo: "egreso" as "ingreso" | "egreso",
    categoria: "",
    descripcion: "",
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
  })

  const isLoading = sheetsVentas.isLoading || sheetsCompras.isLoading
  const hasError = sheetsVentas.error
  const isConnected = !hasError && !isLoading

  // Build all accounting entries from different sources
  const movimientos: MovimientoContable[] = useMemo(() => {
    const entries: MovimientoContable[] = []

    // Sales as income (Total = Cantidad x PrecioUnitario)
    sheetsVentas.rows.forEach((r, i) => {
      const cant = Number(r.Cantidad) || 0
      const precio = Number(r.PrecioUnitario) || 0
      const total = cant * precio
      entries.push({
        id: `v-${i}`,
        fecha: r.Fecha || "",
        tipo: "ingreso",
        categoria: r.Productos?.includes("Huevo") ? "Ventas Huevo" : "Ventas Pollo",
        descripcion: `Venta a ${r.Cliente || "Cliente"} - ${r.Productos || ""} (${cant} x $${precio})`,
        monto: total,
        origen: "venta",
      })
    })

    // Purchases as expenses (Total = Cantidad x Precio)
    sheetsCompras.rows.forEach((r, i) => {
      const cant = Number(r.Cantidad) || 0
      const precio = Number(r.PrecioUnitario) || 0
      const total = cant * precio
      entries.push({
        id: `c-${i}`,
        fecha: r.Fecha || "",
        tipo: "egreso",
        categoria: "Compras Mercaderia",
        descripcion: `Compra a ${r.Proveedor || "Proveedor"} - ${r.Producto || ""}`,
        monto: total,
        origen: "compra",
      })
    })

    // Manual expenses/income from Gastos sheet
    sheetsGastos.rows.forEach((r, i) => {
      entries.push({
        id: `g-${i}`,
        fecha: r.Fecha || "",
        tipo: (r.Tipo?.toLowerCase() === "ingreso" ? "ingreso" : "egreso"),
        categoria: r.Categoria || "Otros Gastos",
        descripcion: r.Descripcion || "",
        monto: Number(r.Monto) || 0,
        origen: "manual",
      })
    })

    return entries.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [sheetsVentas.rows, sheetsCompras.rows, sheetsGastos.rows])

  // Filter
  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      if (mesFilter !== "todos") {
        const fecha = new Date(m.fecha)
        const mesActual = new Date()
        if (mesFilter === "este_mes") {
          if (fecha.getMonth() !== mesActual.getMonth() || fecha.getFullYear() !== mesActual.getFullYear()) return false
        }
        if (mesFilter === "mes_anterior") {
          const prev = new Date(mesActual.getFullYear(), mesActual.getMonth() - 1, 1)
          if (fecha.getMonth() !== prev.getMonth() || fecha.getFullYear() !== prev.getFullYear()) return false
        }
      }
      if (categoriaFilter !== "todas" && m.categoria !== categoriaFilter) return false
      return true
    })
  }, [movimientos, mesFilter, categoriaFilter])

  const totalIngresos = movimientosFiltrados.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0)
  const totalEgresos = movimientosFiltrados.filter((m) => m.tipo === "egreso").reduce((a, m) => a + m.monto, 0)
  const resultado = totalIngresos - totalEgresos
  const margen = totalIngresos > 0 ? (resultado / totalIngresos) * 100 : 0

  // Group by category for summary
  const resumenCategorias = useMemo(() => {
    const map = new Map<string, { tipo: string; total: number; count: number }>()
    movimientosFiltrados.forEach((m) => {
      const existing = map.get(m.categoria) || { tipo: m.tipo, total: 0, count: 0 }
      existing.total += m.monto
      existing.count += 1
      map.set(m.categoria, existing)
    })
    return Array.from(map.entries())
      .map(([cat, data]) => ({ categoria: cat, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [movimientosFiltrados])

  const allCategorias = [...new Set(movimientos.map((m) => m.categoria))].sort()

  const handleGuardar = async () => {
    if (!nuevoMov.monto || !nuevoMov.categoria) return
    setSaving(true)
    try {
      const id = `G${Date.now()}`
      await addRow("Gastos", [[
        id,
        nuevoMov.fecha,
        nuevoMov.tipo === "ingreso" ? "Ingreso" : "Egreso",
        nuevoMov.categoria,
        nuevoMov.descripcion,
        nuevoMov.monto,
      ]])
      await sheetsGastos.mutate()
      setNuevoMov({ tipo: "egreso", categoria: "", descripcion: "", monto: "", fecha: new Date().toISOString().split("T")[0] })
      setDialogOpen(false)
    } catch {
      // Handle silently
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Ingresos</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">Egresos</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-destructive">{formatCurrency(totalEgresos)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Resultado</p>
          </div>
          <p className={`mt-2 text-2xl font-bold ${resultado >= 0 ? "text-primary" : "text-destructive"}`}>
            {formatCurrency(resultado)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Minus className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Margen</p>
          </div>
          <p className={`mt-2 text-2xl font-bold ${margen >= 0 ? "text-primary" : "text-destructive"}`}>
            {margen.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <Select value={mesFilter} onValueChange={setMesFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo el periodo</SelectItem>
              <SelectItem value="este_mes">Este mes</SelectItem>
              <SelectItem value="mes_anterior">Mes anterior</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorias</SelectItem>
              {allCategorias.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SheetsStatus isLoading={isLoading} error={hasError} isConnected={isConnected} />
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Movimiento
        </Button>
      </div>

      {/* Tabs: Resumen vs Detalle */}
      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen por Categoria</TabsTrigger>
          <TabsTrigger value="detalle">Detalle ({movimientosFiltrados.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Ingresos column */}
            <div className="rounded-xl border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="font-semibold text-primary">Ingresos</h3>
              </div>
              <div className="divide-y">
                {resumenCategorias
                  .filter((c) => c.tipo === "ingreso")
                  .map((cat) => (
                    <div key={cat.categoria} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{cat.categoria}</p>
                        <p className="text-xs text-muted-foreground">{cat.count} movimientos</p>
                      </div>
                      <p className="font-semibold text-primary">{formatCurrency(cat.total)}</p>
                    </div>
                  ))}
                {resumenCategorias.filter((c) => c.tipo === "ingreso").length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin ingresos en el periodo</p>
                )}
                <div className="flex items-center justify-between bg-primary/5 px-4 py-3 font-bold">
                  <span>Total Ingresos</span>
                  <span className="text-primary">{formatCurrency(totalIngresos)}</span>
                </div>
              </div>
            </div>

            {/* Egresos column */}
            <div className="rounded-xl border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="font-semibold text-destructive">Egresos</h3>
              </div>
              <div className="divide-y">
                {resumenCategorias
                  .filter((c) => c.tipo === "egreso")
                  .map((cat) => (
                    <div key={cat.categoria} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{cat.categoria}</p>
                        <p className="text-xs text-muted-foreground">{cat.count} movimientos</p>
                      </div>
                      <p className="font-semibold text-destructive">{formatCurrency(cat.total)}</p>
                    </div>
                  ))}
                {resumenCategorias.filter((c) => c.tipo === "egreso").length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin egresos en el periodo</p>
                )}
                <div className="flex items-center justify-between bg-destructive/5 px-4 py-3 font-bold">
                  <span>Total Egresos</span>
                  <span className="text-destructive">{formatCurrency(totalEgresos)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Result bar */}
          <div className={`rounded-xl border-2 p-4 ${resultado >= 0 ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-foreground">Resultado Neto</span>
              <span className={`text-2xl font-bold ${resultado >= 0 ? "text-primary" : "text-destructive"}`}>
                {formatCurrency(resultado)}
              </span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="detalle">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fecha</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Categoria</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Descripcion</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {isLoading ? "Cargando movimientos..." : "Sin movimientos en el periodo seleccionado"}
                    </td>
                  </tr>
                ) : (
                  movimientosFiltrados.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(m.fecha)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={m.tipo === "ingreso" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}>
                          {m.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.categoria}</td>
                      <td className="px-4 py-2.5 max-w-xs truncate text-muted-foreground">{m.descripcion}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${m.tipo === "ingreso" ? "text-primary" : "text-destructive"}`}>
                        {m.tipo === "ingreso" ? "+" : "-"}{formatCurrency(m.monto)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* New movement dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Movimiento</DialogTitle>
            <DialogDescription>
              Registre un nuevo movimiento contable
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={nuevoMov.tipo} onValueChange={(v: "ingreso" | "egreso") => setNuevoMov({ ...nuevoMov, tipo: v, categoria: "" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="egreso">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={nuevoMov.fecha} onChange={(e) => setNuevoMov({ ...nuevoMov, fecha: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={nuevoMov.categoria} onValueChange={(v) => setNuevoMov({ ...nuevoMov, categoria: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {(nuevoMov.tipo === "ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={nuevoMov.monto}
                  onChange={(e) => setNuevoMov({ ...nuevoMov, monto: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripcion</Label>
              <Textarea
                value={nuevoMov.descripcion}
                onChange={(e) => setNuevoMov({ ...nuevoMov, descripcion: e.target.value })}
                placeholder="Detalle del movimiento"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={saving || !nuevoMov.monto || !nuevoMov.categoria}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
