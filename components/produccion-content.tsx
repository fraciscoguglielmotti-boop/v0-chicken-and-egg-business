"use client"

import { useState, useMemo } from "react"
import { Factory, Calculator, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSupabase, insertRow, deleteRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface LoteProduccion {
  id: string
  fecha: string
  producto_origen: string
  cajones: number
  cajones_a?: number
  cajones_b?: number
  costo_por_cajon: number
  costo_total: number
  costo_trozador?: number
  observaciones?: string
}

interface LoteCorte {
  id: string
  lote_id: string
  corte: string
  peso_kg: number
  precio_venta_kg?: number
}

interface Compra {
  fecha: string
  producto: string
  cantidad: number
  precio_unitario: number
  total: number
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CORTES = ["Suprema", "Pata Muslo", "Alitas", "Menudos", "Carcasa", "Descarte"] as const
const CORTES_VENDIBLES = CORTES.filter(c => c !== "Descarte")

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Precio unitario de la última compra del producto */
function getCostoUltima(compras: Compra[], producto: string): number {
  const norm = (s: string) => s.toLowerCase().trim()
  const filtradas = compras
    .filter(c => norm(c.producto) === norm(producto) && c.cantidad > 0)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  if (filtradas.length === 0) return 0
  const u = filtradas[0]
  return u.precio_unitario > 0
    ? u.precio_unitario
    : u.total > 0 && u.cantidad > 0 ? u.total / u.cantidad : 0
}

type CorteValues = { peso_kg: string; precio_kg: string }
const emptyCortes = (): Record<string, CorteValues> =>
  Object.fromEntries(CORTES.map(c => [c, { peso_kg: "", precio_kg: "" }]))

function calcMetricas(cortesMap: Record<string, CorteValues>, costoTotal: number) {
  const totalKg = CORTES.reduce((s, c) => s + (parseFloat(cortesMap[c].peso_kg) || 0), 0)
  const kgVendible = CORTES_VENDIBLES.reduce((s, c) => s + (parseFloat(cortesMap[c].peso_kg) || 0), 0)
  const ingresoTotal = CORTES_VENDIBLES.reduce((s, c) =>
    s + (parseFloat(cortesMap[c].peso_kg) || 0) * (parseFloat(cortesMap[c].precio_kg) || 0), 0)
  const costoKg = kgVendible > 0 ? costoTotal / kgVendible : 0
  const ganancia = ingresoTotal - costoTotal
  const margen = ingresoTotal > 0 ? (ganancia / ingresoTotal) * 100 : 0
  return { totalKg, kgVendible, ingresoTotal, costoKg, ganancia, margen }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ProduccionContent() {
  const { data: lotes = [], mutate: mutateLotes } = useSupabase<LoteProduccion>("lotes_produccion")
  const { data: cortes = [], mutate: mutateCortes } = useSupabase<LoteCorte>("lote_cortes")
  const { data: compras = [] } = useSupabase<Compra>("compras")
  const { toast } = useToast()

  const costoA = useMemo(() => getCostoUltima(compras, "Pollo A"), [compras])
  const costoB = useMemo(() => getCostoUltima(compras, "Pollo B"), [compras])

  // ── Nuevo lote ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    cajones_a: "",
    cajones_b: "",
    costo_trozador: "",
    observaciones: "",
  })
  const [cortesForm, setCortesForm] = useState<Record<string, CorteValues>>(emptyCortes())

  const cajonesA = parseFloat(form.cajones_a) || 0
  const cajonesB = parseFloat(form.cajones_b) || 0
  const costoTrozador = parseFloat(form.costo_trozador) || 0
  const costoPollo = cajonesA * costoA + cajonesB * costoB
  const costoTotal = costoPollo + costoTrozador
  const cajonesTotal = cajonesA + cajonesB
  const metricas = useMemo(() => calcMetricas(cortesForm, costoTotal), [cortesForm, costoTotal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cajonesTotal <= 0) return
    const partes: string[] = []
    if (cajonesA > 0) partes.push(`Pollo A (${cajonesA})`)
    if (cajonesB > 0) partes.push(`Pollo B (${cajonesB})`)
    const producto_origen = partes.join(" + ")
    try {
      const lote = await insertRow("lotes_produccion", {
        fecha: form.fecha,
        producto_origen,
        cajones: cajonesTotal,
        cajones_a: cajonesA,
        cajones_b: cajonesB,
        costo_por_cajon: cajonesTotal > 0 ? costoPollo / cajonesTotal : 0,
        costo_total: costoTotal,
        costo_trozador: costoTrozador || null,
        observaciones: form.observaciones || null,
      }) as LoteProduccion

      const cortesValidos = CORTES.filter(c => parseFloat(cortesForm[c].peso_kg) > 0)
      await Promise.all(cortesValidos.map(c =>
        insertRow("lote_cortes", {
          lote_id: lote.id,
          corte: c,
          peso_kg: parseFloat(cortesForm[c].peso_kg),
          precio_venta_kg: c !== "Descarte" ? (parseFloat(cortesForm[c].precio_kg) || null) : null,
        })
      ))

      await mutateLotes()
      await mutateCortes()
      setForm({ fecha: new Date().toISOString().split("T")[0], cajones_a: "", cajones_b: "", costo_trozador: "", observaciones: "" })
      setCortesForm(emptyCortes())
      toast({ title: "Lote registrado", description: `${cajonesTotal} cajones — ${metricas.totalKg.toFixed(1)} kg total` })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleDeleteLote = async (lote: LoteProduccion) => {
    if (!confirm(`¿Eliminar lote de ${lote.cajones} cajones del ${formatDate(new Date(lote.fecha))}?`)) return
    try {
      await deleteRow("lotes_produccion", lote.id)
      await mutateLotes()
      await mutateCortes()
      toast({ title: "Lote eliminado" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  // ── Lotes enriquecidos ──────────────────────────────────────────────────────
  const lotesConCortes = useMemo(() => {
    return [...lotes]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map(l => {
        const cortesList = cortes.filter(c => c.lote_id === l.id)
        const totalKg = cortesList.reduce((s, c) => s + Number(c.peso_kg), 0)
        const kgVendible = cortesList.filter(c => c.corte !== "Descarte").reduce((s, c) => s + Number(c.peso_kg), 0)
        const ingresoEst = cortesList
          .filter(c => c.corte !== "Descarte")
          .reduce((s, c) => s + Number(c.peso_kg) * (Number(c.precio_venta_kg) || 0), 0)
        const costoKg = kgVendible > 0 ? l.costo_total / kgVendible : 0
        const gananciaEst = ingresoEst > 0 ? ingresoEst - l.costo_total : null
        const margenEst = ingresoEst > 0 ? (gananciaEst! / ingresoEst) * 100 : null
        return { ...l, cortesList, totalKg, kgVendible, ingresoEst, gananciaEst, margenEst, costoKg }
      })
  }, [lotes, cortes])

  // ── Simulador ──────────────────────────────────────────────────────────────
  const [simCajonesA, setSimCajonesA] = useState("")
  const [simCajonesB, setSimCajonesB] = useState("")
  const [simCostoTrozador, setSimCostoTrozador] = useState("")
  const [simCortes, setSimCortes] = useState<Record<string, CorteValues>>(emptyCortes())

  const simCostoTotal =
    (parseFloat(simCajonesA) || 0) * costoA +
    (parseFloat(simCajonesB) || 0) * costoB +
    (parseFloat(simCostoTrozador) || 0)
  const simMetricas = useMemo(() => calcMetricas(simCortes, simCostoTotal), [simCortes, simCostoTotal])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="historial">
        <TabsList>
          <TabsTrigger value="historial">
            Historial
            {lotesConCortes.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({lotesConCortes.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="nuevo">Nuevo Lote</TabsTrigger>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
        </TabsList>

        {/* ── HISTORIAL ─────────────────────────────────────────────────────── */}
        <TabsContent value="historial" className="space-y-3 mt-4">
          {lotesConCortes.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Factory className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">No hay lotes registrados</p>
              <p className="text-xs text-muted-foreground mt-1">Usá "Nuevo Lote" para registrar tu primer troceo</p>
            </div>
          ) : lotesConCortes.map(lote => (
            <Card key={lote.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-semibold">{lote.producto_origen}</span>
                    <Badge variant="outline" className="text-xs font-mono">{lote.cajones} cajones</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(new Date(lote.fecha))}</span>
                    {lote.margenEst !== null && (
                      <Badge
                        variant={lote.margenEst >= 20 ? "default" : lote.margenEst >= 10 ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {lote.margenEst.toFixed(1)}% margen
                      </Badge>
                    )}
                  </div>

                  {/* Métricas rápidas */}
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm mb-3">
                    <span className="text-muted-foreground">
                      Costo: <span className="font-medium text-orange-600">{formatCurrency(lote.costo_total)}</span>
                      {lote.costo_trozador ? <span className="text-xs"> (incl. trozador {formatCurrency(lote.costo_trozador)})</span> : null}
                    </span>
                    {lote.totalKg > 0 && (
                      <>
                        <span className="text-muted-foreground">Output: <span className="font-medium">{lote.totalKg.toFixed(1)} kg</span></span>
                        {lote.kgVendible < lote.totalKg && (
                          <span className="text-muted-foreground">Vendible: <span className="font-medium">{lote.kgVendible.toFixed(1)} kg</span></span>
                        )}
                        <span className="text-muted-foreground">Costo/kg: <span className="font-medium">{formatCurrency(lote.costoKg)}</span></span>
                      </>
                    )}
                    {lote.ingresoEst > 0 && (
                      <>
                        <span className="text-muted-foreground">Ingreso est.: <span className="font-medium text-green-600">{formatCurrency(lote.ingresoEst)}</span></span>
                        <span className="text-muted-foreground">Ganancia: <span className={`font-medium ${lote.gananciaEst! >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(lote.gananciaEst!)}</span></span>
                      </>
                    )}
                  </div>

                  {/* Cortes */}
                  {lote.cortesList.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {lote.cortesList.map(c => {
                        const esDescarte = c.corte === "Descarte"
                        return (
                          <div
                            key={c.id}
                            className={`rounded-lg border px-3 py-2 ${esDescarte ? "bg-muted/20 border-dashed opacity-70" : "bg-muted/40"}`}
                          >
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{c.corte}</p>
                            <p className="text-sm font-bold mt-0.5">{Number(c.peso_kg).toFixed(1)} kg</p>
                            {lote.totalKg > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {((Number(c.peso_kg) / lote.totalKg) * 100).toFixed(1)}% rend.
                              </p>
                            )}
                            {!esDescarte && c.precio_venta_kg && (
                              <p className="text-xs text-green-600 mt-0.5">{formatCurrency(Number(c.precio_venta_kg))}/kg</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {lote.observaciones && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{lote.observaciones}</p>
                  )}
                </div>

                <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive h-8 w-8"
                  onClick={() => handleDeleteLote(lote)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* ── NUEVO LOTE ────────────────────────────────────────────────────── */}
        <TabsContent value="nuevo" className="mt-4">
          <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">

            {/* Datos del lote */}
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold text-base">Datos del lote</h3>

              {/* Fecha */}
              <div className="max-w-[200px]">
                <Label>Fecha</Label>
                <Input type="date" value={form.fecha} max={new Date().toISOString().split("T")[0]}
                  onChange={e => setForm({ ...form, fecha: e.target.value })} required />
              </div>

              {/* Pollo A */}
              <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                <p className="text-sm font-medium">Pollo A</p>
                <div className="flex items-center gap-3">
                  <div className="w-36">
                    <Label className="text-xs">Cajones</Label>
                    <Input type="number" min="0" step="1" placeholder="0"
                      value={form.cajones_a}
                      onChange={e => setForm({ ...form, cajones_a: e.target.value })} />
                  </div>
                  {costoA > 0 && (
                    <div className="text-xs text-muted-foreground mt-4">
                      {formatCurrency(costoA)}/cajón (última compra)
                      {cajonesA > 0 && <span className="ml-2 font-semibold text-orange-600">= {formatCurrency(cajonesA * costoA)}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Pollo B */}
              <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
                <p className="text-sm font-medium">Pollo B <span className="text-xs text-muted-foreground font-normal">(opcional)</span></p>
                <div className="flex items-center gap-3">
                  <div className="w-36">
                    <Label className="text-xs">Cajones</Label>
                    <Input type="number" min="0" step="1" placeholder="0"
                      value={form.cajones_b}
                      onChange={e => setForm({ ...form, cajones_b: e.target.value })} />
                  </div>
                  {costoB > 0 && (
                    <div className="text-xs text-muted-foreground mt-4">
                      {formatCurrency(costoB)}/cajón (última compra)
                      {cajonesB > 0 && <span className="ml-2 font-semibold text-orange-600">= {formatCurrency(cajonesB * costoB)}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Costo trozador */}
              <div className="flex items-center gap-3">
                <div className="w-48">
                  <Label>Costo trozador <span className="text-xs text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input type="number" min="0" step="0.01" placeholder="$0"
                    value={form.costo_trozador}
                    onChange={e => setForm({ ...form, costo_trozador: e.target.value })} />
                </div>
              </div>

              {/* Total */}
              {cajonesTotal > 0 && (
                <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-800/60 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Costo total del lote</p>
                    <p className="font-bold text-orange-600 text-xl">{formatCurrency(costoTotal)}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-0.5">
                    <p>{cajonesTotal} cajones en total</p>
                    {costoTrozador > 0 && <p>Trozador: {formatCurrency(costoTrozador)}</p>}
                  </div>
                </div>
              )}

              <div>
                <Label>Observaciones (opcional)</Label>
                <Input placeholder="Ej: Buena calidad, lote mañana" value={form.observaciones}
                  onChange={e => setForm({ ...form, observaciones: e.target.value })} />
              </div>
            </Card>

            {/* Cortes */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">Rendimiento por corte</h3>
                <div className="text-right">
                  <span className="text-sm font-semibold">{metricas.totalKg.toFixed(1)} kg total</span>
                  {metricas.kgVendible < metricas.totalKg && metricas.totalKg > 0 && (
                    <p className="text-xs text-muted-foreground">{metricas.kgVendible.toFixed(1)} kg vendible</p>
                  )}
                  {metricas.kgVendible > 0 && costoTotal > 0 && (
                    <p className="text-xs text-muted-foreground">Costo/kg vendible: {formatCurrency(metricas.costoKg)}</p>
                  )}
                </div>
              </div>

              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-0.5">
                <span className="col-span-3">Corte</span>
                <span className="col-span-4">Kg obtenidos</span>
                <span className="col-span-2 text-center">% rend.</span>
                <span className="col-span-3">$/kg venta</span>
              </div>

              {CORTES.map(corte => {
                const esDescarte = corte === "Descarte"
                const kg = parseFloat(cortesForm[corte].peso_kg) || 0
                const pct = metricas.totalKg > 0 ? (kg / metricas.totalKg * 100).toFixed(1) : "—"
                const ingresoEste = esDescarte ? 0 : kg * (parseFloat(cortesForm[corte].precio_kg) || 0)
                return (
                  <div key={corte} className={`grid grid-cols-12 gap-2 items-center ${esDescarte ? "opacity-60" : ""}`}>
                    <div className="col-span-3">
                      <span className="font-medium text-sm">{corte}</span>
                      {esDescarte && <p className="text-xs text-muted-foreground">sin valor</p>}
                    </div>
                    <div className="col-span-4">
                      <Input type="number" step="0.01" min="0" placeholder="0"
                        value={cortesForm[corte].peso_kg}
                        onChange={e => setCortesForm({ ...cortesForm, [corte]: { ...cortesForm[corte], peso_kg: e.target.value } })}
                      />
                    </div>
                    <div className="col-span-2 text-center text-xs font-mono text-muted-foreground">{pct}%</div>
                    <div className="col-span-3">
                      {esDescarte ? (
                        <span className="text-xs text-muted-foreground italic px-1">—</span>
                      ) : (
                        <div>
                          <Input type="number" step="0.01" min="0" placeholder="opcional"
                            value={cortesForm[corte].precio_kg}
                            onChange={e => setCortesForm({ ...cortesForm, [corte]: { ...cortesForm[corte], precio_kg: e.target.value } })}
                          />
                          {ingresoEste > 0 && (
                            <p className="text-xs text-green-600 mt-0.5 text-right">{formatCurrency(ingresoEste)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </Card>

            {/* Resumen total */}
            {(costoTotal > 0 || metricas.ingresoTotal > 0) && (
              <Card className="p-5">
                <h3 className="font-semibold text-base mb-3">Resultado estimado del lote</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Costo total</p>
                    <p className="font-bold text-orange-600 text-lg">{formatCurrency(costoTotal)}</p>
                  </div>
                  {metricas.ingresoTotal > 0 ? (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Ingreso estimado</p>
                        <p className="font-bold text-green-600 text-lg">{formatCurrency(metricas.ingresoTotal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Ganancia</p>
                        <p className={`font-bold text-lg ${metricas.ganancia >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(metricas.ganancia)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Margen</p>
                        <Badge
                          variant={metricas.margen >= 20 ? "default" : metricas.margen >= 10 ? "secondary" : "destructive"}
                          className="text-base px-3 py-1"
                        >
                          {metricas.margen.toFixed(1)}%
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <p className="col-span-3 text-sm text-muted-foreground self-center">
                      Cargá precios de venta opcionales para ver la ganancia estimada
                    </p>
                  )}
                </div>
              </Card>
            )}

            <Button type="submit" size="lg" disabled={cajonesTotal <= 0}>
              <Factory className="mr-2 h-4 w-4" />
              Registrar lote
            </Button>
          </form>
        </TabsContent>

        {/* ── SIMULADOR ─────────────────────────────────────────────────────── */}
        <TabsContent value="simulador" className="mt-4">
          <div className="space-y-5 max-w-2xl">
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Simulador de precios</h3>
              </div>
              <p className="text-xs text-muted-foreground">No guarda datos. Jugá con kg y precios para encontrar el punto óptimo.</p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Cajones Pollo A</Label>
                  <Input type="number" min="0" step="1" placeholder="0"
                    value={simCajonesA} onChange={e => setSimCajonesA(e.target.value)} />
                  {costoA > 0 && <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(costoA)}/caj.</p>}
                </div>
                <div>
                  <Label className="text-xs">Cajones Pollo B</Label>
                  <Input type="number" min="0" step="1" placeholder="0"
                    value={simCajonesB} onChange={e => setSimCajonesB(e.target.value)} />
                  {costoB > 0 && <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(costoB)}/caj.</p>}
                </div>
                <div>
                  <Label className="text-xs">Costo trozador</Label>
                  <Input type="number" min="0" step="0.01" placeholder="$0"
                    value={simCostoTrozador} onChange={e => setSimCostoTrozador(e.target.value)} />
                </div>
              </div>

              {simCostoTotal > 0 && (
                <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200/60 px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Costo total estimado</p>
                    <p className="font-bold text-orange-600">{formatCurrency(simCostoTotal)}</p>
                  </div>
                  {simMetricas.kgVendible > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Costo/kg vendible</p>
                      <p className="font-medium text-sm">{formatCurrency(simMetricas.costoKg)}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">Cortes</h3>
                {simMetricas.totalKg > 0 && (
                  <div className="text-right">
                    <span className="text-sm font-semibold">{simMetricas.totalKg.toFixed(1)} kg</span>
                    {simMetricas.kgVendible < simMetricas.totalKg && (
                      <p className="text-xs text-muted-foreground">{simMetricas.kgVendible.toFixed(1)} kg vendible</p>
                    )}
                  </div>
                )}
              </div>

              {CORTES.map(corte => {
                const esDescarte = corte === "Descarte"
                const kg = parseFloat(simCortes[corte].peso_kg) || 0
                const precio = parseFloat(simCortes[corte].precio_kg) || 0
                const pct = simMetricas.totalKg > 0 ? (kg / simMetricas.totalKg * 100).toFixed(1) : null
                const ingresoEste = esDescarte ? 0 : kg * precio
                return (
                  <div key={corte} className={`rounded-lg border p-3 space-y-2 transition-colors ${esDescarte ? "opacity-60 border-dashed" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{corte}</span>
                      {esDescarte && <span className="text-xs text-muted-foreground italic">descarte sin valor</span>}
                    </div>
                    <div className={`grid gap-2 ${esDescarte ? "grid-cols-1 max-w-[150px]" : "grid-cols-2"}`}>
                      <div>
                        <Label className="text-xs">Kg</Label>
                        <Input type="number" step="0.01" min="0" placeholder="0"
                          value={simCortes[corte].peso_kg}
                          onChange={e => setSimCortes({ ...simCortes, [corte]: { ...simCortes[corte], peso_kg: e.target.value } })}
                        />
                      </div>
                      {!esDescarte && (
                        <div>
                          <Label className="text-xs">$/kg</Label>
                          <Input type="number" step="0.01" min="0" placeholder="0"
                            value={simCortes[corte].precio_kg}
                            onChange={e => setSimCortes({ ...simCortes, [corte]: { ...simCortes[corte], precio_kg: e.target.value } })}
                          />
                        </div>
                      )}
                    </div>
                    {kg > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {pct && <span>{pct}% del total</span>}
                        {!esDescarte && ingresoEste > 0 && <span>Ingreso: <span className="text-green-600">{formatCurrency(ingresoEste)}</span></span>}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Resultado total */}
              {simMetricas.ingresoTotal > 0 && (
                <div className={`rounded-xl p-4 mt-3 ${simMetricas.ganancia >= 0 ? "bg-green-50 dark:bg-green-950/20 border border-green-200/60" : "bg-red-50 dark:bg-red-950/20 border border-red-200/60"}`}>
                  <h4 className="font-semibold text-sm mb-3">Resultado del lote simulado</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Costo</p>
                      <p className="font-bold text-orange-600">{formatCurrency(simCostoTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ingreso</p>
                      <p className="font-bold text-green-600">{formatCurrency(simMetricas.ingresoTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ganancia</p>
                      <p className={`font-bold ${simMetricas.ganancia >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(simMetricas.ganancia)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Margen</p>
                      <Badge
                        variant={simMetricas.margen >= 20 ? "default" : simMetricas.margen >= 10 ? "secondary" : "destructive"}
                        className="text-lg px-3 py-1"
                      >
                        {simMetricas.margen.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
