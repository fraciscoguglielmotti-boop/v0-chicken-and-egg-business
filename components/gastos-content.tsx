"use client"

import React from "react"

import { useState, useMemo, useRef, useCallback } from "react"
import {
  Plus,
  Search,
  CreditCard,
  Banknote,
  Upload,
  FileText,
  Calendar,
  Tag,
  Filter,
  TrendingDown,
  Receipt,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { SheetsStatus } from "./sheets-status"
import { useSheet, addRow, type SheetRow } from "@/hooks/use-sheets"
import { formatCurrency, formatDate, formatDateForSheets, parseDate, parseSheetNumber } from "@/lib/utils"

// --- Constants ---

const CATEGORIAS = [
  { value: "sueldos", label: "Sueldos", icon: "briefcase" },
  { value: "comisiones", label: "Comisiones Vendedores", icon: "percent" },
  { value: "bonos", label: "Bonos / Premios", icon: "gift" },
  { value: "mantenimiento", label: "Mantenimiento", icon: "wrench" },
  { value: "reparaciones", label: "Reparaciones", icon: "hammer" },
  { value: "combustible", label: "Combustible", icon: "fuel" },
  { value: "peajes_fletes", label: "Peajes / Fletes", icon: "truck" },
  { value: "servicios", label: "Servicios (Luz, Gas, etc.)", icon: "zap" },
  { value: "impuestos", label: "Impuestos / Tasas", icon: "landmark" },
  { value: "alquiler", label: "Alquiler", icon: "home" },
  { value: "insumos", label: "Insumos / Materiales", icon: "package" },
  { value: "tarjeta_credito", label: "Resumen Tarjeta", icon: "credit-card" },
  { value: "otros", label: "Otros", icon: "more-horizontal" },
]

const TARJETAS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "amex", label: "American Express" },
  { value: "otra", label: "Otra" },
]

const BANCOS = [
  { value: "nacion", label: "Banco Nacion" },
  { value: "galicia", label: "Banco Galicia" },
  { value: "macro", label: "Banco Macro" },
  { value: "provincia", label: "Banco Provincia" },
  { value: "santander", label: "Santander" },
  { value: "bbva", label: "BBVA" },
  { value: "hsbc", label: "HSBC" },
  { value: "otro", label: "Otro" },
]

// --- Types ---

interface Gasto {
  id: string
  fecha: Date
  categoria: string
  categoriaLabel: string
  descripcion: string
  monto: number
  medioPago: "efectivo" | "tarjeta"
  tarjeta?: string
  banco?: string
  cuotaActual?: number
  cuotasTotal?: number
  origenPDF?: boolean
}

interface GastoTarjetaResumen {
  tarjeta: string
  banco: string
  totalPendiente: number
  cuotasPendientes: number
  gastos: Gasto[]
}

// --- Helpers ---

function sheetRowToGasto(row: SheetRow, index: number): Gasto {
  const categoriaValue = (row.Categoria || "otros").toLowerCase().replace(/\s+/g, "_")
  const catFound = CATEGORIAS.find((c) => c.value === categoriaValue)
  const fecha = parseDate(row.Fecha || "")

  return {
    id: row.ID || String(index),
    fecha,
    categoria: categoriaValue,
    categoriaLabel: catFound?.label || row.Categoria || "Otros",
    descripcion: row.Descripcion || "",
    monto: parseSheetNumber(row.Monto),
    medioPago: (row.MetodoPago || "").toLowerCase() === "tarjeta" ? "tarjeta" : "efectivo",
    tarjeta: row.Tarjeta || undefined,
    banco: row.Banco || undefined,
    cuotaActual: row.CuotaActual ? Number(row.CuotaActual) : undefined,
    cuotasTotal: row.CuotasTotal ? Number(row.CuotasTotal) : undefined,
    origenPDF: row.OrigenPDF === "true",
  }
}

function getCategoriaLabel(value: string): string {
  return CATEGORIAS.find((c) => c.value === value)?.label || value
}

// --- Component ---

