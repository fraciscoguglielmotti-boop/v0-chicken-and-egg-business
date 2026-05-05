"use client"

import { useState, useRef, useMemo } from "react"
import {
  FileUp, Loader2, CheckCircle2, AlertTriangle, HelpCircle,
  Trash2, Pencil, Check, X, ChevronDown, ChevronRight,
  Sparkles, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSupabase, updateRow, deleteRow, insertRow } from "@/hooks/use-supabase"
import { MP_CATEGORIA_NO_COBRO, MP_CATEGORIAS_NO_GASTO, MP_EGRESO_NO_GASTO_LABEL } from "@/lib/mp-constants"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface MovimientoMP {
  id: string
  fecha: string
  tipo: "ingreso" | "egreso"
  monto: number
  descripcion?: string
  referencia?: string
  categoria?: string
  estado?: string
}

interface Cobro {
  id: string
  fecha: string
  cliente_nombre?: string
  monto: number
  metodo_pago?: string
  cuenta_destino?: string
}

interface CategoriaGasto {
  id: string
  nombre: string
}

type SortField = "fecha" | "descripcion" | "monto" | "categoria"
type SortDir = "asc" | "desc"

// ── Helpers ───────────────────────────────────────────────────────────────────

function diffDias(a: string, b: string) {
  const toMs = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number)
    return new Date(y, m - 1, d).getTime()
  }
  return Math.abs(toMs(a) - toMs(b)) / 86_400_000
}

function esCobrosMP(c: Cobro) {
  const metodo = (c.metodo_pago ?? "").toLowerCase()
  const destino = (c.cuenta_destino ?? "").toLowerCase()
  return metodo === "transferencia" && destino.includes("guglielmotti")
}

function totalMonto(items: { monto: number }[]) {
  return items.reduce((s, i) => s + i.monto, 0)
}

// ── Sub-componente: cabecera de columna ordenable ─────────────────────────────

function SortTh({
  label, field, current, dir, onSort,
}: {
  label: string
  field: SortField
  current: SortField
  dir: SortDir
  onSort: (f: SortField) => void
}) {
  const active = current === field
  return (
    <th
      className="px-3 py-2 text-left font-medium cursor-pointer select-none hover:text-foreground group"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? dir === "asc"
            ? <ArrowUp className="h-3 w-3 text-primary" />
            : <ArrowDown className="h-3 w-3 text-primary" />
          : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />
        }
      </span>
    </th>
  )
}

// ── Sub-componente: cabecera de acordeón ──────────────────────────────────────

