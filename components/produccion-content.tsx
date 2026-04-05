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
  costo_por_cajon: number
  costo_total: number
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

const CORTES = ["Suprema", "Pata Muslo", "Alitas", "Menudos", "Carcasa"] as const
const PRODUCTOS_ORIGEN = ["Pollo A", "Pollo B"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Costo promedio ponderado histórico por cajón del producto */
function getCostoPromedio(compras: Compra[], producto: string): number {
  const norm = (s: string) => s.toLowerCase().trim()
  const filtradas = compras.filter(c => norm(c.producto) === norm(producto) && c.cantidad > 0)
  if (filtradas.length === 0) return 0
  const totalCosto = filtradas.reduce((s, c) => s + (c.total > 0 ? c.total : c.cantidad * c.precio_unitario), 0)
  const totalQty = filtradas.reduce((s, c) => s + c.cantidad, 0)
  return totalQty > 0 ? totalCosto / totalQty : 0
}

type CorteValues = { peso_kg: string; precio_kg: string }
const emptyCortes = (): Record<string, CorteValues> =>
  Object.fromEntries(CORTES.map(c => [c, { peso_kg: "", precio_kg: "" }]))

function calcMetricas(cortesMap: Record<string, CorteValues>, costoTotal: number) {
  const totalKg = CORTES.reduce((s, c) => s + (parseFloat(cortesMap[c].peso_kg) || 0), 0)
  const ingresoTotal = CORTES.reduce((s, c) => {
    return s + (parseFloat(cortesMap[c].peso_kg) || 0) * (parseFloat(cortesMap[c].precio_kg) || 0)
  }, 0)
  const costoKg = totalKg > 0 ? costoTotal / totalKg : 0
  const ganancia = ingresoTotal - costoTotal
  const margen = ingresoTotal > 0 ? (ganancia / ingresoTotal) * 100 : 0
  return { totalKg, ingresoTotal, costoKg, ganancia, margen }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ProduccionContent() {
  const { data: lotes = [], mutate: mutateLotes } = useSupabase<LoteProduccion>("lotes_produccion")
  const { data: cortes = [], mutate: mutateCortes } = useSupabase<LoteCorte>("lote_cortes")
  const { data: compras = [] } = useSupabase<Compra>("compras")
  const { toast } = useToast()

  // ── Nuevo lote ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    producto_origen: "Pollo A",
    cajones: "",
    observaciones: "",
  })
  const [cortesForm, setCortesForm] = useState<Record<string, CorteValues>>(emptyCortes())

  const costoPorCajon = useMemo(() => getCostoPromedio(compras, form.producto_origen), [compras, form.producto_origen])
  const costoTotal = costoPorCajon * (parseFloat(form.cajones) || 0)
  const metricas = useMemo(() => calcMetricas(cortesForm, costoTotal), [cortesForm, costoTotal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cajones = parseFloat(form.cajones)
    if (!cajones || cajones <= 0) return
    try {
      const lote = await insertRow("lotes_produccion", {
        fecha: form.fecha,
        producto_origen: form.producto_origen,
        cajones,
        costo_por_cajon: costoPorCajon,
        costo_total: costoTotal,
        observaciones: form.observaciones || null,
      }) as LoteProduccion

      const cortesValidos = CORTES.filter(c => parseFloat(cortesForm[c].peso_kg) > 0)
      await Promise.all(cortesValidos.map(c =>
        insertRow("lote_cortes", {
          lote_id: lote.id,
          corte: c,
          peso_kg: parseFloat(cortesForm[c].peso_kg),
          precio_venta_kg: parseFloat(cortesForm[c].precio_kg) || null,
        })
      ))

      await mutateLotes()
      await mutateCortes()
      setForm({ fecha: new Date().toISOString().split("T")[0], producto_origen: "Pollo A", cajones: "", observaciones: "" })
      setCortesForm(emptyCortes())
      toast({ title: "Lote registrado", description: `${cajones} cajones de ${form.producto_origen} — ${metricas.totalKg.toFixed(1)} kg total` })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleDeleteLote = async (lote: LoteProduccion) => {
    if (!confirm(`¿Eliminar lote de ${lote.cajones} cajones del ${formatDate(new Date(lote.fecha))}?`)) return
    try {
      // lote_cortes se elimina por CASCADE en la DB
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
        const ingresoEst = cortesList.reduce((s, c) => s + Number(c.peso_kg) * (Number(c.precio_venta_kg) || 0), 0)
        const costoKg = totalKg > 0 ? l.costo_total / totalKg : 0
        const gananciaEst = ingresoEst > 0 ? ingresoEst - l.costo_total : null
        const margenEst = ingresoEst > 0 ? (gananciaEst! / ingresoEst) * 100 : null
        return { ...l, cortesList, totalKg, ingresoEst, gananciaEst, margenEst, costoKg }
      })
  }, [lotes, cortes])

  // ── Simulador ──────────────────────────────────────────────────────────────
  const [simProducto, setSimProducto] = useState("Pollo A")
  const [simCajones, setSimCajones] = useState("")
  const [simCortes, setSimCortes] = useState<Record<string, CorteValues>>(emptyCortes())

  const simCostoPorCajon = useMemo(() => getCostoPromedio(compras, simProducto), [compras, simProducto])
  const simCostoTotal = simCostoPorCajon * (parseFloat(simCajones) || 0)
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
                    <span className="text-muted-foreground">Costo: <span className="font-medium text-orange-600">{formatCurrency(lote.costo_total)}</span></span>
                    {lote.totalKg > 0 && (
                      <>
                        <span className="text-muted-foreground">Output: <span className="font-medium">{lote.totalKg.toFixed(1)} kg</span></span>
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {lote.cortesList.map(c => {
                        const costoEsteCorte = lote.totalKg > 0 ? (Number(c.peso_kg) / lote.totalKg) * lote.costo_total : 0
                        const ingresoEsteCorte = Number(c.peso_kg) * (Number(c.precio_venta_kg) || 0)
                        return (
                          <div key={c.id} className="rounded-lg bg-muted/40 border px-3 py-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{c.corte}</p>
                            <p className="text-sm font-bold mt-0.5">{Number(c.peso_kg).toFixed(1)} kg</p>
                            {lote.totalKg > 0 && (
                              <p className="text-xs text-muted-foreground">{((Number(c.peso_kg) / lote.totalKg) * 100).toFixed(1)}% rendimiento</p>
                            )}
                            {c.precio_venta_kg && (
                              <p className="text-xs text-green-600 mt-0.5">{formatCurrency(Number(c.precio_venta_kg))}/kg</p>
                            )}
                            {ingresoEsteCorte > 0 && costoEsteCorte > 0 && (
                              <p className={`text-xs font-medium mt-0.5 ${ingresoEsteCorte > costoEsteCorte ? "text-green-600" : "text-red-600"}`}>
                                {formatCurrency(ingresoEsteCorte - costoEsteCorte)} margen
                              </p>
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

                <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive h-8 w-8" onClick={() => handleDeleteLote(lote)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* ── NUEVO LOTE ────────────────────────────────────────────────────── */}
        <TabsContent value="nuevo" className="mt-4">
          <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">

            {/* Cabecera */}
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold text-base">Datos del lote</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fecha</Label>
                  <Input type="date" value={form.fecha} max={new Date().toISOString().split("T")[0]}
                    onChange={e => setForm({ ...form, fecha: e.target.value })} required />
                </div>
                <div>
                  <Label>Producto origen</Label>
                  <Select value={form.producto_origen} onValueChange={v => setForm({ ...form, producto_origen: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRODUCTOS_ORIGEN.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cajones a trozar</Label>
                  <Input type="number" min="1" step="1" placeholder="Ej: 10" value={form.cajones}
                    onChange={e => setForm({ ...form, cajones: e.target.value })} required />
                </div>
                {costoPorCajon > 0 && parseFloat(form.cajones) > 0 && (
                  <div className="flex flex-col justify-end">
                    <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-800/60 px-4 py-2.5">
                      <p className="text-xs text-muted-foreground">Costo estimado del lote</p>
                      <p className="font-bold text-orange-600 text-lg">{formatCurrency(costoTotal)}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(costoPorCajon)}/cajón (promedio histórico)</p>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label>Observaciones (opcional)</Label>
                <Input placeholder="Ej: Lote mañana, buena calidad" value={form.observaciones}
                  onChange={e => setForm({ ...form, observaciones: e.target.value })} />
              </div>
            </Card>

            {/* Cortes */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">Rendimiento por corte</h3>
                <div className="text-right">
                  <span className="text-sm font-semibold">{metricas.totalKg.toFixed(1)} kg total</span>
                  {metricas.totalKg > 0 && costoTotal > 0 && (
                    <p className="text-xs text-muted-foreground">Costo/kg: {formatCurrency(metricas.costoKg)}</p>
                  )}
                </div>
              </div>

              {/* Header columnas */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-0.5">
                <span className="col-span-3">Corte</span>
                <span className="col-span-3">Kg obtenidos</span>
                <span className="col-span-2 text-center">% rend.</span>
                <span className="col-span-3">$/kg venta</span>
                <span className="col-span-1 text-right">Ingreso</span>
              </div>

              {CORTES.map(corte => {
                const kg = parseFloat(cortesForm[corte].peso_kg) || 0
                const precio = parseFloat(cortesForm[corte].precio_kg) || 0
                const pct = metricas.totalKg > 0 ? (kg / metricas.totalKg * 100).toFixed(1) : "—"
                const costoEste = metricas.totalKg > 0 && kg > 0 ? (kg / metricas.totalKg) * costoTotal : 0
                const ingresoEste = kg * precio
                return (
                  <div key={corte} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <span className="font-medium text-sm">{corte}</span>
                      {costoEste > 0 && <p className="text-xs text-muted-foreground">{formatCurrency(costoEste)}</p>}
                    </div>
                    <div className="col-span-3">
                      <Input type="number" step="0.01" min="0" placeholder="0"
                        value={cortesForm[corte].peso_kg}
                        onChange={e => setCortesForm({ ...cortesForm, [corte]: { ...cortesForm[corte], peso_kg: e.target.value } })}
                      />
                    </div>
                    <div className="col-span-2 text-center text-xs font-mono text-muted-foreground">{pct}%</div>
                    <div className="col-span-3">
                      <Input type="number" step="0.01" min="0" placeholder="opcional"
                        value={cortesForm[corte].precio_kg}
                        onChange={e => setCortesForm({ ...cortesForm, [corte]: { ...cortesForm[corte], precio_kg: e.target.value } })}
                      />
                    </div>
                    <div className="col-span-1 text-right text-xs font-medium text-green-600">
                      {ingresoEste > 0 ? formatCurrency(ingresoEste) : ""}
                    </div>
                  </div>
                )
              })}
            </Card>

            {/* Resumen */}
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

            <Button type="submit" size="lg" disabled={!form.cajones || parseFloat(form.cajones) <= 0}>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Producto</Label>
                  <Select value={simProducto} onValueChange={v => { setSimProducto(v); setSimCortes(emptyCortes()) }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRODUCTOS_ORIGEN.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cajones</Label>
                  <Input type="number" min="1" step="1" placeholder="Ej: 20"
                    value={simCajones} onChange={e => setSimCajones(e.target.value)} />
                </div>
              </div>

              {simCostoPorCajon > 0 && parseFloat(simCajones) > 0 && (
                <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200/60 px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Costo estimado</p>
                    <p className="font-bold text-orange-600">{formatCurrency(simCostoTotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Por cajón (prom.)</p>
                    <p className="font-medium text-sm">{formatCurrency(simCostoPorCajon)}</p>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">Cortes</h3>
                {simMetricas.totalKg > 0 && (
                  <div className="text-right">
                    <span className="text-sm font-semibold">{simMetricas.totalKg.toFixed(1)} kg</span>
                    {simCostoTotal > 0 && <p className="text-xs text-muted-foreground">Costo/kg: {formatCurrency(simMetricas.costoKg)}</p>}
                  </div>
                )}
              </div>

              {CORTES.map(corte => {
                const kg = parseFloat(simCortes[corte].peso_kg) || 0
                const precio = parseFloat(simCortes[corte].precio_kg) || 0
                const pct = simMetricas.totalKg > 0 ? (kg / simMetricas.totalKg * 100).toFixed(1) : null
                const costoEste = simMetricas.totalKg > 0 && kg > 0 ? (kg / simMetricas.totalKg) * simCostoTotal : 0
                const ingresoEste = kg * precio
                const gananciaEste = ingresoEste - costoEste
                const margenEste = ingresoEste > 0 ? (gananciaEste / ingresoEste) * 100 : null

                return (
                  <div key={corte} className={`rounded-lg border p-3 space-y-2 transition-colors ${kg > 0 && precio > 0 ? (gananciaEste >= 0 ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800") : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{corte}</span>
                      {margenEste !== null && (
                        <Badge variant={margenEste >= 20 ? "default" : margenEste >= 10 ? "secondary" : "destructive"} className="text-xs">
                          {margenEste.toFixed(1)}% margen
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Kg</Label>
                        <Input type="number" step="0.01" min="0" placeholder="0"
                          value={simCortes[corte].peso_kg}
                          onChange={e => setSimCortes({ ...simCortes, [corte]: { ...simCortes[corte], peso_kg: e.target.value } })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">$/kg</Label>
                        <Input type="number" step="0.01" min="0" placeholder="0"
                          value={simCortes[corte].precio_kg}
                          onChange={e => setSimCortes({ ...simCortes, [corte]: { ...simCortes[corte], precio_kg: e.target.value } })}
                        />
                      </div>
                    </div>
                    {kg > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {pct && <span>{pct}% del total</span>}
                        {costoEste > 0 && <span>Costo: <span className="text-orange-600">{formatCurrency(costoEste)}</span></span>}
                        {ingresoEste > 0 && <span>Ingreso: <span className="text-green-600">{formatCurrency(ingresoEste)}</span></span>}
                        {gananciaEste !== 0 && ingresoEste > 0 && (
                          <span className={`font-semibold ${gananciaEste >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {gananciaEste >= 0 ? "+" : ""}{formatCurrency(gananciaEste)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Resultado total del simulador */}
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
