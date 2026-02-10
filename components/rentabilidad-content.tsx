"use client"

import { useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { SheetsStatus } from "./sheets-status"
import { useSheet } from "@/hooks/use-sheets"
import { formatCurrency, parseDate, resolveVentaMonto } from "@/lib/utils"

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

// Compute hex colors from CSS vars at render time
function getCSSColor(variable: string): string {
  if (typeof window === "undefined") return "#666"
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  if (!value) return "#666"
  // Convert HSL to hex
  const [h, s, l] = value.split(" ").map((v) => Number.parseFloat(v.replace("%", "")))
  return hslToHex(h, s, l)
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

interface MesData {
  mes: string
  mesNum: number
  ingresos: number
  costoMercaderia: number
  gastos: number
  gananciasBrutas: number
  gananciasNetas: number
  margenBruto: number
  margenNeto: number
}

interface CompraRow {
  Fecha: string
  Producto: string
  Monto: number
}

export function RentabilidadContent() {
  const sheetsVentas = useSheet("Ventas")
  const sheetsCompras = useSheet("Compras")
  const sheetsGastos = useSheet("Gastos")
  const [anioFilter, setAnioFilter] = useState(String(new Date().getFullYear()))

  const isLoading = sheetsVentas.isLoading || sheetsCompras.isLoading || sheetsGastos.isLoading
  const hasError = sheetsVentas.error
  const isConnected = !hasError && !isLoading

  const aniosDisponibles = useMemo(() => {
    const set = new Set<number>()
    const addYear = (dateStr: string) => {
      try {
        const d = parseDate(dateStr)
        const y = d.getUTCFullYear()
        if (y > 2020 && y < 2030) set.add(y)
      } catch { /* skip */ }
    }
    sheetsVentas.rows.forEach((r) => addYear(r.Fecha || ""))
    sheetsCompras.rows.forEach((r) => addYear(r.Fecha || ""))
    if (set.size === 0) set.add(new Date().getFullYear())
    return Array.from(set).sort((a, b) => b - a)
  }, [sheetsVentas.rows, sheetsCompras.rows])

  // Build monthly profitability data
  const mesesData: MesData[] = useMemo(() => {
    const anio = Number(anioFilter)
    const meses: MesData[] = Array.from({ length: 12 }, (_, i) => ({
      mes: MESES[i],
      mesNum: i,
      ingresos: 0,
      costoMercaderia: 0,
      gastos: 0,
      gananciasBrutas: 0,
      gananciasNetas: 0,
      margenBruto: 0,
      margenNeto: 0,
    }))

    // Income from sales
    sheetsVentas.rows.forEach((r) => {
      const fecha = parseDate(r.Fecha || "")
      if (fecha.getUTCFullYear() === anio) {
        const { total } = resolveVentaMonto(r)
        meses[fecha.getUTCMonth()].ingresos += total
      }
    })

    // Cost of goods from purchases
    sheetsCompras.rows.forEach((r) => {
      const fecha = parseDate(r.Fecha || "")
      if (fecha.getUTCFullYear() === anio) {
        const { total } = resolveVentaMonto(r)
        meses[fecha.getUTCMonth()].costoMercaderia += total
      }
    })

    // Operating expenses from Gastos sheet
    sheetsGastos.rows.forEach((r) => {
      const fecha = parseDate(r.Fecha || "")
      if (fecha.getUTCFullYear() === anio) {
        if (r.Tipo?.toLowerCase() !== "ingreso") {
          meses[fecha.getUTCMonth()].gastos += Number(r.Monto) || 0
        }
      }
    })

    // Calculate margins
    meses.forEach((m) => {
      m.gananciasBrutas = m.ingresos - m.costoMercaderia
      m.gananciasNetas = m.gananciasBrutas - m.gastos
      m.margenBruto = m.ingresos > 0 ? (m.gananciasBrutas / m.ingresos) * 100 : 0
      m.margenNeto = m.ingresos > 0 ? (m.gananciasNetas / m.ingresos) * 100 : 0
    })

    return meses
  }, [sheetsVentas.rows, sheetsCompras.rows, sheetsGastos.rows, anioFilter])

  // Totals
  const totalIngresos = mesesData.reduce((a, m) => a + m.ingresos, 0)
  const totalCostoMerc = mesesData.reduce((a, m) => a + m.costoMercaderia, 0)
  const totalGastos = mesesData.reduce((a, m) => a + m.gastos, 0)
  const totalGanBruta = totalIngresos - totalCostoMerc
  const totalGanNeta = totalGanBruta - totalGastos
  const margenBrutoTotal = totalIngresos > 0 ? (totalGanBruta / totalIngresos) * 100 : 0
  const margenNetoTotal = totalIngresos > 0 ? (totalGanNeta / totalIngresos) * 100 : 0

  // Product profitability
  const rentabilidadProducto = useMemo(() => {
    const anio = Number(anioFilter)
    const map = new Map<string, { producto: string; ingresos: number; costos: number }>()

    sheetsVentas.rows.forEach((r) => {
      const fecha = parseDate(r.Fecha || "")
      if (fecha.getUTCFullYear() !== anio) return
      const producto = r.Productos || "Otros"
      const { total } = resolveVentaMonto(r)
      const existing = map.get(producto) || { producto, ingresos: 0, costos: 0 }
      existing.ingresos += total
      map.set(producto, existing)
    })

    // Distribute purchase costs proportionally or by product matching
    sheetsCompras.rows.forEach((r: CompraRow) => {
      const fecha = parseDate(r.Fecha || "")
      if (fecha.getUTCFullYear() !== anio) return
      const producto = r.Producto || "Otros"
      const { total: totalCompra } = resolveVentaMonto(r)

      // Try to match with sales product
      let matched = false
      for (const [key, val] of map) {
        if (key.toLowerCase().includes(producto.toLowerCase()) || producto.toLowerCase().includes(key.toLowerCase())) {
          val.costos += totalCompra
          matched = true
          break
        }
      }
      if (!matched) {
        const existing = map.get(producto) || { producto, ingresos: 0, costos: 0 }
        existing.costos += totalCompra
        map.set(producto, existing)
      }
    })

    return Array.from(map.values())
      .map((p) => ({
        ...p,
        ganancia: p.ingresos - p.costos,
        margen: p.ingresos > 0 ? ((p.ingresos - p.costos) / p.ingresos) * 100 : 0,
      }))
      .sort((a, b) => b.ganancia - a.ganancia)
  }, [sheetsVentas.rows, sheetsCompras.rows, anioFilter])

  // Colors for charts (computed from CSS vars)
  const primaryColor = getCSSColor("--primary")
  const destructiveColor = getCSSColor("--destructive")
  const accentColor = getCSSColor("--accent")
  const chartColors = [primaryColor, accentColor, destructiveColor, "#6366f1", "#0ea5e9"]

  // Pie data for cost structure
  const costStructure = [
    { name: "Costo Mercaderia", value: totalCostoMerc },
    { name: "Gastos Operativos", value: totalGastos },
    { name: "Ganancia Neta", value: Math.max(totalGanNeta, 0) },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Ingresos</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
              <TrendingUp className="h-4 w-4 text-accent-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Ganancia Bruta</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(totalGanBruta)}</p>
          <p className="text-xs text-muted-foreground">Margen: {margenBrutoTotal.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${totalGanNeta >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
              {totalGanNeta >= 0 ? <ArrowUpRight className="h-4 w-4 text-primary" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
            </div>
            <p className="text-sm text-muted-foreground">Ganancia Neta</p>
          </div>
          <p className={`mt-2 text-2xl font-bold ${totalGanNeta >= 0 ? "text-primary" : "text-destructive"}`}>
            {formatCurrency(totalGanNeta)}
          </p>
          <p className="text-xs text-muted-foreground">Margen: {margenNetoTotal.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">Costos + Gastos</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-destructive">{formatCurrency(totalCostoMerc + totalGastos)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Percent className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Margen Neto</p>
          </div>
          <p className={`mt-2 text-2xl font-bold ${margenNetoTotal >= 0 ? "text-primary" : "text-destructive"}`}>
            {margenNetoTotal.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={anioFilter} onValueChange={setAnioFilter}>
          <SelectTrigger className="w-32">
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

      <Tabs defaultValue="evolucion">
        <TabsList>
          <TabsTrigger value="evolucion">Evolucion Mensual</TabsTrigger>
          <TabsTrigger value="productos">Por Producto</TabsTrigger>
          <TabsTrigger value="estructura">Estructura de Costos</TabsTrigger>
        </TabsList>

        {/* Evolution Chart */}
        <TabsContent value="evolucion" className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-4 font-semibold text-foreground">Ingresos vs Costos vs Ganancia Neta</h3>
            <ChartContainer
              config={{
                ingresos: { label: "Ingresos", color: primaryColor },
                costoMercaderia: { label: "Costo Mercaderia", color: accentColor },
                gananciasNetas: { label: "Ganancia Neta", color: destructiveColor },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mesesData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="ingresos" name="Ingresos" fill={primaryColor} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="costoMercaderia" name="Costo Mercaderia" fill={accentColor} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gananciasNetas" name="Ganancia Neta" radius={[4, 4, 0, 0]}>
                    {mesesData.map((entry, index) => (
                      <Cell key={index} fill={entry.gananciasNetas >= 0 ? primaryColor : destructiveColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>

          {/* Margin trend */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-4 font-semibold text-foreground">Tendencia de Margen (%)</h3>
            <ChartContainer
              config={{
                margenBruto: { label: "Margen Bruto", color: primaryColor },
                margenNeto: { label: "Margen Neto", color: accentColor },
              }}
              className="h-[250px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mesesData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line type="monotone" dataKey="margenBruto" name="Margen Bruto" stroke={primaryColor} strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="margenNeto" name="Margen Neto" stroke={accentColor} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>

          {/* Monthly table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mes</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Ingresos</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Costo Merc.</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Gan. Bruta</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Gastos</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Gan. Neta</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Margen</th>
                </tr>
              </thead>
              <tbody>
                {mesesData.map((m) => (
                  <tr key={m.mes} className="border-b last:border-0">
                    <td className="px-3 py-2.5 font-medium text-foreground">{m.mes}</td>
                    <td className="px-3 py-2.5 text-right">{m.ingresos > 0 ? formatCurrency(m.ingresos) : "-"}</td>
                    <td className="px-3 py-2.5 text-right text-destructive">{m.costoMercaderia > 0 ? formatCurrency(m.costoMercaderia) : "-"}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{m.gananciasBrutas !== 0 ? formatCurrency(m.gananciasBrutas) : "-"}</td>
                    <td className="px-3 py-2.5 text-right text-destructive">{m.gastos > 0 ? formatCurrency(m.gastos) : "-"}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${m.gananciasNetas >= 0 ? "text-primary" : "text-destructive"}`}>
                      {m.gananciasNetas !== 0 ? formatCurrency(m.gananciasNetas) : "-"}
                    </td>
                    <td className={`px-3 py-2.5 text-right text-xs ${m.margenNeto >= 0 ? "text-primary" : "text-destructive"}`}>
                      {m.ingresos > 0 ? `${m.margenNeto.toFixed(1)}%` : "-"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-bold">
                  <td className="px-3 py-2.5">Total</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(totalIngresos)}</td>
                  <td className="px-3 py-2.5 text-right text-destructive">{formatCurrency(totalCostoMerc)}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(totalGanBruta)}</td>
                  <td className="px-3 py-2.5 text-right text-destructive">{formatCurrency(totalGastos)}</td>
                  <td className={`px-3 py-2.5 text-right ${totalGanNeta >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(totalGanNeta)}</td>
                  <td className={`px-3 py-2.5 text-right text-xs ${margenNetoTotal >= 0 ? "text-primary" : "text-destructive"}`}>{margenNetoTotal.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="productos" className="space-y-4">
          {rentabilidadProducto.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
              Sin datos de productos para el periodo seleccionado
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-card p-4">
                <h3 className="mb-4 font-semibold text-foreground">Ganancia por Producto</h3>
                <ChartContainer
                  config={Object.fromEntries(
                    rentabilidadProducto.map((p, i) => [
                      p.producto,
                      { label: p.producto, color: chartColors[i % chartColors.length] },
                    ])
                  )}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rentabilidadProducto} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="producto" type="category" tick={{ fontSize: 12 }} width={80} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="ganancia" name="Ganancia" radius={[0, 4, 4, 0]}>
                        {rentabilidadProducto.map((entry, index) => (
                          <Cell key={index} fill={entry.ganancia >= 0 ? chartColors[index % chartColors.length] : destructiveColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Producto</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Ingresos</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Costos</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Ganancia</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rentabilidadProducto.map((p) => (
                      <tr key={p.producto} className="border-b last:border-0">
                        <td className="px-4 py-2.5 font-medium text-foreground">{p.producto}</td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(p.ingresos)}</td>
                        <td className="px-4 py-2.5 text-right text-destructive">{formatCurrency(p.costos)}</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${p.ganancia >= 0 ? "text-primary" : "text-destructive"}`}>
                          {formatCurrency(p.ganancia)}
                        </td>
                        <td className={`px-4 py-2.5 text-right ${p.margen >= 0 ? "text-primary" : "text-destructive"}`}>
                          {p.margen.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>

        {/* Cost Structure Tab */}
        <TabsContent value="estructura" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-4 font-semibold text-foreground">Distribucion del Ingreso</h3>
              <ChartContainer
                config={{
                  costoMercaderia: { label: "Costo Mercaderia", color: accentColor },
                  gastos: { label: "Gastos Operativos", color: destructiveColor },
                  ganancia: { label: "Ganancia Neta", color: primaryColor },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costStructure}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {costStructure.map((_, index) => (
                        <Cell key={index} fill={[accentColor, destructiveColor, primaryColor][index]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ingresos Totales</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(totalIngresos)}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">100%</div>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Costo de Mercaderia</p>
                    <p className="text-xl font-bold text-destructive">{formatCurrency(totalCostoMerc)}</p>
                  </div>
                  <div className="text-right text-xs text-destructive">
                    {totalIngresos > 0 ? `${((totalCostoMerc / totalIngresos) * 100).toFixed(1)}%` : "0%"}
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${totalIngresos > 0 ? (totalCostoMerc / totalIngresos) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Gastos Operativos</p>
                    <p className="text-xl font-bold text-destructive">{formatCurrency(totalGastos)}</p>
                  </div>
                  <div className="text-right text-xs text-destructive">
                    {totalIngresos > 0 ? `${((totalGastos / totalIngresos) * 100).toFixed(1)}%` : "0%"}
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-destructive" style={{ width: `${totalIngresos > 0 ? (totalGastos / totalIngresos) * 100 : 0}%` }} />
                </div>
              </div>
              <div className={`rounded-xl border-2 p-4 ${totalGanNeta >= 0 ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ganancia Neta</p>
                    <p className={`text-xl font-bold ${totalGanNeta >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(totalGanNeta)}</p>
                  </div>
                  <div className={`text-right text-lg font-bold ${margenNetoTotal >= 0 ? "text-primary" : "text-destructive"}`}>
                    {margenNetoTotal.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
