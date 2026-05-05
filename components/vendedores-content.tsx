"use client"

import { useState, useMemo } from "react"
import { Plus, Search, DollarSign, Pencil, Trash2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "./data-table"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { buildCostTimeline, getCostAtDate } from "@/lib/cost-timeline"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface Vendedor {
  id: string
  nombre: string
  comision: number
  fecha_alta: string
}

interface Venta {
  id: string
  vendedor?: string
  producto_nombre?: string
  cantidad: number
  precio_unitario: number
  fecha: string
}

interface Compra {
  id: string
  producto: string
  cantidad: number
  precio_unitario: number
  total: number
  fecha: string
}

export function VendedoresContent() {
  const { data: vendedores = [], mutate, isLoading } = useSupabase<Vendedor>("vendedores")
  const { data: ventas = [] } = useSupabase<Venta>("ventas")
  const { data: compras = [] } = useSupabase<Compra>("compras")
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [payingComision, setPayingComision] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null)
  const [form, setForm] = useState({ nombre: "", comision: "0" })
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

  // Último precio de compra vigente al momento de cada venta
  const costTimeline = useMemo(() => buildCostTimeline(compras), [compras])

  // Calcular comisiones por vendedor
  const comisionesPorVendedor = useMemo(() => {
    const comisiones = new Map<string, { totalGanancia: number, totalVentas: number, comision: number, ventas: number }>()

    ventas
      .filter(v => v.fecha.startsWith(selectedMonth))
      .forEach(venta => {
        if (!venta.vendedor) return
        const vendedor = vendedores.find(v => v.nombre === venta.vendedor)
        if (!vendedor) return

        const costoUnitario = getCostAtDate(venta.producto_nombre || "", venta.fecha, costTimeline)
        const gananciaVenta = (venta.precio_unitario - costoUnitario) * venta.cantidad
        const comisionVenta = gananciaVenta * (vendedor.comision / 100)

        const existing = comisiones.get(vendedor.nombre) || { totalGanancia: 0, totalVentas: 0, comision: 0, ventas: 0 }
        comisiones.set(vendedor.nombre, {
          totalGanancia: existing.totalGanancia + gananciaVenta,
          totalVentas: existing.totalVentas + (venta.cantidad * venta.precio_unitario),
          comision: existing.comision + comisionVenta,
          ventas: existing.ventas + 1
        })
      })

    return Array.from(comisiones.entries()).map(([nombre, data]) => ({
      id: nombre,
      nombre,
      ...data,
      porcentaje: vendedores.find(v => v.nombre === nombre)?.comision || 0
    }))
  }, [ventas, vendedores, costTimeline, selectedMonth])

  const filteredVendedores = vendedores.filter((v) =>
    v.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingVendedor) {
        await updateRow("vendedores", editingVendedor.id, { nombre: form.nombre, comision: Number(form.comision) })
      } else {
        await insertRow("vendedores", { nombre: form.nombre, comision: Number(form.comision) })
      }
      await mutate()
      setDialogOpen(false)
      setForm({ nombre: "", comision: "0" })
      setEditingVendedor(null)
      toast({ title: editingVendedor ? "Vendedor actualizado" : "Vendedor creado" })
    } catch (error: any) {
      toast({ title: "Error al guardar", description: error?.message ?? "No se pudo guardar el vendedor", variant: "destructive" })
    }
  }

  const handleEdit = (vendedor: Vendedor) => {
    setEditingVendedor(vendedor)
    setForm({ nombre: vendedor.nombre, comision: String(vendedor.comision) })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este vendedor?")) return
    try {
      await deleteRow("vendedores", id)
      await mutate()
      toast({ title: "Vendedor eliminado" })
    } catch (error: any) {
      toast({ title: "Error al eliminar", description: error?.message ?? "No se pudo eliminar el vendedor", variant: "destructive" })
    }
  }

  const handlePagarComision = async (nombre: string, monto: number) => {
    setPayingComision(nombre)
    try {
      await insertRow("gastos", {
        fecha: new Date().toISOString().split("T")[0],
        categoria: "Comisiones",
        monto,
        descripcion: `Comisión ${nombre} — ${new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })}`,
      })
      toast({ title: "Comisión pagada", description: `Se registró el gasto por comisión de ${nombre}` })
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "No se pudo registrar el pago", variant: "destructive" })
    } finally {
      setPayingComision(null)
    }
  }

  const columns = [
    { key: "nombre", header: "Nombre", render: (v: Vendedor) => <span className="font-medium">{v.nombre}</span> },
    { key: "comision", header: "Comision %", render: (v: Vendedor) => `${v.comision}%` },
    { key: "fecha_alta", header: "Fecha Alta", render: (v: Vendedor) => formatDate(new Date(v.fecha_alta)) },
    {
      key: "actions",
      header: "Acciones",
      render: (v: Vendedor) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(v)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  ]

  type ComisionRow = { id: string; nombre: string; totalGanancia: number; totalVentas: number; comision: number; ventas: number; porcentaje: number }

  const comisionesColumns = [
    { key: "nombre", header: "Vendedor", render: (c: ComisionRow) => <span className="font-medium">{c.nombre}</span> },
    { key: "ventas", header: "Ventas", render: (c: ComisionRow) => c.ventas },
    { key: "totalVentas", header: "Total Ventas", render: (c: ComisionRow) => formatCurrency(c.totalVentas) },
    { key: "totalGanancia", header: "Ganancia", render: (c: ComisionRow) => formatCurrency(c.totalGanancia) },
    { key: "porcentaje", header: "% Comisión", render: (c: ComisionRow) => `${c.porcentaje}%` },
    { key: "comision", header: "Comisión a Pagar", render: (c: ComisionRow) => (
      <Badge variant="default" className="text-base font-semibold">{formatCurrency(c.comision)}</Badge>
    )},
    { key: "pagar", header: "", render: (c: ComisionRow) => (
      <Button
        size="sm"
        variant="outline"
        disabled={payingComision === c.nombre || c.comision <= 0}
        onClick={() => handlePagarComision(c.nombre, c.comision)}
        className="gap-1"
      >
        <CheckCircle className="h-4 w-4" />
        Pagar
      </Button>
    )},
  ]

  const totalComisiones = comisionesPorVendedor.reduce((sum, c) => sum + c.comision, 0)

  return (
    <div className="space-y-6">
      <Tabs defaultValue="vendedores" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="comisiones">Comisiones</TabsTrigger>
        </TabsList>

        <TabsContent value="vendedores" className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar vendedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setForm({ nombre: "", comision: "0" }); setEditingVendedor(null); }}}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo Vendedor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingVendedor ? "Editar Vendedor" : "Nuevo Vendedor"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      placeholder="Nombre del vendedor"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comision">Comision %</Label>
                    <Input
                      id="comision"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={form.comision}
                      onChange={(e) => setForm({ ...form, comision: e.target.value })}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">{editingVendedor ? "Guardar" : "Crear"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <DataTable
            columns={columns}
            data={filteredVendedores}
            emptyMessage={isLoading ? "Cargando..." : "No hay vendedores"}
          />
        </TabsContent>

        <TabsContent value="comisiones" className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Mes:</Label>
            <Input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Total Comisiones del Mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatCurrency(totalComisiones)}</p>
            </CardContent>
          </Card>

          <DataTable
            columns={comisionesColumns}
            data={comisionesPorVendedor}
            emptyMessage="No hay ventas en este período"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
