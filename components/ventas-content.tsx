"use client"

import { useState, useEffect } from "react"
import { Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { CurrencyDisplay } from "./currency-display"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { LoadingTable } from "@/components/loading-states"

interface Venta {
  id: string
  fecha: string
  cliente_nombre: string
  producto_nombre?: string
  cantidad: number
  precio_unitario: number
  vendedor?: string
  observaciones?: string
  fecha_vto_cobro?: string
  cobrado?: boolean
}

interface Cliente {
  id: string
  nombre: string
  vendedor_nombre?: string
  condicion_pago?: string
  plazo_dias?: number
  dia_pago?: number
}

function calcVencimiento(fechaVenta: string, cliente: Cliente | undefined): string {
  if (!cliente || !fechaVenta) return fechaVenta
  const d = new Date(fechaVenta + 'T12:00:00Z')
  switch (cliente.condicion_pago) {
    case 'dias': {
      d.setUTCDate(d.getUTCDate() + (cliente.plazo_dias ?? 0))
      return d.toISOString().split('T')[0]
    }
    case 'dia_semana': {
      // 1=Lunes, 7=Domingo → JS 0=Dom, 1=Lun
      const target = ((cliente.dia_pago ?? 1) % 7)
      const daysToAdd = (target - d.getUTCDay() + 7) % 7 || 7
      d.setUTCDate(d.getUTCDate() + daysToAdd)
      return d.toISOString().split('T')[0]
    }
    case 'dia_mes': {
      const targetDay = cliente.dia_pago ?? 1
      const thisMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), targetDay))
      const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, targetDay))
      return (thisMonth > d ? thisMonth : nextMonth).toISOString().split('T')[0]
    }
    default:
      return fechaVenta
  }
}

interface Vendedor {
  id: string
  nombre: string
}

interface Producto {
  id: string
  nombre: string
  activo: boolean
}

