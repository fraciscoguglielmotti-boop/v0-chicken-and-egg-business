"use client"

import { useState, useMemo } from "react"
import { Plus, Search, Users, TrendingUp, DollarSign, Percent } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "./data-table"
import { SheetsStatus } from "./sheets-status"
import { useSheet, addRow, type SheetRow } from "@/hooks/use-sheets"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

interface Vendedor {
  nombre: string
  comisionPct: number
  totalVentas: number
  totalComisiones: number
  cantidadVentas: number
  clientes: string[]
}

export function VendedoresContent() {
  const sheetsVentas = useSheet("Ventas")
  const sheetsVendedores = useSheet("Vendedores")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [periodoFilter, setPeriodoFilter] = useState("todo")
  const [saving, setSaving] = useState(false)
  const [nuevoVendedor, setNuevoVendedor] = useState({ nombre: "", comision: "5" })

  const isLoading = sheetsVentas.isLoading || sheetsVendedores.isLoading
  const hasError = sheetsVentas.error
  const isConnected = !hasError && !isLoading

  // Build commission rates from Vendedores sheet
  const comisionesConfig = useMemo(() => {
    const map = new Map<string, number>()
    sheetsVendedores.rows.forEach((r) => {
      if (r.Nombre) {
        map.set(r.Nombre.toLowerCase().trim(), Number(r.Comision) || 5)
      }
    })
    return map
  }, [sheetsVendedores.rows])

  // Filter sales by period
  const ventasFiltradas = useMemo(() => {
    const now = new Date()
    return sheetsVentas.rows.filter((r) => {
      if (periodoFilter === "todo") return true
      const fecha = new Date(r.Fecha || "")
      if (periodoFilter === "mes") {
        return fecha.getMonth() === now.getMonth() && fecha.getFullYear() === now.getFullYear()
      }
      if (periodoFilter === "semana") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return fecha >= weekAgo
      }
      return true
    })
  }, [sheetsVentas.rows, periodoFilter])

  // Calculate vendor stats from sales
  const vendedores: Vendedor[] = useMemo(() => {
    const map = new Map<string, Vendedor>()

    ventasFiltradas.forEach((r) => {
      const vendedor = r.Vendedor || "Sin asignar"
      const key = vendedor.toLowerCase().trim()
      const existing = map.get(key) || {
        nombre: vendedor,
        comisionPct: comisionesConfig.get(key) || 5,
        totalVentas: 0,
        totalComisiones: 0,
        cantidadVentas: 0,
        clientes: [],
      }
      const cant = Number(r.Cantidad) || 0
      const precio = Number(r.PrecioUnitario) || 0
      const total = cant * precio
      existing.totalVentas += total
      existing.cantidadVentas += 1
      existing.totalComisiones += total * (existing.comisionPct / 100)

      const cliente = r.Cliente || ""
      if (cliente && !existing.clientes.includes(cliente)) {
        existing.clientes.push(cliente)
      }

      map.set(key, existing)
    })

    return Array.from(map.values()).sort((a, b) => b.totalVentas - a.totalVentas)
  }, [ventasFiltradas, comisionesConfig])

  const filteredVendedores = vendedores.filter((v) =>
    v.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalVentasGeneral = vendedores.reduce((acc, v) => acc + v.totalVentas, 0)
  const totalComisiones = vendedores.reduce((acc, v) => acc + v.totalComisiones, 0)

  const handleAgregarVendedor = async () => {
    if (!nuevoVendedor.nombre.trim()) return
    setSaving(true)
    try {
      const id = `V${Date.now()}`
      await addRow("Vendedores", [[id, nuevoVendedor.nombre, nuevoVendedor.comision, new Date().toLocaleDateString("es-AR")]])
      await sheetsVendedores.mutate()
      setNuevoVendedor({ nombre: "", comision: "5" })
      setDialogOpen(false)
    } catch {
      // Handle error silently
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      key: "nombre",
      header: "Vendedor",
      render: (v: Vendedor) => (
        <div>
          <p className="font-medium text-foreground">{v.nombre}</p>
          <p className="text-xs text-muted-foreground">{v.clientes.length} clientes</p>
        </div>
      ),
    },
    {
      key: "cantidadVentas",
      header: "Ventas",
      render: (v: Vendedor) => <span className="font-medium">{v.cantidadVentas}</span>,
    },
    {
      key: "totalVentas",
      header: "Total Vendido",
      render: (v: Vendedor) => (
        <span className="font-semibold text-foreground">{formatCurrency(v.totalVentas)}</span>
      ),
    },
    {
      key: "comisionPct",
      header: "% Comision",
      render: (v: Vendedor) => <Badge variant="outline">{v.comisionPct}%</Badge>,
    },
    {
      key: "totalComisiones",
      header: "Comision",
      render: (v: Vendedor) => (
        <span className="font-bold text-primary">{formatCurrency(v.totalComisiones)}</span>
      ),
    },
    {
      key: "participacion",
      header: "Participacion",
      render: (v: Vendedor) => {
        const pct = totalVentasGeneral > 0 ? (v.totalVentas / totalVentasGeneral) * 100 : 0
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Vendedores</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{vendedores.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Total Vendido</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(totalVentasGeneral)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <DollarSign className="h-4 w-4 text-accent-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Total Comisiones</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-accent-foreground">{formatCurrency(totalComisiones)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Percent className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Promedio Comision</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {vendedores.length > 0
              ? (vendedores.reduce((a, v) => a + v.comisionPct, 0) / vendedores.length).toFixed(1)
              : "0"}%
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar vendedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">Todo</SelectItem>
              <SelectItem value="mes">Este mes</SelectItem>
              <SelectItem value="semana">Esta semana</SelectItem>
            </SelectContent>
          </Select>
          <SheetsStatus isLoading={isLoading} error={hasError} isConnected={isConnected} />
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar Vendedor
        </Button>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filteredVendedores} emptyMessage={isLoading ? "Cargando..." : "No hay vendedores. Las ventas con campo 'Vendedor' generan automaticamente la lista."} />

      {/* Add Vendor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Vendedor</DialogTitle>
            <DialogDescription>Agregue un nuevo vendedor al sistema</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del Vendedor</Label>
              <Input
                value={nuevoVendedor.nombre}
                onChange={(e) => setNuevoVendedor({ ...nuevoVendedor, nombre: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>
            <div className="space-y-2">
              <Label>Porcentaje de Comision (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={nuevoVendedor.comision}
                  onChange={(e) => setNuevoVendedor({ ...nuevoVendedor, comision: e.target.value })}
                  min="0"
                  max="100"
                  step="0.5"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <p className="font-medium">Nota:</p>
              <p>El vendedor se agregara a la pestana "Vendedores" de Google Sheets. Para editar o eliminar vendedores, edita directamente en la hoja de calculo.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAgregarVendedor} disabled={saving || !nuevoVendedor.nombre.trim()}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
