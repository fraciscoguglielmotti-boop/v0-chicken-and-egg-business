"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Loader2, Download } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

interface Gasto {
  fecha: string
  monto: number
  categoria: string
  medio_pago?: string
  fecha_pago?: string
  descripcion?: string
  pagado?: boolean
}

interface EERRResult {
  totalVentas: number
  totalCMV: number
  margenBruto: number
  margenPct: number
  totalGastosOp: number
  desglose: Record<string, number>
  movimientosPorCat: Record<string, Gasto[]>
  gastosSueldos: Gasto[]
  gastosRetiros: Gasto[]
  totalSueldos: number
  totalRetiros: number
  resultadoOp: number
  resultadoOpPct: number
  resultadoFinal: number
  resultadoFinalPct: number
}

interface EERRResponse {
  month: string
  prevMonth: string
  current: EERRResult
  previous: EERRResult
}

const emptyEERR: EERRResult = {
  totalVentas: 0,
  totalCMV: 0,
  margenBruto: 0,
  margenPct: 0,
  totalGastosOp: 0,
  desglose: {},
  movimientosPorCat: {},
  gastosSueldos: [],
  gastosRetiros: [],
  totalSueldos: 0,
  totalRetiros: 0,
  resultadoOp: 0,
  resultadoOpPct: 0,
  resultadoFinal: 0,
  resultadoFinalPct: 0,
}

function EERRRow({ label, value, indent = false }: { label: string; value: number; indent?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-border/40 ${indent ? "pl-5" : ""}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{formatCurrency(value)}</span>
    </div>
  )
}

