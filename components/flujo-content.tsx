"use client"

import { useMemo, useState } from "react"
import { Wallet, TrendingUp, TrendingDown, ArrowRight, Landmark, Plus } from "lucide-react"
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
    return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

interface FlujoMensual {
  mes: string
  mesNum: number
  anio: number
  ingresos: number
  egresos: number
  neto: number
  acumulado: number
}

interface Inversion {
  id: string
  fecha: string
  descripcion: string
  tipo: "inversion" | "retorno"
  monto: number
}

export function FlujoContent() {
  const sheetsVentas = useSheet("Ventas")
  const sheetsCobros = useSheet("Cobros")
  const sheetsCompras = useSheet("Compras")
  const sheetsGastos = useSheet("Gastos")
  const sheetsInversiones = useSheet("Inversiones")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [anioFilter, setAnioFilter] = useState(String(new Date().getFullYear()))
  const [nuevaInversion, setNuevaInversion] = useState({
    tipo: "inversion" as "inversion" | "retorno",
    descripcion: "",
    monto: "",
    fecha: new Date().toISOString().split("T")[0],
  })

  const isLoading = sheetsVentas.isLoading || sheetsCompras.isLoading
  const hasError = sheetsVentas.error
  const isConnected = !hasError && !isLoading

  // Available years
  const aniosDisponibles = useMemo(() => {
    const set = new Set<number>()
    const addYear = (dateStr: string) => {
      try {
        const y = new Date(dateStr).getFullYear()
        if (y > 2020 && y < 2030) set.add(y)
      } catch { /* skip */ }
    }
    sheetsVentas.rows.forEach((r) => addYear(r.Fecha || ""))
    sheetsCompras.rows.forEach((r) => addYear(r.Fecha || ""))
    if (set.size === 0) set.add(new Date().getFullYear())
    return Array.from(set).sort((a, b) => b - a)
  }, [sheetsVentas.rows, sheetsCompras.rows])

  // Build monthly cash flow
  const flujoMensual: FlujoMensual[] = useMemo(() => {
    const anio = Number(anioFilter)
    const meses: FlujoMensual[] = Array.from({ length: 12 }, (_, i) => ({
      mes: MESES[i],
      mesNum: i,
      anio,
      ingresos: 0,
      egresos: 0,
      neto: 0,
      acumulado: 0,
    }))

    // Income from sales (Cantidad x PrecioUnitario)
    sheetsVentas.rows.forEach((r) => {
      const fecha = new Date(r.Fecha || "")
      if (fecha.getFullYear() === anio) {
        const cant = Number(r.Cantidad) || 0
        const precio = Number(r.PrecioUnitario) || 0
        meses[fecha.getMonth()].ingresos += cant * precio
      }
    })

    // Income from collections
    sheetsCobros.rows.forEach((r) => {
      const fecha = new Date(r.Fecha || "")
      if (fecha.getFullYear() === anio) {
        // Cobros are already counted in ventas for accounting
        // but represent real cash inflow
      }
    })

    // Expenses from purchases (Cantidad x Precio)
    sheetsCompras.rows.forEach((r) => {
      const fecha = new Date(r.Fecha || "")
      if (fecha.getFullYear() === anio) {
        const cant = Number(r.Cantidad) || 0
        const precio = Number(r.PrecioUnitario) || 0
        const total = cant * precio
        meses[fecha.getMonth()].egresos += total
      }
    })

    // Expenses from Gastos sheet
    sheetsGastos.rows.forEach((r) => {
      const fecha = new Date(r.Fecha || "")
      if (fecha.getFullYear() === anio) {
        if (r.Tipo?.toLowerCase() === "ingreso") {
          meses[fecha.getMonth()].ingresos += Number(r.Monto) || 0
        } else {
          meses[fecha.getMonth()].egresos += Number(r.Monto) || 0
        }
      }
    })

    // Calculate net and accumulated
    let acum = 0
    meses.forEach((m) => {
      m.neto = m.ingresos - m.egresos
      acum += m.neto
      m.acumulado = acum
    })

    return meses
  }, [sheetsVentas.rows, sheetsCobros.rows, sheetsCompras.rows, sheetsGastos.rows, anioFilter])

  // Max value for bar chart scaling
  const maxVal = Math.max(...flujoMensual.map((m) => Math.max(m.ingresos, m.egresos)), 1)

  // Investments
  const inversiones: Inversion[] = useMemo(() => {
    return sheetsInversiones.rows.map((r, i) => ({
      id: r.ID || `inv-${i}`,
      fecha: r.Fecha || "",
      descripcion: r.Descripcion || "",
      tipo: r.Tipo?.toLowerCase() === "retorno" ? "retorno" as const : "inversion" as const,
      monto: Number(r.Monto) || 0,
    })).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [sheetsInversiones.rows])

  const totalInvertido = inversiones.filter((i) => i.tipo === "inversion").reduce((a, i) => a + i.monto, 0)
  const totalRetornos = inversiones.filter((i) => i.tipo === "retorno").reduce((a, i) => a + i.monto, 0)

  const totalIngresosAnual = flujoMensual.reduce((a, m) => a + m.ingresos, 0)
  const totalEgresosAnual = flujoMensual.reduce((a, m) => a + m.egresos, 0)
  const saldoAnual = totalIngresosAnual - totalEgresosAnual

  const handleGuardar = async () => {
    if (!nuevaInversion.monto || !nuevaInversion.descripcion) return
    setSaving(true)
    try {
      const id = `I${Date.now()}`
      await addRow("Inversiones", [[
        id,
        nuevaInversion.fecha,
        nuevaInversion.tipo === "inversion" ? "Inversion" : "Retorno",
        nuevaInversion.descripcion,
        nuevaInversion.monto,
      ]])
      await sheetsInversiones.mutate()
      setNuevaInversion({ tipo: "inversion", descripcion: "", monto: "", fecha: new Date().toISOString().split("T")[0] })
      setDialogOpen(false)
    } catch {
      // Handle silently
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Ingresos {anioFilter}</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(totalIngresosAnual)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">Egresos {anioFilter}</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-destructive">{formatCurrency(totalEgresosAnual)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Flujo Neto</p>
          </div>
          <p className={`mt-2 text-2xl font-bold ${saldoAnual >= 0 ? "text-primary" : "text-destructive"}`}>
            {formatCurrency(saldoAnual)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Landmark className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Inversiones Netas</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(totalInvertido - totalRetornos)}</p>
        </div>
      </div>

      {/* Year filter + status */}
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

      <Tabs defaultValue="flujo">
        <TabsList>
          <TabsTrigger value="flujo">Flujo Mensual</TabsTrigger>
          <TabsTrigger value="inversiones">Inversiones</TabsTrigger>
        </TabsList>

        <TabsContent value="flujo" className="space-y-4">
          {/* Visual bar chart */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-4 mb-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-primary" />
                <span className="text-muted-foreground">Ingresos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-destructive" />
                <span className="text-muted-foreground">Egresos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Acumulado</span>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-1.5">
              {flujoMensual.map((m) => (
                <div key={m.mes} className="flex flex-col items-center gap-1">
                  <div className="flex h-32 w-full items-end gap-0.5">
                    <div
                      className="w-1/2 rounded-t bg-primary transition-all"
                      style={{ height: `${maxVal > 0 ? (m.ingresos / maxVal) * 100 : 0}%`, minHeight: m.ingresos > 0 ? "4px" : "0px" }}
                    />
                    <div
                      className="w-1/2 rounded-t bg-destructive transition-all"
                      style={{ height: `${maxVal > 0 ? (m.egresos / maxVal) * 100 : 0}%`, minHeight: m.egresos > 0 ? "4px" : "0px" }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{m.mes}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Mes</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Ingresos</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Egresos</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Neto</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {flujoMensual.map((m) => (
                  <tr key={m.mes} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">{m.mes} {m.anio}</td>
                    <td className="px-4 py-2.5 text-right text-primary font-medium">{m.ingresos > 0 ? formatCurrency(m.ingresos) : "-"}</td>
                    <td className="px-4 py-2.5 text-right text-destructive font-medium">{m.egresos > 0 ? formatCurrency(m.egresos) : "-"}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${m.neto >= 0 ? "text-primary" : "text-destructive"}`}>
                      {m.neto !== 0 ? formatCurrency(m.neto) : "-"}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold ${m.acumulado >= 0 ? "text-foreground" : "text-destructive"}`}>
                      {formatCurrency(m.acumulado)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-bold">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right text-primary">{formatCurrency(totalIngresosAnual)}</td>
                  <td className="px-4 py-2.5 text-right text-destructive">{formatCurrency(totalEgresosAnual)}</td>
                  <td className={`px-4 py-2.5 text-right ${saldoAnual >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(saldoAnual)}</td>
                  <td className="px-4 py-2.5 text-right" />
                </tr>
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="inversiones" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">Total invertido: <strong className="text-foreground">{formatCurrency(totalInvertido)}</strong></span>
              <span className="text-muted-foreground">Retornos: <strong className="text-primary">{formatCurrency(totalRetornos)}</strong></span>
            </div>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Inversion
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fecha</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Descripcion</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Monto</th>
                </tr>
              </thead>
              <tbody>
                {inversiones.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Sin inversiones registradas. Crea la pestana "Inversiones" en tu hoja con encabezados: ID, Fecha, Tipo, Descripcion, Monto
                    </td>
                  </tr>
                ) : (
                  inversiones.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5">{formatDate(inv.fecha)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={inv.tipo === "inversion" ? "bg-accent/10 text-accent-foreground" : "bg-primary/10 text-primary"}>
                          {inv.tipo === "inversion" ? "Inversion" : "Retorno"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{inv.descripcion}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${inv.tipo === "retorno" ? "text-primary" : "text-foreground"}`}>
                        {formatCurrency(inv.monto)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* New investment dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Inversion / Retorno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={nuevaInversion.tipo} onValueChange={(v: "inversion" | "retorno") => setNuevaInversion({ ...nuevaInversion, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inversion">Inversion</SelectItem>
                  <SelectItem value="retorno">Retorno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={nuevaInversion.fecha} onChange={(e) => setNuevaInversion({ ...nuevaInversion, fecha: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descripcion</Label>
              <Textarea
                value={nuevaInversion.descripcion}
                onChange={(e) => setNuevaInversion({ ...nuevaInversion, descripcion: e.target.value })}
                placeholder="Descripcion de la inversion"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={nuevaInversion.monto}
                  onChange={(e) => setNuevaInversion({ ...nuevaInversion, monto: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={saving || !nuevaInversion.monto || !nuevaInversion.descripcion}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
