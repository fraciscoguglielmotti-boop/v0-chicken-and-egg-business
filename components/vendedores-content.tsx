"use client"

import { useState, useMemo } from "react"
import { Plus, Search, Users, TrendingUp, DollarSign, Percent, Pencil, Trash2 } from "lucide-react"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DataTable } from "./data-table"
import { SheetsStatus } from "./sheets-status"
import { useSheet, addRow, updateRowData, deleteRow, type SheetRow } from "@/hooks/use-sheets"
import { formatCurrency, parseDate, parseSheetNumber, resolveVentaMonto } from "@/lib/utils"

interface Vendedor {
  nombre: string
  comisionPct: number
  totalVentas: number
  totalGanancia: number
  totalComisiones: number
  cantidadVentas: number
  clientes: string[]
  _rowIndex: number | null // null for vendedores derived from sales only
}

export function VendedoresContent() {
  const sheetsVentas = useSheet("Ventas")
  const sheetsCompras = useSheet("Compras")
  const sheetsVendedores = useSheet("Vendedores")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [periodoFilter, setPeriodoFilter] = useState("todo")
  const [saving, setSaving] = useState(false)
  const [nuevoVendedor, setNuevoVendedor] = useState({ nombre: "", comision: "5" })
  const [editRowIndex, setEditRowIndex] = useState<number | null>(null)
  const [deleteVendedor, setDeleteVendedor] = useState<Vendedor | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const isLoading = sheetsVentas.isLoading || sheetsCompras.isLoading || sheetsVendedores.isLoading
  const hasError = sheetsVentas.error
  const isConnected = !hasError && !isLoading

  // Build commission rates and row indices from Vendedores sheet
  const comisionesConfig = useMemo(() => {
    const map = new Map<string, { comision: number; rowIndex: number }>()
    sheetsVendedores.rows.forEach((r, i) => {
      if (r.Nombre) {
        map.set(r.Nombre.toLowerCase().trim(), { comision: parseSheetNumber(r.Comision) || 5, rowIndex: i })
      }
    })
    return map
  }, [sheetsVendedores.rows])

  // Build cost price per product from Compras (latest price per product name)
  const costosPorProducto = useMemo(() => {
    const map = new Map<string, number>()
    sheetsCompras.rows.forEach((r) => {
      const producto = (r.Producto || r.Productos || "").toLowerCase().trim()
      const { precioUnitario: precio } = resolveVentaMonto(r)
      if (producto && precio > 0) {
        map.set(producto, precio)
      }
    })
    return map
  }, [sheetsCompras.rows])

  // Filter sales by period
  const ventasFiltradas = useMemo(() => {
    const now = new Date()
    return sheetsVentas.rows.filter((r) => {
      if (periodoFilter === "todo") return true
      const fecha = parseDate(r.Fecha || "")
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
      const config = comisionesConfig.get(key)
      const existing = map.get(key) || {
        nombre: vendedor,
        comisionPct: config?.comision || 5,
        totalVentas: 0,
        totalGanancia: 0,
        totalComisiones: 0,
        cantidadVentas: 0,
        clientes: [],
        _rowIndex: config?.rowIndex ?? null,
      }
      const { cantidad: cant, precioUnitario: precioVenta, total } = resolveVentaMonto(r)

      const productoName = (r.Productos || "").toLowerCase().trim()
      const precioCosto = costosPorProducto.get(productoName) || 0
      const ganancia = (precioVenta - precioCosto) * cant

      existing.totalVentas += total
      existing.totalGanancia += Math.max(ganancia, 0)
      existing.cantidadVentas += 1
      existing.totalComisiones += Math.max(ganancia, 0) * (existing.comisionPct / 100)

      const cliente = r.Cliente || ""
      if (cliente && !existing.clientes.includes(cliente)) {
        existing.clientes.push(cliente)
      }

      map.set(key, existing)
    })

    // Also include vendedores from sheet that may have no sales in the filtered period
    sheetsVendedores.rows.forEach((r, i) => {
      const key = (r.Nombre || "").toLowerCase().trim()
      if (key && !map.has(key)) {
        map.set(key, {
          nombre: r.Nombre || "",
          comisionPct: parseSheetNumber(r.Comision) || 5,
          totalVentas: 0,
          totalGanancia: 0,
          totalComisiones: 0,
          cantidadVentas: 0,
          clientes: [],
          _rowIndex: i,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.totalVentas - a.totalVentas)
  }, [ventasFiltradas, comisionesConfig, costosPorProducto, sheetsVendedores.rows])

  const filteredVendedores = vendedores.filter((v) =>
    v.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalVentasGeneral = vendedores.reduce((acc, v) => acc + v.totalVentas, 0)
  const totalComisiones = vendedores.reduce((acc, v) => acc + v.totalComisiones, 0)

  const resetForm = () => {
    setNuevoVendedor({ nombre: "", comision: "5" })
    setEditRowIndex(null)
    setFormErrors({})
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    resetForm()
  }

  const handleEditVendedor = (v: Vendedor) => {
    if (v._rowIndex === null) return
    setEditRowIndex(v._rowIndex)
    setNuevoVendedor({ nombre: v.nombre, comision: String(v.comisionPct) })
    setDialogOpen(true)
  }

  const handleAgregarVendedor = async () => {
    const errs: Record<string, string> = {}
    if (!nuevoVendedor.nombre.trim()) errs.nombre = "Ingrese un nombre"
    if (!nuevoVendedor.comision || Number(nuevoVendedor.comision) < 0) errs.comision = "Comision invalida"
    setFormErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      if (editRowIndex !== null) {
        await updateRowData("Vendedores", editRowIndex, {
          "Nombre": nuevoVendedor.nombre,
          "Comision": nuevoVendedor.comision,
        })
      } else {
        const id = `V${Date.now()}`
        await addRow("Vendedores", [[id, nuevoVendedor.nombre, nuevoVendedor.comision, new Date().toLocaleDateString("es-AR")]])
      }
      await sheetsVendedores.mutate()
      handleCloseDialog()
    } catch {
      // Handle error silently
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteVendedor || deleteVendedor._rowIndex === null) return
    setSaving(true)
    try {
      await deleteRow("Vendedores", deleteVendedor._rowIndex)
      await sheetsVendedores.mutate()
    } catch {
      // silent
    } finally {
      setSaving(false)
      setDeleteVendedor(null)
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
      key: "totalGanancia",
      header: "Ganancia",
      render: (v: Vendedor) => (
        <span className="font-medium text-foreground">{formatCurrency(v.totalGanancia)}</span>
      ),
    },
    {
      key: "comisionPct",
      header: "% Comision",
      render: (v: Vendedor) => <Badge variant="outline">{v.comisionPct}%</Badge>,
    },
    {
      key: "totalComisiones",
      header: "Comision (s/ganancia)",
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
    {
      key: "acciones",
      header: "",
      render: (v: Vendedor) =>
        v._rowIndex !== null ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEditVendedor(v) }}>
              <Pencil className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Editar vendedor</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDeleteVendedor(v) }}>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Eliminar vendedor</span>
            </Button>
          </div>
        ) : null,
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
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar Vendedor
        </Button>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filteredVendedores} emptyMessage={isLoading ? "Cargando..." : "No hay vendedores. Las ventas con campo 'Vendedor' generan automaticamente la lista."} />

      {/* Add/Edit Vendor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent onEscapeKeyDown={handleCloseDialog}>
          <DialogHeader>
            <DialogTitle>{editRowIndex !== null ? "Editar Vendedor" : "Agregar Vendedor"}</DialogTitle>
            <DialogDescription>{editRowIndex !== null ? "Modifique la comision del vendedor" : "Agregue un nuevo vendedor al sistema"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del Vendedor</Label>
              <Input
                value={nuevoVendedor.nombre}
                onChange={(e) => { setNuevoVendedor({ ...nuevoVendedor, nombre: e.target.value }); setFormErrors((er) => ({ ...er, nombre: "" })) }}
                placeholder="Nombre completo"
                className={formErrors.nombre ? "border-destructive" : ""}
                disabled={editRowIndex !== null}
              />
              {formErrors.nombre && <p className="text-xs text-destructive">{formErrors.nombre}</p>}
            </div>
            <div className="space-y-2">
              <Label>Porcentaje de Comision (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={nuevoVendedor.comision}
                  onChange={(e) => { setNuevoVendedor({ ...nuevoVendedor, comision: e.target.value }); setFormErrors((er) => ({ ...er, comision: "" })) }}
                  min="0"
                  max="100"
                  step="0.5"
                  className={formErrors.comision ? "border-destructive" : ""}
                />
                <span className="text-muted-foreground">%</span>
              </div>
              {formErrors.comision && <p className="text-xs text-destructive">{formErrors.comision}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
            <Button onClick={handleAgregarVendedor} disabled={saving}>
              {saving ? "Guardando..." : editRowIndex !== null ? "Guardar Cambios" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteVendedor} onOpenChange={(open) => { if (!open) setDeleteVendedor(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar vendedor</AlertDialogTitle>
            <AlertDialogDescription>
              Esta seguro que desea eliminar a <span className="font-semibold">{deleteVendedor?.nombre}</span> de la lista de vendedores? Esta accion no se puede deshacer. Las ventas asociadas no se eliminaran.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
