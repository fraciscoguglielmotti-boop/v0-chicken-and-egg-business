"use client"

import { useState, useRef } from "react"
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  Check,
  Search,
  X,
  FileUp,
  BarChart2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSupabase, updateRow, insertRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const CATEGORIAS_MP = [
  "Combustible",
  "Comisión",
  "Sueldo",
  "Servicio",
  "Impuesto",
  "Proveedor",
  "Mantenimiento",
  "Alquiler",
  "Retiro",
  "Otro",
]

interface MovimientoMP {
  id: string
  fecha: string
  tipo: "ingreso" | "egreso"
  monto: number
  descripcion?: string
  concepto?: string
  referencia?: string
  pagador_nombre?: string
  pagador_email?: string
  tipo_operacion?: string
  metodo_pago?: string
  estado: "sin_verificar" | "verificado" | "sospechoso"
  categoria?: string
}

interface ComprobanteMP {
  id: string
  movimiento_id?: string
  monto_comprobante?: number
  fecha_comprobante?: string
  referencia_comprobante?: string
  remitente?: string
  estado: "verificado" | "sospechoso" | "sin_match"
  notas?: string
  created_at: string
}

interface VerifyResult {
  extracted: {
    monto: number | null
    fecha: string | null
    referencia: string | null
    remitente: string | null
    destino_cvu: string | null
  }
  matched?: MovimientoMP
  estado: "verificado" | "sospechoso" | "sin_match"
  notas: string
}

const ESTADO_MOVIMIENTO = {
  sin_verificar: { label: "Sin verificar", variant: "secondary" as const },
  verificado: { label: "Verificado", variant: "default" as const },
  sospechoso: { label: "Sospechoso", variant: "destructive" as const },
}

const ESTADO_COMPROBANTE = {
  verificado: {
    label: "Verificado ✓",
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
  },
  sospechoso: {
    label: "Sospechoso ⚠",
    icon: AlertTriangle,
    color: "text-yellow-600",
    bg: "bg-yellow-50 border-yellow-200",
  },
  sin_match: {
    label: "No encontrado ✗",
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
  },
}

