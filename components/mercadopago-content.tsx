"use client"

import { useState, useRef, useMemo } from "react"
import { FileUp, Loader2, CheckCircle2, AlertTriangle, HelpCircle, Trash2, Pencil, Check, X, ChevronDown, ChevronRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSupabase, updateRow, deleteRow, insertRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

// ── Tipos ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

interface CategoriaGasto {
  id: string
  nombre: string
}

// Diferencia en días entre dos strings "YYYY-MM-DD"
function diffDias(a: string, b: string) {
  const toMs = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number)
    return new Date(y, m - 1, d).getTime()
  }
  return Math.abs(toMs(a) - toMs(b)) / 86_400_000
}

// Detecta si un cobro es transferencia a Francisco Guglielmotti
function esCobrosMP(c: Cobro) {
  const metodo = (c.metodo_pago ?? "").toLowerCase()
  const destino = (c.cuenta_destino ?? "").toLowerCase()
  return metodo === "transferencia" && destino.includes("guglielmotti")
}

// ── Componente ───────────────────────────────────────────────────────────────

export function MercadoPagoContent() {
  const { toast } = useToast()
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [importando, setImportando] = useState(false)

  // Datos de Supabase
  const { data: movimientos = [], mutate: refreshMov } = useSupabase<MovimientoMP>("movimientos_mp")
  const { data: cobros = [] } = useSupabase<Cobro>("cobros")
  const { data: categorias = [] } = useSupabase<CategoriaGasto>("categorias_gastos")

  // Filtros tab Movimientos
  const [mesFiltro, setMesFiltro] = useState<string>("todos")
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos")

  // Acordeón verificados
  const [verificadosAbierto, setVerificadosAbierto] = useState(false)

  // Edición de categoría inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCat, setEditCat] = useState<string>("")

  // Sugerencia de clasificación masiva
  const [sugerencia, setSugerencia] = useState<{
    descripcion: string
    categoria: string
    ids: string[]
  } | null>(null)
  const [aplicandoSugerencia, setAplicandoSugerencia] = useState(false)

  // ── Importar PDF ────────────────────────────────────────────────────────────

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
      toast({
        title: "Error al importar",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      })
    } finally {
      setImportando(false)
    }
  }

  // ── Movimientos filtrados ───────────────────────────────────────────────────

  const mesesDisponibles = useMemo(() => {
    const set = new Set<string>()
    movimientos.forEach((m) => set.add(m.fecha.slice(0, 7)))
    return [...set].sort().reverse()
  }, [movimientos])

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      if (mesFiltro !== "todos" && !m.fecha.startsWith(mesFiltro)) return false
      if (tipoFiltro !== "todos" && m.tipo !== tipoFiltro) return false
      return true
    })
  }, [movimientos, mesFiltro, tipoFiltro])

  // ── Guardar categoría ──────────────────────────────────────────────────────

  const guardarCategoria = async (id: string, categoria: string) => {
    await updateRow("movimientos_mp", id, { categoria })
    setEditingId(null)
    refreshMov()

    // Detectar movimientos similares sin categoría
    const movActual = movimientos.find((m) => m.id === id)
    if (!movActual?.descripcion) return

    const desc = movActual.descripcion.trim().toLowerCase()
    const similares = movimientos.filter(
      (m) =>
        m.id !== id &&
        m.tipo === "egreso" &&
        !m.categoria &&
        m.descripcion?.trim().toLowerCase() === desc
    )

    if (similares.length > 0) {
      setSugerencia({
        descripcion: movActual.descripcion,
        categoria,
        ids: similares.map((m) => m.id),
      })
    }
  }

  // ── Aplicar sugerencia masiva ───────────────────────────────────────────────

  const aplicarSugerencia = async () => {
    if (!sugerencia) return
    setAplicandoSugerencia(true)
    try {
      await Promise.all(
        sugerencia.ids.map((id) =>
          updateRow("movimientos_mp", id, { categoria: sugerencia.categoria })
        )
      )
      // Guardar regla para futuros imports
      try {
        await insertRow("reglas_categorias", {
          texto_original: sugerencia.descripcion,
          categoria: sugerencia.categoria,
        })
      } catch { /* si ya existe la regla, ignorar */ }

      toast({
        title: "Categoría aplicada",
        description: `${sugerencia.ids.length} movimientos "${sugerencia.descripcion}" → ${sugerencia.categoria}`,
      })
      refreshMov()
    } finally {
      setAplicandoSugerencia(false)
      setSugerencia(null)
    }
  }

  // ── Eliminar movimiento ────────────────────────────────────────────────────

  const eliminarMovimiento = async (id: string) => {
    await deleteRow("movimientos_mp", id)
    refreshMov()
  }

  // ── Verificar Cobros: cruce ─────────────────────────────────────────────────

  const { cobrosConMatch, cobrosSinMatch, mpSinCobro } = useMemo(() => {
    // Cobros que son transferencias a Francisco Guglielmotti
    const cobrosMP = cobros.filter(esCobrosMP)
    // Ingresos importados desde el PDF
    const ingresosMp = movimientos.filter((m) => m.tipo === "ingreso")

    const mpUsados = new Set<string>()
    const cobrosConMatch: { cobro: Cobro; mov: MovimientoMP }[] = []
    const cobrosSinMatch: Cobro[] = []

    for (const cobro of cobrosMP) {
      // Buscar ingreso en MP con mismo monto (tolerancia $1) y fecha cercana (±3 días)
      const match = ingresosMp.find(
        (m) =>
          !mpUsados.has(m.id) &&
          Math.abs(m.monto - cobro.monto) <= 1 &&
          diffDias(m.fecha, cobro.fecha) <= 3
      )
      if (match) {
        cobrosConMatch.push({ cobro, mov: match })
        mpUsados.add(match.id)
      } else {
        cobrosSinMatch.push(cobro)
      }
    }

    const mpSinCobro = ingresosMp.filter((m) => !mpUsados.has(m.id))

    return { cobrosConMatch, cobrosSinMatch, mpSinCobro }
  }, [cobros, movimientos])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Tabs defaultValue="movimientos">
        <TabsList>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="verificar">
            Verificar Cobros
            {cobrosSinMatch.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {cobrosSinMatch.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── TAB MOVIMIENTOS ── */}
        <TabsContent value="movimientos" className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => pdfInputRef.current?.click()} disabled={importando} variant="outline">
              {importando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              {importando ? "Procesando PDF…" : "Importar Account Statement"}
            </Button>
            <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handleImportPDF} />

            <Select value={mesFiltro} onValueChange={setMesFiltro}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los meses</SelectItem>
                {mesesDisponibles.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ingreso">Ingresos</SelectItem>
                <SelectItem value="egreso">Egresos</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-sm text-muted-foreground ml-auto">
              {movimientosFiltrados.length} movimientos
            </span>
          </div>

          {/* Banner sugerencia clasificación masiva */}
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
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-yellow-400"
                  onClick={() => setSugerencia(null)}
                  disabled={aplicandoSugerencia}
                >
                  No
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-yellow-500 hover:bg-yellow-600 text-white"
                  onClick={aplicarSugerencia}
                  disabled={aplicandoSugerencia}
                >
                  {aplicandoSugerencia ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sí, aplicar a todos"}
                </Button>
              </div>
            </div>
          )}

          {/* Tabla */}
          <div className="rounded-md border overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Fecha</th>
                  <th className="px-3 py-2 text-left font-medium">Descripción</th>
                  <th className="px-3 py-2 text-right font-medium">Monto</th>
                  <th className="px-3 py-2 text-left font-medium">Categoría</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      Sin movimientos. Importá el Account Statement de MercadoPago.
                    </td>
                  </tr>
                )}
                {movimientosFiltrados.map((m) => (
                  <tr key={m.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatDate(m.fecha)}
                    </td>
                    <td className="px-3 py-2 max-w-xs">{m.descripcion}</td>
                    <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${m.tipo === "ingreso" ? "text-green-600" : "text-red-500"}`}>
                      {m.tipo === "egreso" ? "-" : "+"}{formatCurrency(m.monto)}
                    </td>
                    <td className="px-3 py-2">
                      {m.tipo === "egreso" ? (
                        editingId === m.id ? (
                          <div className="flex items-center gap-1">
                            <Select value={editCat} onValueChange={setEditCat}>
                              <SelectTrigger className="h-7 w-36 text-xs">
                                <SelectValue placeholder="Categoría" />
                              </SelectTrigger>
                              <SelectContent>
                                {categorias.map((c) => (
                                  <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => guardarCategoria(m.id, editCat)}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => { setEditingId(m.id); setEditCat(m.categoria ?? "") }}
                          >
                            {m.categoria ? (
                              <Badge variant="secondary" className="text-xs">{m.categoria}</Badge>
                            ) : (
                              <span className="italic">Sin categoría</span>
                            )}
                            <Pencil className="h-3 w-3 opacity-50" />
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        onClick={() => eliminarMovimiento(m.id)}
                      >
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
        <TabsContent value="verificar" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Cruza los cobros registrados como <strong>transferencia a Francisco Guglielmotti</strong> contra los ingresos importados del Account Statement de MP.
          </p>

          {/* Cobros con match — acordeón colapsado por defecto */}
          {cobrosConMatch.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setVerificadosAbierto((v) => !v)}
                className="flex items-center gap-2 text-green-600 font-medium hover:opacity-80 transition-opacity w-full text-left"
              >
                {verificadosAbierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CheckCircle2 className="h-4 w-4" />
                <span>Verificados ({cobrosConMatch.length})</span>
              </button>
              {verificadosAbierto && (
                <div className="rounded-md border overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
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

          {/* Cobros sin match en MP */}
          {cobrosSinMatch.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-500 font-medium">
                <AlertTriangle className="h-4 w-4" />
                <span>Cobros sin match en MP ({cobrosSinMatch.length})</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Estos cobros están registrados en el sistema pero no aparecen en el Account Statement de MP (o la diferencia de monto/fecha es mayor a la tolerancia).
              </p>
              <div className="rounded-md border overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
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
            </div>
          )}

          {/* Ingresos MP sin cobro en sistema */}
          {mpSinCobro.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-yellow-600 font-medium">
                <HelpCircle className="h-4 w-4" />
                <span>Ingresos MP sin cobro registrado ({mpSinCobro.length})</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Estos ingresos aparecen en MP pero no tienen un cobro correspondiente en el sistema.
              </p>
              <div className="rounded-md border overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
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
            </div>
          )}

          {cobros.filter(esCobrosMP).length === 0 && movimientos.filter((m) => m.tipo === "ingreso").length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Importá el Account Statement y asegurate de tener cobros registrados como transferencia a Francisco Guglielmotti.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