export function VentasContent() {
  const { data: ventas = [], isLoading, mutate } = useSupabase<Venta>("ventas")
  const { data: clientes = [] } = useSupabase<Cliente>("clientes")
  const { data: productos = [] } = useSupabase<Producto>("productos")
  const { data: vendedores = [] } = useSupabase<Vendedor>("vendedores")
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [filtroProducto, setFiltroProducto] = useState("")
  const [filtroVendedor, setFiltroVendedor] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  const emptyLinea = () => ({ producto: "", cantidad: "", precio_unitario: "" })
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    cliente_nombre: "",
    vendedor: "",
    lineas: [emptyLinea()],
    fecha_vto_cobro: new Date().toISOString().split('T')[0],
  })

  // Auto-recalcular vencimiento cuando cambia cliente o fecha
  const recalcVto = (fecha: string, clienteNombre: string) => {
    const cliente = clientes.find(c => c.nombre === clienteNombre)
    return calcVencimiento(fecha, cliente)
  }
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingVenta, setEditingVenta] = useState<Venta | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    fecha: "",
    cliente_nombre: "",
    producto_nombre: "",
    cantidad: "",
    precio_unitario: "",
    vendedor: "",
    observaciones: ""
  })

  const productosActivos = productos.filter(p => p.activo)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    const lineasValidas = formData.lineas.filter(l => l.producto && l.cantidad && l.precio_unitario)
    if (lineasValidas.length === 0) return
    setIsSubmitting(true)
    try {
      await Promise.all(lineasValidas.map(l =>
        insertRow("ventas", {
          fecha: formData.fecha,
          cliente_nombre: formData.cliente_nombre,
          producto_nombre: l.producto,
          cantidad: parseFloat(l.cantidad),
          precio_unitario: parseFloat(l.precio_unitario),
          vendedor: formData.vendedor || null,
          fecha_vto_cobro: formData.fecha_vto_cobro || null,
          cobrado: false,
        })
      ))
      await mutate()
      setIsDialogOpen(false)
      const hoy = new Date().toISOString().split('T')[0]
      setFormData({ fecha: hoy, cliente_nombre: "", vendedor: "", lineas: [emptyLinea()], fecha_vto_cobro: hoy })
      toast({
        title: lineasValidas.length === 1 ? "Venta registrada" : `${lineasValidas.length} ventas registradas`,
        description: `${formData.cliente_nombre} — ${lineasValidas.map(l => l.producto).join(", ")}`
      })
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err?.message ?? "Error desconocido", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateLinea = (i: number, field: string, value: string) => {
    const lineas = formData.lineas.map((l, idx) => idx === i ? { ...l, [field]: value } : l)
    setFormData({ ...formData, lineas })
  }

  const addLinea = () => setFormData({ ...formData, lineas: [...formData.lineas, emptyLinea()] })

  const removeLinea = (i: number) => {
    if (formData.lineas.length === 1) return
    setFormData({ ...formData, lineas: formData.lineas.filter((_, idx) => idx !== i) })
  }

  const handleEdit = (venta: Venta) => {
    setEditingVenta(venta)
    setEditFormData({
      fecha: venta.fecha?.split('T')[0] ?? "",
      cliente_nombre: venta.cliente_nombre ?? "",
      producto_nombre: venta.producto_nombre ?? "",
      cantidad: String(venta.cantidad ?? ""),
      precio_unitario: String(venta.precio_unitario ?? ""),
      vendedor: venta.vendedor ?? clientes.find(c => c.nombre === venta.cliente_nombre)?.vendedor_nombre ?? "",
      observaciones: venta.observaciones ?? ""
    })
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRow("ventas", id)
      await mutate()
      toast({ title: "Venta eliminada" })
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" })
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingVenta) return
    try {
      await updateRow("ventas", editingVenta.id, {
        fecha: editFormData.fecha,
        cliente_nombre: editFormData.cliente_nombre,
        producto_nombre: editFormData.producto_nombre || null,
        cantidad: parseFloat(editFormData.cantidad),
        precio_unitario: parseFloat(editFormData.precio_unitario),
        vendedor: editFormData.vendedor || null,
      })
      await mutate()
      setIsEditDialogOpen(false)
      setEditingVenta(null)
      toast({ title: "Venta actualizada", description: "Los cambios se guardaron correctamente." })
    } catch (err: any) {
      toast({ title: "Error al actualizar", description: err.message, variant: "destructive" })
    }
  }

  const filteredVentas = ventas
    .filter((v) => v.cliente_nombre.toLowerCase().includes(debouncedSearch.toLowerCase()))
    .filter((v) => !fechaDesde || v.fecha >= fechaDesde)
    .filter((v) => !fechaHasta || v.fecha <= fechaHasta)
    .filter((v) => !filtroProducto || (v.producto_nombre ?? "").toLowerCase().includes(filtroProducto.toLowerCase()))
    .filter((v) => !filtroVendedor || filtroVendedor === "__todos__" || v.vendedor === filtroVendedor)

  const handleMarcarCobrado = async (v: Venta) => {
    try {
      await updateRow("ventas", v.id, { cobrado: true })
      await mutate()
      toast({ title: "Marcada como cobrada", description: `${v.cliente_nombre}` })
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    }
  }

  const hoy = new Date().toISOString().split('T')[0]

  if (isLoading) return <LoadingTable />

  const columns = [
    { key: "fecha", header: "Fecha", render: (v: Venta) => formatDate(new Date(v.fecha)) },
    { key: "cliente_nombre", header: "Cliente" },
    { key: "producto_nombre", header: "Producto", render: (v: Venta) => v.producto_nombre || "-" },
    { key: "cantidad", header: "Cantidad", mobileHidden: true },
    { key: "precio_unitario", header: "Precio Unit.", render: (v: Venta) => <CurrencyDisplay amount={v.precio_unitario} />, mobileHidden: true },
    { key: "total", header: "Total", render: (v: Venta) => <CurrencyDisplay amount={v.cantidad * v.precio_unitario} className="font-semibold" /> },
    { key: "vendedor", header: "Vendedor", render: (v: Venta) => v.vendedor || "-", mobileHidden: true },
    { key: "cobrado", header: "Cobro", mobileHidden: true, render: (v: Venta) => {
      if (v.cobrado) return <Badge variant="default" className="text-xs">✓ Cobrado</Badge>
      if (!v.fecha_vto_cobro) return <span className="text-xs text-muted-foreground">—</span>
      const vencido = v.fecha_vto_cobro < hoy
      const dias = Math.ceil((new Date(v.fecha_vto_cobro).getTime() - new Date(hoy).getTime()) / 86400000)
      return (
        <div className="flex items-center gap-1.5">
          <Badge variant={vencido ? "destructive" : dias <= 3 ? "secondary" : "outline"} className="text-xs whitespace-nowrap">
            {vencido ? `Vencido ${Math.abs(dias)}d` : dias === 0 ? "Hoy" : `En ${dias}d`}
          </Badge>
          <button className="text-[10px] text-green-700 font-semibold hover:underline" onClick={e => { e.stopPropagation(); handleMarcarCobrado(v) }}>✓</button>
        </div>
      )
    }},
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar ventas..."
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
        <div className="relative min-w-[160px]">
          <Input
            placeholder="Producto..."
            value={filtroProducto}
            onChange={(e) => setFiltroProducto(e.target.value)}
          />
        </div>
        <Select value={filtroVendedor || "__todos__"} onValueChange={v => setFiltroVendedor(v === "__todos__" ? "" : v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los vendedores</SelectItem>
            {vendedores.map(v => <SelectItem key={v.id} value={v.nombre}>{v.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        {(fechaDesde || fechaHasta || filtroProducto || filtroVendedor) && (
          <Button variant="outline" size="sm" onClick={() => { setFechaDesde(""); setFechaHasta(""); setFiltroProducto(""); setFiltroVendedor("") }}>Limpiar filtros</Button>
        )}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="ml-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Venta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Venta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={formData.fecha}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      const vto = recalcVto(e.target.value, formData.cliente_nombre)
                      setFormData({...formData, fecha: e.target.value, fecha_vto_cobro: vto})
                    }}
                    required
                  />
                </div>
                <div>
                  <Label>Vendedor</Label>
                  <Select value={formData.vendedor} onValueChange={(v) => setFormData({ ...formData, vendedor: v === "__none__" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin asignar</SelectItem>
                      {vendedores.map(v => (
                        <SelectItem key={v.id} value={v.nombre}>{v.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Cliente</Label>
                <Select value={formData.cliente_nombre} onValueChange={(value) => {
                  const cliente = clientes.find(c => c.nombre === value)
                  const vto = calcVencimiento(formData.fecha, cliente)
                  setFormData({ ...formData, cliente_nombre: value, vendedor: cliente?.vendedor_nombre ?? formData.vendedor, fecha_vto_cobro: vto })
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Vencimiento cobro</Label>
                <Input
                  type="date"
                  value={formData.fecha_vto_cobro}
                  onChange={(e) => setFormData({ ...formData, fecha_vto_cobro: e.target.value })}
                />
                {formData.cliente_nombre && (() => {
                  const cliente = clientes.find(c => c.nombre === formData.cliente_nombre)
                  if (!cliente || !cliente.condicion_pago || cliente.condicion_pago === 'inmediato') return null
                  return <p className="text-xs text-muted-foreground mt-1">Calculado por condición de pago del cliente. Podés ajustarlo manualmente.</p>
                })()}
              </div>

              {/* Líneas de productos */}
              <div className="space-y-3">
                <Label>Artículos</Label>
                {formData.lineas.map((linea, i) => (
                  <div key={i} className="flex gap-2 items-start rounded-lg border p-3">
                    <div className="flex-1 space-y-2">
                      <Select value={linea.producto} onValueChange={(v) => updateLinea(i, "producto", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {productosActivos.map(p => (
                            <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Cantidad"
                          value={linea.cantidad}
                          onChange={(e) => updateLinea(i, "cantidad", e.target.value)}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Precio unit."
                          value={linea.precio_unitario}
                          onChange={(e) => updateLinea(i, "precio_unitario", e.target.value)}
                        />
                      </div>
                      {linea.cantidad && linea.precio_unitario && (
                        <p className="text-xs text-muted-foreground text-right">
                          Total: {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(parseFloat(linea.cantidad) * parseFloat(linea.precio_unitario))}
                        </p>
                      )}
                    </div>
                    {formData.lineas.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="mt-1 shrink-0 text-destructive" onClick={() => removeLinea(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={addLinea}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar artículo
                </Button>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isSubmitting || !formData.cliente_nombre || formData.lineas.every(l => !l.producto)}>
                  {isSubmitting ? "Guardando…" : `Guardar ${formData.lineas.filter(l => l.producto).length > 1 ? `(${formData.lineas.filter(l => l.producto).length} ventas)` : ""}`}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!isLoading && (debouncedSearch || fechaDesde || fechaHasta) && (
        <p className="text-sm text-muted-foreground">{filteredVentas.length} resultado{filteredVentas.length !== 1 ? "s" : ""}</p>
      )}
      <DataTable
        columns={columns}
        data={filteredVentas}
        emptyMessage={isLoading ? "Cargando..." : "No hay ventas registradas"}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Venta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={editFormData.fecha}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setEditFormData({ ...editFormData, fecha: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={editFormData.cliente_nombre} onValueChange={(value) => {
                const cliente = clientes.find(c => c.nombre === value)
                setEditFormData({ ...editFormData, cliente_nombre: value, vendedor: cliente?.vendedor_nombre ?? editFormData.vendedor })
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map(c => (
                    <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vendedor</Label>
              <Select value={editFormData.vendedor} onValueChange={(v) => setEditFormData({ ...editFormData, vendedor: v === "__none__" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin asignar</SelectItem>
                  {vendedores.map(v => (
                    <SelectItem key={v.id} value={v.nombre}>{v.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Producto</Label>
              <Select value={editFormData.producto_nombre} onValueChange={(value) => setEditFormData({ ...editFormData, producto_nombre: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {productosActivos.map(p => (
                    <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cantidad</Label>
                <Input type="number" step="0.01" value={editFormData.cantidad} onChange={(e) => setEditFormData({ ...editFormData, cantidad: e.target.value })} required />
              </div>
              <div>
                <Label>Precio Unitario</Label>
                <Input type="number" step="0.01" value={editFormData.precio_unitario} onChange={(e) => setEditFormData({ ...editFormData, precio_unitario: e.target.value })} required />
              </div>
            </div>
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