export function MercadoPagoContent() {
  const { toast } = useToast()
  const {
    data: movimientos = [],
    isLoading: loadingMovimientos,
    mutate: mutateMovimientos,
  } = useSupabase<MovimientoMP>("movimientos_mp")
  const {
    data: comprobantes = [],
    mutate: mutateComprobantes,
  } = useSupabase<ComprobanteMP>("comprobantes_mp")

  const [importingPDF, setImportingPDF] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // ── Generar reporte MP via API ───────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + "01"
  const [reporteDesde, setReporteDesde] = useState(firstOfMonth)
  const [reporteHasta, setReporteHasta] = useState(today)
  const [generatingReport, setGeneratingReport] = useState(false)

  const handleGenerarReporte = async () => {
    if (!reporteDesde || !reporteHasta) {
      toast({ title: "Seleccioná las fechas", variant: "destructive" })
      return
    }
    setGeneratingReport(true)
    try {
      const res = await fetch("/api/mp/generar-reporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fechaDesde: reporteDesde, fechaHasta: reporteHasta }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? `Error del servidor (${res.status})`)
      }
      const data = await res.json()
      await mutateMovimientos()
      toast({
        title: "Reporte importado",
        description: `${data.importados} movimientos — ${data.ingresos} ingresos, ${data.egresos} egresos${data.clasificados > 0 ? `, ${data.clasificados} auto-clasificados` : ""}`,
      })
    } catch (err) {
      toast({
        title: "Error al generar reporte",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      })
    } finally {
      setGeneratingReport(false)
    }
  }
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const toggleRow = (id: string) =>
    setExpandedRows(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const [tipoFiltro, setTipoFiltro] = useState("todos")
  const [estadoFiltro, setEstadoFiltro] = useState("todos")
  const [categoriaFiltro, setCategoriaFiltro] = useState("todos")
  const [busqueda, setBusqueda] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")

  const startEdit = (m: MovimientoMP, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(m.id)
    setEditingValue(m.concepto ?? m.descripcion ?? "")
  }

  const saveConcepto = async (id: string) => {
    try {
      await updateRow("movimientos_mp", id, { concepto: editingValue.trim() || null })
      await mutateMovimientos()
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" })
    } finally {
      setEditingId(null)
    }
  }

  const saveCategoria = async (m: MovimientoMP, categoria: string) => {
    try {
      await updateRow("movimientos_mp", m.id, { categoria: categoria || null })

      // Guardar regla para auto-clasificar en el futuro
      // Usar pagador_nombre si existe (más específico), si no la descripción
      const textoRegla = (m.pagador_nombre?.trim() || m.descripcion?.trim()) ?? null
      const GENERICOS = ["Transferencia", "Pago", "Saldo MP", "Pago QR/POS", "Pago recurrente"]
      const esGenerico = !textoRegla || textoRegla.length < 4 || GENERICOS.includes(textoRegla)

      if (!esGenerico && categoria) {
        await insertRow("reglas_categorias", {
          texto_original: textoRegla,
          categoria,
          proveedor: m.pagador_nombre?.trim() || null,
        }).catch(() => {
          // Si ya existe la regla, no es crítico
        })
      }

      await mutateMovimientos()
      toast({
        title: "Categoría guardada",
        description: textoRegla && !esGenerico
          ? `La regla "${textoRegla}" → ${categoria} se aplicará en futuros sincronizaciones.`
          : `Categoría actualizada.`,
      })
    } catch {
      toast({ title: "Error al guardar categoría", variant: "destructive" })
    }
  }

  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Importar resumen PDF ─────────────────────────────────────────────────────

  const handleImportPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (pdfInputRef.current) pdfInputRef.current.value = ""

    setImportingPDF(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/mp/importar-resumen", { method: "POST", body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? `Error del servidor (${res.status})`)
      }
      const data = await res.json()
      await mutateMovimientos()
      toast({
        title: "Resumen importado",
        description: `${data.importados} movimientos — ${data.ingresos} ingresos, ${data.egresos} egresos${data.clasificados > 0 ? `, ${data.clasificados} auto-clasificados` : ""}`,
      })
    } catch (err) {
      toast({ title: "Error al importar", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setImportingPDF(false)
    }
  }

  // ── Verify comprobante ───────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setVerifying(true)
    setVerifyResult(null)

    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/mp/verify-comprobante", { method: "POST", body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? `Error del servidor (${res.status})`)
      }
      const data = await res.json()
      setVerifyResult(data)
      await mutateComprobantes()
    } catch (err) {
      toast({ title: "Error al verificar", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setVerifying(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // ── Filtered movements ───────────────────────────────────────────────────────

  const filteredMovimientos = movimientos.filter((m) => {
    const matchTipo = tipoFiltro === "todos" || m.tipo === tipoFiltro
    const matchEstado = estadoFiltro === "todos" || m.estado === estadoFiltro
    const matchCategoria =
      categoriaFiltro === "todos" ||
      (categoriaFiltro === "sin_categoria" ? !m.categoria : m.categoria === categoriaFiltro)
    const q = busqueda.toLowerCase()
    const matchBusqueda = !q || [m.concepto, m.descripcion, m.pagador_nombre, m.pagador_email]
      .some(v => v?.toLowerCase().includes(q))
    return matchTipo && matchEstado && matchCategoria && matchBusqueda
  })

  const totalIngresos = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((s, m) => s + m.monto, 0)
  const totalEgresos = movimientos
    .filter((m) => m.tipo === "egreso")
    .reduce((s, m) => s + m.monto, 0)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Ingresos del período</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Egresos del período</p>
          <p className="text-2xl font-bold text-destructive mt-1">{formatCurrency(totalEgresos)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Balance neto</p>
          <p className={`text-2xl font-bold mt-1 ${totalIngresos - totalEgresos >= 0 ? "text-green-600" : "text-destructive"}`}>
            {formatCurrency(totalIngresos - totalEgresos)}
          </p>
        </div>
      </div>

      <Tabs defaultValue="movimientos">
        <TabsList>
          <TabsTrigger value="movimientos">Movimientos ({movimientos.length})</TabsTrigger>
          <TabsTrigger value="comprobantes">Verificar Comprobantes</TabsTrigger>
          <TabsTrigger value="historial">Historial ({comprobantes.length})</TabsTrigger>
        </TabsList>

        {/* ── TAB: MOVIMIENTOS ── */}
        <TabsContent value="movimientos" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar concepto, titular..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="pl-8 h-9 w-[220px]"
                />
                {busqueda && (
                  <button onClick={() => setBusqueda("")} className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ingreso">Ingresos</SelectItem>
                  <SelectItem value="egreso">Egresos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="sin_verificar">Sin verificar</SelectItem>
                  <SelectItem value="verificado">Verificados</SelectItem>
                  <SelectItem value="sospechoso">Sospechosos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas las categorías</SelectItem>
                  <SelectItem value="sin_categoria">Sin categoría</SelectItem>
                  {CATEGORIAS_MP.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Generar reporte por API con selector de fechas */}
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={reporteDesde}
                  max={reporteHasta}
                  onChange={(e) => setReporteDesde(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  disabled={generatingReport}
                />
                <span className="text-xs text-muted-foreground">al</span>
                <input
                  type="date"
                  value={reporteHasta}
                  min={reporteDesde}
                  onChange={(e) => setReporteHasta(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  disabled={generatingReport}
                />
                <Button onClick={handleGenerarReporte} disabled={generatingReport} variant="default">
                  {generatingReport ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <BarChart2 className="mr-2 h-4 w-4" />
                  )}
                  {generatingReport ? "Generando…" : "Generar Reporte"}
                </Button>
              </div>
              {/* Importar PDF manual */}
              <Button onClick={() => pdfInputRef.current?.click()} disabled={importingPDF} variant="outline">
                {importingPDF ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="mr-2 h-4 w-4" />
                )}
                {importingPDF ? "Procesando PDF…" : "Importar PDF"}
              </Button>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleImportPDF}
              />
            </div>
          </div>

          {loadingMovimientos ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Cargando movimientos...</span>
            </div>
          ) : filteredMovimientos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed text-muted-foreground">
              <p className="font-medium">Sin movimientos</p>
              <p className="text-sm mt-1">Sincronizá tu cuenta de MercadoPago para ver los movimientos</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-8 p-3" />
                    <th className="text-left p-3 font-semibold">Fecha</th>
                    <th className="text-left p-3 font-semibold">Tipo</th>
                    <th className="text-left p-3 font-semibold">Titular</th>
                    <th className="text-left p-3 font-semibold">Concepto <span className="text-muted-foreground font-normal text-xs">(editable)</span></th>
                    <th className="text-left p-3 font-semibold">Categoría</th>
                    <th className="text-right p-3 font-semibold">Monto</th>
                    <th className="text-left p-3 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovimientos.map((m) => {
                    const expanded = expandedRows.has(m.id)
                    const hasExtra = m.tipo_operacion || m.metodo_pago || m.referencia || m.pagador_email
                    return (
                      <>
                        <tr
                          key={m.id}
                          className={`border-t hover:bg-muted/20 ${hasExtra ? "cursor-pointer" : ""}`}
                          onClick={() => hasExtra && toggleRow(m.id)}
                        >
                          <td className="p-3 text-muted-foreground text-center">
                            {hasExtra && (
                              <span className="text-xs">{expanded ? "▾" : "▸"}</span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap text-muted-foreground">
                            {formatDate(new Date(m.fecha))}
                          </td>
                          <td className="p-3">
                            {m.tipo === "ingreso" ? (
                              <span className="flex items-center gap-1 text-green-600 font-medium">
                                <ArrowDownCircle className="h-4 w-4" /> Ingreso
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-destructive font-medium">
                                <ArrowUpCircle className="h-4 w-4" /> Egreso
                              </span>
                            )}
                          </td>
                          {/* Titular */}
                          <td className="p-3 max-w-[160px]">
                            {m.pagador_nombre ? (
                              <p className="font-medium truncate">{m.pagador_nombre}</p>
                            ) : m.pagador_email ? (
                              <p className="text-xs text-muted-foreground truncate">{m.pagador_email}</p>
                            ) : (
                              <span className="text-muted-foreground text-xs">Sin datos</span>
                            )}
                          </td>
                          {/* Concepto editable */}
                          <td className="p-3 max-w-[240px]" onClick={e => e.stopPropagation()}>
                            {editingId === m.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  autoFocus
                                  value={editingValue}
                                  onChange={e => setEditingValue(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") saveConcepto(m.id); if (e.key === "Escape") setEditingId(null) }}
                                  className="h-7 text-xs"
                                  placeholder="Ej: Peaje, Proveedor..."
                                />
                                <button onClick={() => saveConcepto(m.id)} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
                                <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 group">
                                {m.concepto ? (
                                  <span className="font-medium">{m.concepto}</span>
                                ) : m.descripcion ? (
                                  <span className="text-muted-foreground italic text-xs truncate">{m.descripcion}</span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">Sin concepto</span>
                                )}
                                <button
                                  onClick={e => startEdit(m, e)}
                                  className="opacity-0 group-hover:opacity-100 ml-1 text-muted-foreground hover:text-foreground transition-opacity"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          {/* Categoría — solo editable para egresos */}
                          <td className="p-3 min-w-[150px]" onClick={e => e.stopPropagation()}>
                            {m.tipo === "egreso" ? (
                              <Select
                                value={m.categoria ?? ""}
                                onValueChange={(val) => saveCategoria(m, val)}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Sin categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                  {CATEGORIAS_MP.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className={`p-3 text-right font-semibold ${m.tipo === "ingreso" ? "text-green-600" : "text-destructive"}`}>
                            {m.tipo === "ingreso" ? "+" : "-"}{formatCurrency(m.monto)}
                          </td>
                          <td className="p-3">
                            <Badge variant={ESTADO_MOVIMIENTO[m.estado]?.variant ?? "secondary"}>
                              {ESTADO_MOVIMIENTO[m.estado]?.label ?? m.estado}
                            </Badge>
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${m.id}-detail`} className="bg-muted/30 border-t">
                            <td colSpan={8} className="px-10 py-3">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                {m.tipo_operacion && (
                                  <div>
                                    <p className="text-muted-foreground mb-0.5">Tipo operación</p>
                                    <p className="font-medium">{m.tipo_operacion}</p>
                                  </div>
                                )}
                                {m.metodo_pago && (
                                  <div>
                                    <p className="text-muted-foreground mb-0.5">Método de pago</p>
                                    <p className="font-medium">{m.metodo_pago}</p>
                                  </div>
                                )}
                                {m.pagador_email && (
                                  <div>
                                    <p className="text-muted-foreground mb-0.5">Email</p>
                                    <p className="font-medium">{m.pagador_email}</p>
                                  </div>
                                )}
                                {m.referencia && (
                                  <div>
                                    <p className="text-muted-foreground mb-0.5">ID MP</p>
                                    <p className="font-medium font-mono">{m.referencia}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── TAB: VERIFICAR COMPROBANTE ── */}
        <TabsContent value="comprobantes" className="space-y-6">
          <div>
            <h3 className="font-semibold mb-1">Verificar comprobante de pago</h3>
            <p className="text-sm text-muted-foreground">
              Subí la foto o PDF del comprobante que te mandó el cliente. Claude extrae los datos y
              los cruza con los movimientos reales de tu cuenta MP.
            </p>
          </div>

          <div
            className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/25 p-14 cursor-pointer hover:border-muted-foreground/50 transition-colors"
            onClick={() => !verifying && fileInputRef.current?.click()}
          >
            {verifying ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Analizando comprobante con IA...</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">Subir comprobante</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    JPG, PNG o PDF — foto de pantalla o archivo
                  </p>
                </div>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={verifying}
          />

          {/* Result */}
          {verifyResult && (
            <div className={`rounded-lg border-2 p-5 space-y-4 ${ESTADO_COMPROBANTE[verifyResult.estado].bg}`}>
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = ESTADO_COMPROBANTE[verifyResult.estado].icon
                  return (
                    <Icon className={`h-6 w-6 shrink-0 ${ESTADO_COMPROBANTE[verifyResult.estado].color}`} />
                  )
                })()}
                <div>
                  <p className={`font-bold text-lg ${ESTADO_COMPROBANTE[verifyResult.estado].color}`}>
                    {ESTADO_COMPROBANTE[verifyResult.estado].label}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{verifyResult.notas}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-current/10">
                <div>
                  <p className="text-xs text-muted-foreground">Monto del comprobante</p>
                  <p className="font-semibold">
                    {verifyResult.extracted.monto
                      ? formatCurrency(verifyResult.extracted.monto)
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-semibold">{verifyResult.extracted.fecha ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Remitente</p>
                  <p className="font-semibold">{verifyResult.extracted.remitente ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Referencia</p>
                  <p className="font-semibold text-xs">{verifyResult.extracted.referencia ?? "-"}</p>
                </div>
              </div>

              {verifyResult.matched && (
                <div className="pt-2 border-t border-current/10">
                  <p className="text-xs text-muted-foreground mb-1">Movimiento MP coincidente</p>
                  <p className="text-sm">
                    <span className="font-medium">{formatCurrency(verifyResult.matched.monto)}</span>
                    {" · "}
                    {formatDate(new Date(verifyResult.matched.fecha))}
                    {verifyResult.matched.pagador_nombre && ` · ${verifyResult.matched.pagador_nombre}`}
                    {" · "}
                    <span className="text-muted-foreground">ID MP: {verifyResult.matched.id}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: HISTORIAL ── */}
        <TabsContent value="historial">
          {comprobantes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed text-muted-foreground">
              <p className="font-medium">Sin historial</p>
              <p className="text-sm mt-1">Los comprobantes verificados aparecerán aquí</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-semibold">Fecha verificación</th>
                    <th className="text-left p-3 font-semibold">Remitente</th>
                    <th className="text-right p-3 font-semibold">Monto</th>
                    <th className="text-left p-3 font-semibold">Fecha comp.</th>
                    <th className="text-left p-3 font-semibold">Referencia</th>
                    <th className="text-left p-3 font-semibold">Resultado</th>
                    <th className="text-left p-3 font-semibold">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {comprobantes.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/20">
                      <td className="p-3 whitespace-nowrap text-muted-foreground">
                        {formatDate(new Date(c.created_at))}
                      </td>
                      <td className="p-3 font-medium">{c.remitente ?? "-"}</td>
                      <td className="p-3 text-right font-semibold">
                        {c.monto_comprobante ? formatCurrency(c.monto_comprobante) : "-"}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {c.fecha_comprobante ?? "-"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {c.referencia_comprobante ?? "-"}
                      </td>
                      <td className="p-3">
                        <span className={`font-medium ${ESTADO_COMPROBANTE[c.estado].color}`}>
                          {ESTADO_COMPROBANTE[c.estado].label}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[240px]">
                        {c.notas ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