export function GastosContent() {
  const { rows, isLoading, error, mutate } = useSheet("Gastos")

  const [searchTerm, setSearchTerm] = useState("")
  const [categoriaFilter, setCategoriaFilter] = useState("todas")
  const [medioFilter, setMedioFilter] = useState("todos")
  const [periodoFilter, setPeriodoFilter] = useState("este_mes")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // New expense form
  const [nuevoGasto, setNuevoGasto] = useState({
    categoria: "",
    descripcion: "",
    monto: "",
    medioPago: "efectivo" as "efectivo" | "tarjeta",
    tarjeta: "",
    banco: "",
    cuotaActual: "1",
    cuotasTotal: "1",
    fecha: new Date().toISOString().split("T")[0],
  })

  // PDF parsing state
  const [pdfParsing, setPdfParsing] = useState(false)
  const [pdfResult, setPdfResult] = useState<{ gastos: Array<{ descripcion: string; monto: number; cuotas: string }>; tarjeta: string; banco: string; periodo: string } | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [pdfSaving, setPdfSaving] = useState(false)
  const [pdfSaved, setPdfSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isConnected = !error && !isLoading
  const hasError = error

  // Parse all gastos from sheets
  const gastos: Gasto[] = useMemo(() => {
    if (!isConnected || rows.length === 0) return []
    return rows
      .map((row, i) => sheetRowToGasto(row, i))
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
  }, [isConnected, rows])

  // Filtered gastos
  const gastosFiltrados = useMemo(() => {
    const now = new Date()
    return gastos.filter((g) => {
      // Period filter
      if (periodoFilter === "este_mes") {
        if (g.fecha.getUTCMonth() !== now.getMonth() || g.fecha.getUTCFullYear() !== now.getFullYear()) return false
      } else if (periodoFilter === "mes_anterior") {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        if (g.fecha.getUTCMonth() !== prev.getMonth() || g.fecha.getUTCFullYear() !== prev.getFullYear()) return false
      }
      // Medio filter
      if (medioFilter !== "todos" && g.medioPago !== medioFilter) return false
      // Categoria filter
      if (categoriaFilter !== "todas" && g.categoria !== categoriaFilter) return false
      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        if (!g.descripcion.toLowerCase().includes(term) && !g.categoriaLabel.toLowerCase().includes(term)) return false
      }
      return true
    })
  }, [gastos, periodoFilter, medioFilter, categoriaFilter, searchTerm])

  // Stats
  const totalMes = gastosFiltrados.reduce((a, g) => a + g.monto, 0)
  const totalEfectivo = gastosFiltrados.filter((g) => g.medioPago === "efectivo").reduce((a, g) => a + g.monto, 0)
  const totalTarjeta = gastosFiltrados.filter((g) => g.medioPago === "tarjeta").reduce((a, g) => a + g.monto, 0)

  // By category
  const porCategoria = useMemo(() => {
    const map = new Map<string, { label: string; total: number; count: number }>()
    gastosFiltrados.forEach((g) => {
      const existing = map.get(g.categoria) || { label: g.categoriaLabel, total: 0, count: 0 }
      existing.total += g.monto
      existing.count += 1
      map.set(g.categoria, existing)
    })
    return Array.from(map.entries())
      .map(([key, data]) => ({ categoria: key, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [gastosFiltrados])

  // Credit card summary (cuotas pendientes)
  const tarjetaResumen: GastoTarjetaResumen[] = useMemo(() => {
    const map = new Map<string, GastoTarjetaResumen>()
    gastos.filter((g) => g.medioPago === "tarjeta" && g.cuotasTotal && g.cuotaActual).forEach((g) => {
      const key = `${g.tarjeta || "otra"}-${g.banco || "otro"}`
      const cuotasRestantes = (g.cuotasTotal || 1) - (g.cuotaActual || 1)
      if (cuotasRestantes <= 0) return
      const existing = map.get(key) || {
        tarjeta: g.tarjeta || "Otra",
        banco: g.banco || "Otro",
        totalPendiente: 0,
        cuotasPendientes: 0,
        gastos: [],
      }
      existing.totalPendiente += g.monto * cuotasRestantes
      existing.cuotasPendientes += cuotasRestantes
      existing.gastos.push(g)
      map.set(key, existing)
    })
    return Array.from(map.values())
  }, [gastos])

  // Biggest spending category
  const maxCategoria = porCategoria.length > 0 ? porCategoria[0] : null

  // --- Handlers ---

  const handleGuardar = async () => {
    if (!nuevoGasto.monto || !nuevoGasto.categoria) return
    setSaving(true)
    try {
      const id = `G${Date.now()}`
      const fechaSheets = formatDateForSheets(nuevoGasto.fecha)
      await addRow("Gastos", [[
        id,
        fechaSheets,
        "Egreso",
        getCategoriaLabel(nuevoGasto.categoria),
        nuevoGasto.descripcion,
        nuevoGasto.monto,
        nuevoGasto.medioPago === "tarjeta" ? "Tarjeta" : "Efectivo",
        nuevoGasto.tarjeta || "",
        nuevoGasto.banco || "",
        nuevoGasto.cuotaActual || "1",
        nuevoGasto.cuotasTotal || "1",
        "",
      ]])
      await mutate()
      setNuevoGasto({
        categoria: "",
        descripcion: "",
        monto: "",
        medioPago: "efectivo",
        tarjeta: "",
        banco: "",
        cuotaActual: "1",
        cuotasTotal: "1",
        fecha: new Date().toISOString().split("T")[0],
      })
      setDialogOpen(false)
    } catch {
      // Handle silently
    } finally {
      setSaving(false)
    }
  }

  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfParsing(true)
    setPdfError(null)
    setPdfResult(null)
    setPdfSaved(false)

    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/parse-credit-card", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al procesar el PDF")
      }
      const data = await res.json()
      setPdfResult(data)
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setPdfParsing(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [])

  const handleSavePdfGastos = async () => {
    if (!pdfResult) return
    setPdfSaving(true)
    try {
      const rows = pdfResult.gastos.map((g, i) => {
        const cuotaMatch = g.cuotas?.match(/(\d+)\/(\d+)/)
        return [
          `GP${Date.now()}-${i}`,
          pdfResult.periodo || formatDateForSheets(new Date()),
          "Egreso",
          "Resumen Tarjeta",
          g.descripcion,
          String(g.monto),
          "Tarjeta",
          pdfResult.tarjeta || "",
          pdfResult.banco || "",
          cuotaMatch ? cuotaMatch[1] : "1",
          cuotaMatch ? cuotaMatch[2] : "1",
          "true",
        ]
      })
      await addRow("Gastos", rows)
      await mutate()
      setPdfSaved(true)
    } catch {
      setPdfError("Error al guardar los gastos del resumen")
    } finally {
      setPdfSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">Total Gastos</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-destructive">{formatCurrency(totalMes)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Banknote className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Efectivo</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(totalEfectivo)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
              <CreditCard className="h-4 w-4 text-accent-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Tarjeta</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(totalTarjeta)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Tag className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Mayor gasto</p>
          </div>
          <p className="mt-2 text-lg font-bold text-foreground truncate">
            {maxCategoria ? maxCategoria.label : "-"}
          </p>
          {maxCategoria && (
            <p className="text-sm text-muted-foreground">{formatCurrency(maxCategoria.total)}</p>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar gasto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
            <SelectTrigger className="w-36">
              <Calendar className="mr-2 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="este_mes">Este mes</SelectItem>
              <SelectItem value="mes_anterior">Mes anterior</SelectItem>
              <SelectItem value="todo">Todo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={medioFilter} onValueChange={setMedioFilter}>
            <SelectTrigger className="w-36">
              <Filter className="mr-2 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo medio</SelectItem>
              <SelectItem value="efectivo">Efectivo</SelectItem>
              <SelectItem value="tarjeta">Tarjeta</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="w-44">
              <Tag className="mr-2 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorias</SelectItem>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SheetsStatus isLoading={isLoading} error={hasError} isConnected={isConnected} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPdfDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Subir Resumen TC
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Gasto
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="detalle">
        <TabsList>
          <TabsTrigger value="detalle">
            Detalle ({gastosFiltrados.length})
          </TabsTrigger>
          <TabsTrigger value="categorias">Por Categoria</TabsTrigger>
          <TabsTrigger value="tarjetas">Tarjetas / Cuotas</TabsTrigger>
        </TabsList>

        {/* --- Detalle Tab --- */}
        <TabsContent value="detalle">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fecha</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Categoria</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Descripcion</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Medio</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Cuotas</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Monto</th>
                </tr>
              </thead>
              <tbody>
                {gastosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {isLoading ? "Cargando gastos..." : "Sin gastos en el periodo seleccionado"}
                    </td>
                  </tr>
                ) : (
                  gastosFiltrados.map((g) => (
                    <tr key={g.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5 whitespace-nowrap text-foreground">{formatDate(g.fecha)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="bg-muted/50">
                          {g.categoriaLabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 max-w-xs truncate text-muted-foreground">
                        {g.descripcion || "-"}
                        {g.origenPDF && (
                          <Badge variant="outline" className="ml-2 text-[10px] bg-accent/10 text-accent-foreground">PDF</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {g.medioPago === "tarjeta" ? (
                          <div className="flex items-center gap-1.5">
                            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground text-xs">
                              {g.tarjeta ? TARJETAS.find((t) => t.value === g.tarjeta)?.label || g.tarjeta : "Tarjeta"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Banknote className="h-3.5 w-3.5 text-primary" />
                            <span className="text-primary text-xs">Efectivo</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {g.cuotasTotal && g.cuotasTotal > 1
                          ? `${g.cuotaActual || 1}/${g.cuotasTotal}`
                          : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-destructive">
                        {formatCurrency(g.monto)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {gastosFiltrados.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/30 font-bold">
                    <td colSpan={5} className="px-4 py-2.5 text-foreground">Total</td>
                    <td className="px-4 py-2.5 text-right text-destructive">{formatCurrency(totalMes)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </TabsContent>

        {/* --- Por Categoria Tab --- */}
        <TabsContent value="categorias">
          <div className="space-y-3">
            {porCategoria.length === 0 ? (
              <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                Sin gastos en el periodo seleccionado
              </div>
            ) : (
              <>
                {porCategoria.map((cat) => {
                  const pct = totalMes > 0 ? (cat.total / totalMes) * 100 : 0
                  return (
                    <div key={cat.categoria} className="rounded-xl border bg-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{cat.label}</span>
                          <Badge variant="outline" className="text-xs">{cat.count} gastos</Badge>
                        </div>
                        <span className="font-bold text-destructive">{formatCurrency(cat.total)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-destructive/70 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground w-12 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  )
                })}
                <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-foreground">Total Gastos</span>
                    <span className="text-2xl font-bold text-destructive">{formatCurrency(totalMes)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* --- Tarjetas / Cuotas Tab --- */}
        <TabsContent value="tarjetas">
          <div className="space-y-4">
            {tarjetaResumen.length === 0 ? (
              <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                Sin cuotas pendientes de tarjeta de credito
              </div>
            ) : (
              tarjetaResumen.map((tr) => (
                <div key={`${tr.tarjeta}-${tr.banco}`} className="rounded-xl border bg-card overflow-hidden">
                  <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">
                          {TARJETAS.find((t) => t.value === tr.tarjeta)?.label || tr.tarjeta}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {BANCOS.find((b) => b.value === tr.banco)?.label || tr.banco}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-destructive">{formatCurrency(tr.totalPendiente)}</p>
                      <p className="text-xs text-muted-foreground">{tr.cuotasPendientes} cuotas pendientes</p>
                    </div>
                  </div>
                  <div className="divide-y">
                    {tr.gastos.map((g) => (
                      <div key={g.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="text-sm font-medium text-foreground truncate">{g.descripcion || g.categoriaLabel}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(g.fecha)} - Cuota {g.cuotaActual}/{g.cuotasTotal}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-foreground whitespace-nowrap">{formatCurrency(g.monto)}/cuota</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* --- New Expense Dialog --- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Gasto</DialogTitle>
            <DialogDescription>Registra un gasto en efectivo o tarjeta de credito</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={nuevoGasto.fecha}
                  onChange={(e) => setNuevoGasto({ ...nuevoGasto, fecha: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Medio de Pago</Label>
                <Select
                  value={nuevoGasto.medioPago}
                  onValueChange={(v: "efectivo" | "tarjeta") => setNuevoGasto({ ...nuevoGasto, medioPago: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta de Credito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={nuevoGasto.categoria} onValueChange={(v) => setNuevoGasto({ ...nuevoGasto, categoria: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.filter((c) => c.value !== "tarjeta_credito").map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
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
                  value={nuevoGasto.monto}
                  onChange={(e) => setNuevoGasto({ ...nuevoGasto, monto: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            {nuevoGasto.medioPago === "tarjeta" && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium text-foreground">Datos de Tarjeta</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tarjeta</Label>
                    <Select value={nuevoGasto.tarjeta} onValueChange={(v) => setNuevoGasto({ ...nuevoGasto, tarjeta: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {TARJETAS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Banco</Label>
                    <Select value={nuevoGasto.banco} onValueChange={(v) => setNuevoGasto({ ...nuevoGasto, banco: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {BANCOS.map((b) => (
                          <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cuota actual</Label>
                    <Input
                      type="number"
                      min="1"
                      value={nuevoGasto.cuotaActual}
                      onChange={(e) => setNuevoGasto({ ...nuevoGasto, cuotaActual: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Total cuotas</Label>
                    <Input
                      type="number"
                      min="1"
                      value={nuevoGasto.cuotasTotal}
                      onChange={(e) => setNuevoGasto({ ...nuevoGasto, cuotasTotal: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Descripcion</Label>
              <Textarea
                value={nuevoGasto.descripcion}
                onChange={(e) => setNuevoGasto({ ...nuevoGasto, descripcion: e.target.value })}
                placeholder="Detalle del gasto"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={saving || !nuevoGasto.monto || !nuevoGasto.categoria}>
              {saving ? "Guardando..." : "Guardar Gasto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- PDF Upload Dialog --- */}
      <Dialog open={pdfDialogOpen} onOpenChange={(open) => {
        setPdfDialogOpen(open)
        if (!open) { setPdfResult(null); setPdfError(null); setPdfSaved(false) }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Subir Resumen de Tarjeta de Credito</DialogTitle>
            <DialogDescription>
              Subi el PDF del resumen de tu tarjeta Visa o Mastercard. El sistema desglosara automaticamente cada consumo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Upload area */}
            {!pdfResult && !pdfParsing && (
              <label
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">Arrastra el PDF o hace click para seleccionarlo</p>
                  <p className="text-sm text-muted-foreground mt-1">Soporta resumenes de Visa y Mastercard de bancos argentinos</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
              </label>
            )}

            {/* Loading */}
            {pdfParsing && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Procesando resumen de tarjeta...</p>
              </div>
            )}

            {/* Error */}
            {pdfError && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Error al procesar</p>
                  <p className="text-sm text-muted-foreground mt-1">{pdfError}</p>
                  <Button size="sm" variant="outline" className="mt-3 bg-transparent" onClick={() => { setPdfError(null); setPdfResult(null) }}>
                    Intentar de nuevo
                  </Button>
                </div>
              </div>
            )}

            {/* Results */}
            {pdfResult && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border bg-primary/5 p-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">
                      Resumen procesado: {pdfResult.tarjeta} - {pdfResult.banco}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Periodo: {pdfResult.periodo} - {pdfResult.gastos.length} consumos detectados
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Descripcion</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cuotas</th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdfResult.gastos.map((g, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-2 text-foreground">{g.descripcion}</td>
                          <td className="px-3 py-2 text-muted-foreground">{g.cuotas || "1/1"}</td>
                          <td className="px-3 py-2 text-right font-semibold text-destructive">{formatCurrency(g.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 font-bold">
                        <td colSpan={2} className="px-3 py-2 text-foreground">Total</td>
                        <td className="px-3 py-2 text-right text-destructive">
                          {formatCurrency(pdfResult.gastos.reduce((a, g) => a + g.monto, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPdfDialogOpen(false); setPdfResult(null); setPdfError(null); setPdfSaved(false) }}>
              {pdfSaved ? "Cerrar" : "Cancelar"}
            </Button>
            {pdfResult && !pdfSaved && (
              <Button onClick={handleSavePdfGastos} disabled={pdfSaving}>
                {pdfSaving ? "Guardando..." : `Guardar ${pdfResult.gastos.length} gastos`}
              </Button>
            )}
            {pdfSaved && (
              <Button disabled className="bg-primary">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Guardados
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
