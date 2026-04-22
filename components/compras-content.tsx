"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { CurrencyDisplay } from "./currency-display"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { LoadingTable } from "@/components/loading-states"

interface Compra {
  id: string
  fecha: string
  proveedor_nombre: string
  producto: string
  cantidad: number
  precio_unitario: number
  total: number
  estado: string
  verificado: boolean
  numero_lote?: string
  modalidad?: "planta" | "envio"
}

interface Proveedor {
  id: string
  nombre: string
}

interface Producto {
  id: string
  nombre: string
  activo: boolean
}

const emptyForm = () => ({
  fecha: new Date().toISOString().split("T")[0],
  proveedor_nombre: "",
  producto: "",
  cantidad: "",
  precio_unitario: "",
  estado: "pendiente",
  verificado: false,
  modalidad: "planta" as "planta" | "envio",
})

export function ComprasContent() {
  const { data: compras = [], isLoading, mutate } = useSupabase<Compra>("compras")
  const { data: proveedores = [] } = useSupabase<Proveedor>("proveedores")
  const { data: productos = [] } = useSupabase<Producto>("productos")
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState("")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [filtroProveedor, setFiltroProveedor] = useState("")
  const [filtroProducto, setFiltroProducto] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState(emptyForm())
  const [editingCompra, setEditingCompra] = useState<Compra | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editFormData, setEditFormData] = useState(emptyForm())

  const productosActivos = productos.filter((p) => p.activo)

  // ── Genera el próximo número de lote (L001, L002, ...) ──────────────────────
  const generarNumeroLote = (): string => {
    const nums = compras
      .map((c) => c.numero_lote)
      .filter(Boolean)
      .map((n) => {
        const m = n!.match(/^L(\d+)$/)
        return m ? parseInt(m[1], 10) : 0
      })
    const siguiente = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `L${String(siguiente).padStart(3, "0")}`
  }

  // ── Nueva compra ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const cantidad = parseFloat(formData.cantidad)
      const precio = parseFloat(formData.precio_unitario)
      const numero_lote = generarNumeroLote()
      await insertRow("compras", {
        fecha: formData.fecha,
        proveedor_nombre: formData.proveedor_nombre,
        producto: formData.producto,
        cantidad,
        precio_unitario: precio,
        total: cantidad * precio,
        estado: formData.estado,
        verificado: formData.verificado,
        numero_lote,
        modalidad: formData.modalidad,
      })
      await mutate()
      setIsDialogOpen(false)
      setFormData(emptyForm())
      toast({ title: `Compra registrada — Lote ${numero_lote}`, description: `${formData.proveedor_nombre} — ${formData.producto}` })
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err?.message ?? "No se pudo registrar la compra", variant: "destructive" })
    }
  }

  // ── Editar compra ───────────────────────────────────────────────────────────
  const handleEdit = (compra: Compra) => {
    setEditingCompra(compra)
    setEditFormData({
      fecha: compra.fecha?.split("T")[0] ?? "",
      proveedor_nombre: compra.proveedor_nombre ?? "",
      producto: compra.producto ?? "",
      cantidad: String(compra.cantidad ?? ""),
      precio_unitario: String(compra.precio_unitario ?? ""),
      estado: compra.estado ?? "pendiente",
      verificado: compra.verificado ?? false,
      modalidad: compra.modalidad ?? "planta",
    })
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRow("compras", id)
      await mutate()
      toast({ title: "Compra eliminada" })
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" })
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCompra) return
    try {
      const cantidad = parseFloat(editFormData.cantidad)
      const precio = parseFloat(editFormData.precio_unitario)
      await updateRow("compras", editingCompra.id, {
        fecha: editFormData.fecha,
        proveedor_nombre: editFormData.proveedor_nombre,
        producto: editFormData.producto,
        cantidad,
        precio_unitario: precio,
        total: cantidad * precio,
        estado: editFormData.estado,
        verificado: editFormData.verificado,
        modalidad: editFormData.modalidad,
      })
      await mutate()
      setIsEditDialogOpen(false)
      setEditingCompra(null)
      toast({ title: "Compra actualizada" })
    } catch (err: any) {
      toast({ title: "Error al actualizar", description: err.message, variant: "destructive" })
    }
  }

  const filteredCompras = compras
    .filter((c) =>
      !searchTerm ||
      c.proveedor_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.numero_lote ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((c) => !fechaDesde || c.fecha >= fechaDesde)
    .filter((c) => !fechaHasta || c.fecha <= fechaHasta)
    .filter((c) => !filtroProveedor || filtroProveedor === "__todos__" || c.proveedor_nombre === filtroProveedor)
    .filter((c) => !filtroProducto || filtroProducto === "__todos__" || c.producto === filtroProducto)
    .filter((c) => !filtroEstado || filtroEstado === "__todos__" || c.estado === filtroEstado)

  if (isLoading) return <LoadingTable />

  const columns = [
    { key: "numero_lote", header: "Lote", render: (c: Compra) => c.numero_lote ? <Badge variant="outline" className="font-mono text-xs">{c.numero_lote}</Badge> : <span className="text-muted-foreground text-xs">—</span> },
    { key: "fecha", header: "Fecha", render: (c: Compra) => formatDate(new Date(c.fecha)) },
    { key: "proveedor_nombre", header: "Proveedor" },
    { key: "producto", header: "Producto" },
    { key: "modalidad", header: "Modalidad", render: (c: Compra) => (
      <Badge variant={c.modalidad === "envio" ? "secondary" : "outline"} className="text-xs">
        {c.modalidad === "envio" ? "Envío" : "Planta"}
      </Badge>
    )},
    { key: "cantidad", header: "Cantidad", mobileHidden: true },
    { key: "precio_unitario", header: "Precio Unit.", render: (c: Compra) => <CurrencyDisplay amount={c.precio_unitario} />, mobileHidden: true },
    { key: "total", header: "Total", render: (c: Compra) => <CurrencyDisplay amount={c.total} className="font-semibold" /> },
    { key: "estado", header: "Estado", render: (c: Compra) => (
      <Badge variant={c.estado === "pagado" ? "default" : "outline"}>{c.estado}</Badge>
    )},
    { key: "verificado", header: "Verificado", render: (c: Compra) => (
      <Badge
        variant={c.verificado ? "default" : "outline"}
        className="cursor-pointer select-none"
        onClick={async (e) => {
          e.stopPropagation()
          try {
            await updateRow("compras", c.id, { verificado: !c.verificado })
            await mutate()
          } catch (err: any) {
            toast({ title: "Error", description: err?.message ?? "No se pudo actualizar", variant: "destructive" })
          }
        }}
      >
        {c.verificado ? "✓" : "—"}
      </Badge>
    )},
  ]

  // ── Form fields reutilizables ───────────────────────────────────────────────
  const renderFormFields = (
    data: typeof formData,
    set: (v: typeof formData) => void
  ) => (
    <>
      <div>
        <Label>Fecha</Label>
        <Input
          type="date"
          value={data.fecha}
          max={new Date().toISOString().split("T")[0]}
          onChange={(e) => set({ ...data, fecha: e.target.value })}
          required
        />
      </div>
      <div>
        <Label>Proveedor</Label>
        <Select value={data.proveedor_nombre} onValueChange={(v) => set({ ...data, proveedor_nombre: v })}>
          <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
          <SelectContent>
            {proveedores.map((p) => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Producto</Label>
        <Select value={data.producto} onValueChange={(v) => set({ ...data, producto: v })} required>
          <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
          <SelectContent>
            {productosActivos.map((p) => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Cantidad</Label>
          <Input type="number" step="0.01" value={data.cantidad} onChange={(e) => set({ ...data, cantidad: e.target.value })} required />
        </div>
        <div>
          <Label>Precio Unitario</Label>
          <Input type="number" step="0.01" value={data.precio_unitario} onChange={(e) => set({ ...data, precio_unitario: e.target.value })} required />
        </div>
      </div>
      {/* Modalidad Planta / Envío */}
      <div>
        <Label>Modalidad de entrega</Label>
        <div className="flex gap-3 mt-1">
          {(["planta", "envio"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set({ ...data, modalidad: m })}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                data.modalidad === m
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {m === "planta" ? "🏭 Retiro en Planta" : "🚚 Envío a domicilio"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Estado</Label>
        <Select value={data.estado} onValueChange={(v) => set({ ...data, estado: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="pagado">Pagado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`verificado_${data.fecha}`}
          checked={data.verificado}
          onCheckedChange={(checked) => set({ ...data, verificado: checked as boolean })}
        />
        <Label htmlFor={`verificado_${data.fecha}`} className="cursor-pointer text-sm">
          Verificado en cuenta corriente del proveedor
        </Label>
      </div>
    </>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por proveedor, producto o lote..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Desde:</Label>
          <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Hasta:</Label>
          <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-auto" />
        </div>
        <Select value={filtroProveedor || "__todos__"} onValueChange={v => setFiltroProveedor(v === "__todos__" ? "" : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Proveedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los proveedores</SelectItem>
            {proveedores.map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroProducto || "__todos__"} onValueChange={v => setFiltroProducto(v === "__todos__" ? "" : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Producto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los productos</SelectItem>
            {productosActivos.map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroEstado || "__todos__"} onValueChange={v => setFiltroEstado(v === "__todos__" ? "" : v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="pagado">Pagado</SelectItem>
          </SelectContent>
        </Select>
        {(fechaDesde || fechaHasta || filtroProveedor || filtroProducto || filtroEstado) && (
          <Button variant="outline" size="sm" onClick={() => { setFechaDesde(""); setFechaHasta(""); setFiltroProveedor(""); setFiltroProducto(""); setFiltroEstado("") }}>Limpiar filtros</Button>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="ml-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Compra
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Compra</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {renderFormFields(formData, setFormData)}
              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={filteredCompras}
        emptyMessage={isLoading ? "Cargando..." : "No hay compras registradas"}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar Compra
              {editingCompra?.numero_lote && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">— Lote {editingCompra.numero_lote}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {renderFormFields(editFormData, setEditFormData)}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Guardar cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