function AccordionHeader({
  open, onToggle, icon, label, count, total, color,
}: {
  open: boolean
  onToggle: () => void
  icon: React.ReactNode
  label: string
  count: number
  total: number
  color: string
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 font-medium hover:opacity-80 transition-opacity w-full text-left ${color}`}
    >
      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      {icon}
      <span>{label} ({count})</span>
      {count > 0 && (
        <span className="ml-auto text-sm font-normal opacity-70">
          {formatCurrency(total)}
        </span>
      )}
    </button>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function MercadoPagoContent() {
  const { toast } = useToast()
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [importando, setImportando] = useState(false)

  const { data: movimientos = [], mutate: refreshMov } = useSupabase<MovimientoMP>("movimientos_mp")
  const { data: cobros = [] } = useSupabase<Cobro>("cobros")
  const { data: categorias = [] } = useSupabase<CategoriaGasto>("categorias_gastos")

  // Filtros movimientos
  const [mesFiltro, setMesFiltro] = useState<string>("todos")
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos")

  // Ordenamiento
  const [sortField, setSortField] = useState<SortField>("fecha")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortField(field); setSortDir("asc") }
  }

  // Acordeones verificar cobros
  const [abierto, setAbierto] = useState({ verificados: false, sinMatch: true, mpSinCobro: true })
  const toggleAcordeon = (key: keyof typeof abierto) =>
    setAbierto((prev) => ({ ...prev, [key]: !prev[key] }))

  // Filtro mes para verificar cobros
  const [mesVerificar, setMesVerificar] = useState<string>("todos")

  // Edición de categoría inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCat, setEditCat] = useState<string>("")

  // Sugerencia de clasificación masiva
  const [sugerencia, setSugerencia] = useState<{
    descripcion: string; categoria: string; ids: string[]
  } | null>(null)
  const [aplicandoSugerencia, setAplicandoSugerencia] = useState(false)

  // ── Importar PDF ─────────────────────────────────────────────────────────────

  const handleImportPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (pdfInputRef.current) pdfInputRef.current.value = ""
    setImportando(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/mp/importar-pdf", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Error del servidor (${res.status})`)
      toast({
        title: "PDF importado",
        description: `${data.importados} movimientos (${data.ingresos} ingresos, ${data.egresos} egresos). ${data.clasificados} auto-clasificados.`,
      })
      refreshMov()
    } catch (err) {
      toast({ title: "Error al importar", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setImportando(false)
    }
  }

  // ── Movimientos filtrados y ordenados ─────────────────────────────────────────

  const mesesDisponibles = useMemo(() => {
    const set = new Set<string>()
    movimientos.forEach((m) => set.add(m.fecha.slice(0, 7)))
    return [...set].sort().reverse()
  }, [movimientos])

  const movimientosFiltrados = useMemo(() => {
    const filtered = movimientos.filter((m) => {
      if (mesFiltro !== "todos" && !m.fecha.startsWith(mesFiltro)) return false
      if (tipoFiltro !== "todos" && m.tipo !== tipoFiltro) return false
      return true
    })
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === "fecha") cmp = a.fecha.localeCompare(b.fecha)
      else if (sortField === "descripcion") cmp = (a.descripcion ?? "").localeCompare(b.descripcion ?? "")
      else if (sortField === "monto") cmp = a.monto - b.monto
      else if (sortField === "categoria") cmp = (a.categoria ?? "").localeCompare(b.categoria ?? "")
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [movimientos, mesFiltro, tipoFiltro, sortField, sortDir])

  // ── Guardar categoría ─────────────────────────────────────────────────────────

  const guardarCategoria = async (id: string, categoria: string) => {
    await updateRow("movimientos_mp", id, { categoria })
    setEditingId(null)
    refreshMov()
    const movActual = movimientos.find((m) => m.id === id)
    if (!movActual?.descripcion) return
    const desc = movActual.descripcion.trim().toLowerCase()
    const similares = movimientos.filter(
      (m) => m.id !== id && m.tipo === "egreso" && !m.categoria && m.descripcion?.trim().toLowerCase() === desc
    )
    if (similares.length > 0) {
      setSugerencia({ descripcion: movActual.descripcion, categoria, ids: similares.map((m) => m.id) })
    }
  }

  const aplicarSugerencia = async () => {
    if (!sugerencia) return
    setAplicandoSugerencia(true)
    try {
      await Promise.all(sugerencia.ids.map((id) => updateRow("movimientos_mp", id, { categoria: sugerencia.categoria })))
      try { await insertRow("reglas_categorias", { texto_original: sugerencia.descripcion, categoria: sugerencia.categoria }) } catch { /* regla ya existe */ }
      toast({ title: "Categoría aplicada", description: `${sugerencia.ids.length} movimientos "${sugerencia.descripcion}" → ${sugerencia.categoria}` })
      refreshMov()
    } finally {
      setAplicandoSugerencia(false)
      setSugerencia(null)
    }
  }

  // ── Eliminar movimiento ───────────────────────────────────────────────────────

  const eliminarMovimiento = async (id: string) => {
    await deleteRow("movimientos_mp", id)
    refreshMov()
  }

  // ── Verificar Cobros ──────────────────────────────────────────────────────────

  const { cobrosConMatch, cobrosSinMatch, mpSinCobro } = useMemo(() => {
    const cobrosMP = cobros.filter(esCobrosMP).filter((c) =>
      mesVerificar === "todos" || c.fecha.startsWith(mesVerificar)
    )
    const ingresosMp = movimientos.filter((m) =>
      m.tipo === "ingreso" &&
      m.categoria !== MP_CATEGORIA_NO_COBRO &&
      (mesVerificar === "todos" || m.fecha.startsWith(mesVerificar))
    )
    const mpUsados = new Set<string>()
    const cobrosConMatch: { cobro: Cobro; mov: MovimientoMP }[] = []
    const cobrosSinMatch: Cobro[] = []
    for (const cobro of cobrosMP) {
      const match = ingresosMp.find(
        (m) => !mpUsados.has(m.id) && Math.abs(m.monto - cobro.monto) <= 1 && diffDias(m.fecha, cobro.fecha) <= 3
      )
      if (match) { cobrosConMatch.push({ cobro, mov: match }); mpUsados.add(match.id) }
      else cobrosSinMatch.push(cobro)
    }
    const mpSinCobro = ingresosMp.filter((m) => !mpUsados.has(m.id))
    return { cobrosConMatch, cobrosSinMatch, mpSinCobro }
  }, [cobros, movimientos, mesVerificar])

  const mesesVerificarDisponibles = useMemo(() => {
    const set = new Set<string>()
    cobros.filter(esCobrosMP).forEach((c) => set.add(c.fecha.slice(0, 7)))
    movimientos.filter((m) => m.tipo === "ingreso").forEach((m) => set.add(m.fecha.slice(0, 7)))
    return [...set].sort().reverse()
  }, [cobros, movimientos])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Tabs defaultValue="movimientos">
        <TabsList>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="verificar">
            Verificar Cobros
            {cobrosSinMatch.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{cobrosSinMatch.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── TAB MOVIMIENTOS ── */}
        <TabsContent value="movimientos" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => pdfInputRef.current?.click()} disabled={importando} variant="outline">
              {importando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              {importando ? "Procesando PDF…" : "Importar Account Statement"}
            </Button>
            <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handleImportPDF} />

            <Select value={mesFiltro} onValueChange={setMesFiltro}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Mes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los meses</SelectItem>
                {mesesDisponibles.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ingreso">Ingresos</SelectItem>
                <SelectItem value="egreso">Egresos</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-sm text-muted-foreground ml-auto">{movimientosFiltrados.length} movimientos</span>
          </div>

          {/* Banner sugerencia */}
          {sugerencia && (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-3 text-sm">
              <Sparkles className="h-4 w-4 mt-0.5 text-yellow-600 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Se detectaron {sugerencia.ids.length} movimiento{sugerencia.ids.length !== 1 ? "s" : ""} similares sin categoría
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 mt-0.5">
                  &ldquo;{sugerencia.descripcion}&rdquo; → ¿Asignar <strong>{sugerencia.categoria}</strong> a todos?
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" className="h-7 text-xs border-yellow-400" onClick={() => setSugerencia(null)} disabled={aplicandoSugerencia}>No</Button>
                <Button size="sm" className="h-7 text-xs bg-yellow-500 hover:bg-yellow-600 text-white" onClick={aplicarSugerencia} disabled={aplicandoSugerencia}>
                  {aplicandoSugerencia ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sí, aplicar a todos"}
                </Button>
              </div>
            </div>
          )}

          {/* Tabla con cabeceras ordenables */}
          <div className="rounded-md border overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground text-xs">
                  <SortTh label="Fecha" field="fecha" current={sortField} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Descripción" field="descripcion" current={sortField} dir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2 text-right font-medium cursor-pointer select-none hover:text-foreground group" onClick={() => handleSort("monto")}>
                    <span className="flex items-center justify-end gap-1">
                      Monto
                      {sortField === "monto"
                        ? sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                        : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40" />}
                    </span>
                  </th>
                  <SortTh label="Categoría" field="categoria" current={sortField} dir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Sin movimientos. Importá el Account Statement de MercadoPago.</td></tr>
                )}
                {movimientosFiltrados.map((m) => (
                  <tr key={m.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(m.fecha)}</td>
                    <td className="px-3 py-2 max-w-xs">{m.descripcion}</td>
                    <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${m.tipo === "ingreso" ? "text-green-600" : "text-red-500"}`}>
                      {m.tipo === "egreso" ? "-" : "+"}{formatCurrency(m.monto)}
                    </td>
                    <td className="px-3 py-2">
                      {m.tipo === "egreso" ? (
                        editingId === m.id ? (
                          <div className="flex items-center gap-1">
                            <Select value={editCat} onValueChange={setEditCat}>
                              <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel className="text-xs">No es gasto operativo</SelectLabel>
                                  <SelectItem value={MP_EGRESO_NO_GASTO_LABEL}>{MP_EGRESO_NO_GASTO_LABEL}</SelectItem>
                                </SelectGroup>
                                <SelectSeparator />
                                <SelectGroup>
                                  <SelectLabel className="text-xs">Gastos operativos</SelectLabel>
                                  {categorias.map((c) => <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>)}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => guardarCategoria(m.id, editCat)}><Check className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => { setEditingId(m.id); setEditCat(m.categoria ?? "") }}>
                            {m.categoria
                              ? MP_CATEGORIAS_NO_GASTO.includes(m.categoria.toLowerCase().trim())
                                ? <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">{m.categoria}</Badge>
                                : <Badge variant="secondary" className="text-xs">{m.categoria}</Badge>
                              : <span className="italic">Sin categoría</span>
                            }
                            <Pencil className="h-3 w-3 opacity-50" />
                          </button>
                        )
                      ) : (
                        editingId === m.id ? (
                          <div className="flex items-center gap-1">
                            <Select value={editCat || "_cobro"} onValueChange={(v) => setEditCat(v === "_cobro" ? "" : v)}>
                              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_cobro">Cobro de cliente</SelectItem>
                                <SelectItem value={MP_CATEGORIA_NO_COBRO}>No es cobro</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                              await updateRow("movimientos_mp", m.id, { categoria: editCat || null })
                              setEditingId(null)
                              refreshMov()
                            }}><Check className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <button
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => { setEditingId(m.id); setEditCat(m.categoria ?? "") }}
                          >
                            {m.categoria === MP_CATEGORIA_NO_COBRO
                              ? <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">No es cobro</Badge>
                              : <span className="italic">Cobro</span>
                            }
                            <Pencil className="h-3 w-3 opacity-50" />
                          </button>
                        )
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => eliminarMovimiento(m.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── TAB VERIFICAR COBROS ── */}
        <TabsContent value="verificar" className="space-y-4">

          {/* Toolbar + resumen */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={mesVerificar} onValueChange={setMesVerificar}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Mes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los meses</SelectItem>
                {mesesVerificarDisponibles.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Cobros como <strong>transferencia a Francisco Guglielmotti</strong> vs ingresos del Account Statement.
            </p>
          </div>

          {/* Cards resumen */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 px-4 py-3">
              <p className="text-xs text-green-700 dark:text-green-300 font-medium">Verificados</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">{cobrosConMatch.length}</p>
              <p className="text-xs text-green-600 dark:text-green-400">{formatCurrency(totalMonto(cobrosConMatch.map(({ cobro }) => cobro)))}</p>
            </div>
            <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 px-4 py-3">
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">Sin match en MP</p>
              <p className="text-xl font-bold text-red-700 dark:text-red-300">{cobrosSinMatch.length}</p>
              <p className="text-xs text-red-600 dark:text-red-400">{formatCurrency(totalMonto(cobrosSinMatch))}</p>
            </div>
            <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/20 px-4 py-3">
              <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">MP sin cobro</p>
              <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">{mpSinCobro.length}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">{formatCurrency(totalMonto(mpSinCobro))}</p>
            </div>
          </div>

          {cobros.filter(esCobrosMP).length === 0 && movimientos.filter((m) => m.tipo === "ingreso").length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Importá el Account Statement y asegurate de tener cobros registrados como transferencia a Francisco Guglielmotti.
            </p>
          )}

          {/* ── Acordeón: Verificados ── */}
          {cobrosConMatch.length > 0 && (
            <div className="space-y-2">
              <AccordionHeader
                open={abierto.verificados} onToggle={() => toggleAcordeon("verificados")}
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Verificados" count={cobrosConMatch.length}
                total={totalMonto(cobrosConMatch.map(({ cobro }) => cobro))}
                color="text-green-600"
              />
              {abierto.verificados && (
                <div className="rounded-md border overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">Fecha cobro</th>
                        <th className="px-3 py-2 text-left font-medium">Cliente</th>
                        <th className="px-3 py-2 text-right font-medium">Monto</th>
                        <th className="px-3 py-2 text-left font-medium">Fecha MP</th>
                        <th className="px-3 py-2 text-left font-medium">Descripción MP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cobrosConMatch.map(({ cobro, mov }) => (
                        <tr key={cobro.id} className="border-b hover:bg-muted/30">
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(cobro.fecha)}</td>
                          <td className="px-3 py-2">{cobro.cliente_nombre}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(cobro.monto)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(mov.fecha)}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{mov.descripcion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Acordeón: Sin match en MP ── */}
          {cobrosSinMatch.length > 0 && (
            <div className="space-y-2">
              <AccordionHeader
                open={abierto.sinMatch} onToggle={() => toggleAcordeon("sinMatch")}
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Cobros sin match en MP" count={cobrosSinMatch.length}
                total={totalMonto(cobrosSinMatch)}
                color="text-red-500"
              />
              {abierto.sinMatch && (
                <>
                  <p className="text-xs text-muted-foreground pl-6">
                    Registrados en el sistema pero no aparecen en el Account Statement (diferencia de monto o fecha &gt; tolerancia).
                  </p>
                  <div className="rounded-md border overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                          <th className="px-3 py-2 text-left font-medium">Fecha</th>
                          <th className="px-3 py-2 text-left font-medium">Cliente</th>
                          <th className="px-3 py-2 text-right font-medium">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cobrosSinMatch.map((c) => (
                          <tr key={c.id} className="border-b hover:bg-muted/30">
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(c.fecha)}</td>
                            <td className="px-3 py-2">{c.cliente_nombre}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(c.monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Acordeón: MP sin cobro ── */}
          {mpSinCobro.length > 0 && (
            <div className="space-y-2">
              <AccordionHeader
                open={abierto.mpSinCobro} onToggle={() => toggleAcordeon("mpSinCobro")}
                icon={<HelpCircle className="h-4 w-4" />}
                label="Ingresos MP sin cobro registrado" count={mpSinCobro.length}
                total={totalMonto(mpSinCobro)}
                color="text-yellow-600"
              />
              {abierto.mpSinCobro && (
                <>
                  <p className="text-xs text-muted-foreground pl-6">
                    Aparecen en el Account Statement de MP pero no tienen un cobro registrado en el sistema.
                  </p>
                  <div className="rounded-md border overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                          <th className="px-3 py-2 text-left font-medium">Fecha</th>
                          <th className="px-3 py-2 text-left font-medium">Descripción</th>
                          <th className="px-3 py-2 text-right font-medium">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mpSinCobro.map((m) => (
                          <tr key={m.id} className="border-b hover:bg-muted/30">
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDate(m.fecha)}</td>
                            <td className="px-3 py-2">{m.descripcion}</td>
                            <td className="px-3 py-2 text-right font-medium text-green-600">{formatCurrency(m.monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