function EERRTotal({ label, value, pct }: { label: string; value: number; pct?: number }) {
  return (
    <div className={`flex items-center justify-between py-3 px-4 rounded-lg my-2 ${value >= 0 ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
      <span className="font-semibold text-sm">
        {label}
        {pct !== undefined && <span className="ml-2 text-xs font-normal opacity-60">({pct.toFixed(1)}%)</span>}
      </span>
      <span className={`font-bold text-base tabular-nums ${value >= 0 ? "text-green-600" : "text-red-600"}`}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}

function Delta({ actual, prev }: { actual: number; prev: number }) {
  if (prev === 0) return <span className="text-xs text-muted-foreground">—</span>
  const pct = ((actual - prev) / Math.abs(prev)) * 100
  const up = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-green-600" : "text-red-600"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{pct.toFixed(1)}%
    </span>
  )
}

async function eerrFetcher(url: string): Promise<EERRResponse> {
  const res = await fetch(url)
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: "Error" }))
    throw new Error(msg?.error ?? "Error calculando EERR")
  }
  return res.json()
}

export function ContabilidadContent() {
  // Abrir en el mes anterior: el mes en curso está incompleto, no tiene sentido
  // analizarlo hasta que termine
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [gastosExpanded, setGastosExpanded] = useState(false)
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [sueldosExpanded, setSueldosExpanded] = useState(false)
  const [retirosExpanded, setRetirosExpanded] = useState(false)

  const { data, error, isLoading } = useSWR<EERRResponse>(
    `/api/eerr/data?month=${selectedMonth}`,
    eerrFetcher,
    { revalidateOnFocus: false }
  )

  const eerr = data?.current ?? emptyEERR
  const prev = data?.previous ?? emptyEERR

  const handleDownloadCSV = () => {
    if (!data) return
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const fmtPct = (n: number) => `${n.toFixed(1)}%`
    const rows: string[] = []

    rows.push(esc(`Estado de Resultados — ${selectedMonth}`))
    rows.push("")
    rows.push([esc("Concepto"), esc("Mes actual"), esc("Mes anterior")].join(","))
    rows.push([esc("(+) Ventas"), esc(eerr.totalVentas), esc(prev.totalVentas)].join(","))
    rows.push([esc("(−) Costo de mercadería vendida"), esc(eerr.totalCMV), esc(prev.totalCMV)].join(","))
    rows.push([esc(`= Margen Bruto (${fmtPct(eerr.margenPct)})`), esc(eerr.margenBruto), esc(prev.margenBruto)].join(","))
    rows.push([esc("(−) Gastos Operativos"), esc(eerr.totalGastosOp), esc(prev.totalGastosOp)].join(","))
    rows.push([esc(`= Resultado Operativo (${fmtPct(eerr.resultadoOpPct)})`), esc(eerr.resultadoOp), esc(prev.resultadoOp)].join(","))
    rows.push([esc("(−) Sueldos y Comisiones"), esc(eerr.totalSueldos), esc(prev.totalSueldos)].join(","))
    rows.push([esc("(−) Retiros personales"), esc(eerr.totalRetiros), esc(prev.totalRetiros)].join(","))
    rows.push([esc(`= Resultado del Período (${fmtPct(eerr.resultadoFinalPct)})`), esc(eerr.resultadoFinal), esc(prev.resultadoFinal)].join(","))

    rows.push("")
    rows.push(esc("Desglose de Gastos Operativos"))
    rows.push([esc("Categoría"), esc("Total")].join(","))
    Object.entries(eerr.desglose)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, total]) => {
        rows.push([esc(cat), esc(total)].join(","))
      })

    rows.push("")
    rows.push(esc("Detalle de Movimientos"))
    rows.push([esc("Fecha"), esc("Categoría"), esc("Descripción"), esc("Medio de pago"), esc("Monto")].join(","))
    Object.entries(eerr.movimientosPorCat).forEach(([cat, movs]) => {
      movs
        .slice()
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .forEach((g) => {
          rows.push([
            esc(g.fecha.slice(0, 10)),
            esc(cat),
            esc(g.descripcion ?? ""),
            esc(g.medio_pago ?? ""),
            esc(g.monto),
          ].join(","))
        })
    })
    eerr.gastosSueldos
      .slice()
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .forEach((g) => {
        rows.push([
          esc(g.fecha.slice(0, 10)),
          esc(g.categoria),
          esc(g.descripcion ?? ""),
          esc(g.medio_pago ?? ""),
          esc(g.monto),
        ].join(","))
      })
    eerr.gastosRetiros
      .slice()
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .forEach((g) => {
        rows.push([
          esc(g.fecha.slice(0, 10)),
          esc(g.categoria),
          esc(g.descripcion ?? ""),
          esc(g.medio_pago ?? ""),
          esc(g.monto),
        ].join(","))
      })

    const bom = "﻿"
    const blob = new Blob([bom + rows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `eerr-${selectedMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Label>Período</Label>
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-auto mt-1"
        />
      </div>

      {error && (
        <Card className="p-6 border-destructive/50 bg-destructive/5">
          <p className="text-sm text-destructive">
            Error al cargar el EERR: {error instanceof Error ? error.message : "Error desconocido"}
          </p>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-base">Estado de Resultados</h3>
          <div className="flex items-center gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadCSV}
              disabled={!data || isLoading}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar CSV
            </Button>
          </div>
        </div>

        {isLoading && !data ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-0">
            <EERRRow label="(+) Ventas" value={eerr.totalVentas} />
            <EERRRow label="(−) Costo de mercadería vendida (FIFO)" value={eerr.totalCMV} />
            <EERRTotal label="= Margen Bruto" value={eerr.margenBruto} pct={eerr.margenPct} />

            <button
              onClick={() => setGastosExpanded(!gastosExpanded)}
              className="flex items-center justify-between w-full py-2.5 border-b border-border/40 text-left hover:bg-muted/30 rounded transition-colors"
            >
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                {gastosExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                (−) Gastos Operativos
              </span>
              <span className="text-sm font-medium tabular-nums">{formatCurrency(eerr.totalGastosOp)}</span>
            </button>

            {gastosExpanded && (
              <div className="pl-4 ml-2 border-l-2 border-border/30 mb-1">
                {Object.entries(eerr.desglose).sort((a, b) => b[1] - a[1]).map(([cat, total]) => {
                  const movs = eerr.movimientosPorCat[cat] ?? []
                  const catOpen = expandedCat === cat
                  return (
                    <div key={cat}>
                      <button
                        className="flex items-center justify-between w-full py-1.5 text-xs hover:bg-muted/30 rounded px-1 transition-colors"
                        onClick={() => setExpandedCat(catOpen ? null : cat)}
                      >
                        <span className="flex items-center gap-1 text-muted-foreground">
                          {catOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {cat}
                          <span className="text-muted-foreground/50">({movs.length})</span>
                        </span>
                        <span className="tabular-nums text-muted-foreground">{formatCurrency(total)}</span>
                      </button>
                      {catOpen && (
                        <div className="ml-4 mb-1 border-l border-border/20 pl-3">
                          {movs.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((g, i) => (
                            <div key={i} className="flex items-center justify-between py-1 text-xs border-b border-border/10 last:border-0">
                              <div className="flex flex-col min-w-0">
                                <span className="text-muted-foreground/70 tabular-nums">{g.fecha.slice(0, 10)}</span>
                                {g.descripcion && <span className="text-muted-foreground truncate max-w-[200px]">{g.descripcion}</span>}
                                {g.medio_pago && <span className="text-muted-foreground/50">{g.medio_pago}</span>}
                              </div>
                              <span className="tabular-nums text-muted-foreground ml-4 shrink-0">{formatCurrency(g.monto)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {Object.keys(eerr.desglose).length === 0 && (
                  <p className="py-2 text-xs text-muted-foreground italic">Sin gastos operativos en este período</p>
                )}
              </div>
            )}

            <EERRTotal label="= Resultado Operativo" value={eerr.resultadoOp} pct={eerr.resultadoOpPct} />

            {/* Sueldos expandible */}
            <button
              onClick={() => setSueldosExpanded((v) => !v)}
              className="flex items-center justify-between w-full py-2.5 border-b border-border/40 text-left hover:bg-muted/30 rounded transition-colors"
            >
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                {sueldosExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                (−) Sueldos y Comisiones
              </span>
              <span className="text-sm font-medium tabular-nums">{formatCurrency(eerr.totalSueldos)}</span>
            </button>
            {sueldosExpanded && (
              <div className="pl-4 ml-2 border-l-2 border-border/30 mb-1">
                {eerr.gastosSueldos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((g, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-xs border-b border-border/10 last:border-0">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground/70">{g.fecha.slice(0, 10)}</span>
                      <span className="text-muted-foreground">{g.descripcion || g.categoria}</span>
                      {g.medio_pago && <span className="text-muted-foreground/50">{g.medio_pago}</span>}
                    </div>
                    <span className="tabular-nums text-muted-foreground">{formatCurrency(g.monto)}</span>
                  </div>
                ))}
                {eerr.gastosSueldos.length === 0 && <p className="py-2 text-xs text-muted-foreground italic">Sin movimientos</p>}
              </div>
            )}

            {/* Retiros expandible */}
            {eerr.totalRetiros > 0 && (
              <>
                <button
                  onClick={() => setRetirosExpanded((v) => !v)}
                  className="flex items-center justify-between w-full py-2.5 border-b border-border/40 text-left hover:bg-muted/30 rounded transition-colors"
                >
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    {retirosExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    (−) Retiros personales
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(eerr.totalRetiros)}</span>
                </button>
                {retirosExpanded && (
                  <div className="pl-4 ml-2 border-l-2 border-border/30 mb-1">
                    {eerr.gastosRetiros.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((g, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 text-xs border-b border-border/10 last:border-0">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground/70">{g.fecha.slice(0, 10)}</span>
                          <span className="text-muted-foreground">{g.descripcion || g.categoria}</span>
                        </div>
                        <span className="tabular-nums text-muted-foreground">{formatCurrency(g.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <EERRTotal label="= Resultado del Período" value={eerr.resultadoFinal} pct={eerr.resultadoFinalPct} />
          </div>
        )}
      </Card>

      {/* Comparativa mes anterior */}
      <Card className="p-6">
        <h3 className="font-semibold text-base mb-4">Comparativa vs mes anterior</h3>
        {isLoading && !data ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-normal text-muted-foreground">Concepto</th>
                  <th className="text-right py-2 font-normal text-muted-foreground">Mes actual</th>
                  <th className="text-right py-2 font-normal text-muted-foreground">Mes anterior</th>
                  <th className="text-right py-2 font-normal text-muted-foreground">Variación</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Ventas", actual: eerr.totalVentas, prev: prev.totalVentas },
                  { label: "CMV", actual: eerr.totalCMV, prev: prev.totalCMV },
                  { label: "Margen Bruto", actual: eerr.margenBruto, prev: prev.margenBruto },
                  { label: "Gastos Operativos", actual: eerr.totalGastosOp, prev: prev.totalGastosOp },
                  { label: "Resultado Operativo", actual: eerr.resultadoOp, prev: prev.resultadoOp },
                  { label: "Sueldos", actual: eerr.totalSueldos, prev: prev.totalSueldos },
                  { label: "Retiros personales", actual: eerr.totalRetiros, prev: prev.totalRetiros },
                ].map((row) => (
                  <tr key={row.label} className="border-b">
                    <td className="py-2.5 text-muted-foreground">{row.label}</td>
                    <td className="py-2.5 text-right font-medium tabular-nums">{formatCurrency(row.actual)}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatCurrency(row.prev)}</td>
                    <td className="py-2.5 text-right"><Delta actual={row.actual} prev={row.prev} /></td>
                  </tr>
                ))}
                <tr className="border-t-2 font-semibold">
                  <td className="py-2.5">Resultado Final</td>
                  <td className={`py-2.5 text-right tabular-nums ${eerr.resultadoFinal >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(eerr.resultadoFinal)}</td>
                  <td className={`py-2.5 text-right tabular-nums ${prev.resultadoFinal >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(prev.resultadoFinal)}</td>
                  <td className="py-2.5 text-right"><Delta actual={eerr.resultadoFinal} prev={prev.resultadoFinal} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
