"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { CurrencyDisplay } from "./currency-display"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatDate, formatMonto, parseMonto } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface Pago {
  id: string
  fecha: string
  proveedor_nombre: string
  monto: number
  metodo_pago?: string
  observaciones?: string
}

interface Proveedor {
  id: string
  nombre: string
}

export function PagosContent() {
  const { data: pagos = [], isLoading, mutate } = useSupabase<Pago>("pagos")
  const { data: proveedores = [] } = useSupabase<Proveedor>("proveedores")
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [filtroProveedor, setFiltroProveedor] = useState("")
  const [filtroMetodo, setFiltroMetodo] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    proveedor_nombre: "",
    monto: "",
    metodo_pago: "",
    observaciones: ""
  })
  const [editingPago, setEditingPago] = useState<Pago | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    fecha: "",
    proveedor_nombre: "",
    monto: "",
    metodo_pago: "",
    observaciones: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await insertRow("pagos", {
        fecha: formData.fecha,
        proveedor_nombre: formData.proveedor_nombre,
        monto: parseMonto(formData.monto),
        metodo_pago: formData.metodo_pago || null,
        observaciones: formData.observaciones || null
      })
      await mutate()
      setIsDialogOpen(false)
      setFormData({ fecha: new Date().toISOString().split('T')[0], proveedor_nombre: "", monto: "", metodo_pago: "", observaciones: "" })
      toast({ title: "Pago registrado", description: `${formData.proveedor_nombre} — ${formData.monto}` })
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err?.message ?? "No se pudo registrar el pago", variant: "destructive" })
    }
  }

  const handleEdit = (pago: Pago) => {
    setEditingPago(pago)
    setEditFormData({
      fecha: pago.fecha?.split('T')[0] ?? "",
      proveedor_nombre: pago.proveedor_nombre ?? "",
      monto: pago.monto != null ? formatMonto(String(Math.round(pago.monto))) : "",
      metodo_pago: pago.metodo_pago ?? "",
      observaciones: pago.observaciones ?? ""
    })
    setIsEditDialogOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPago) return
    try {
      await updateRow("pagos", editingPago.id, {
        fecha: editFormData.fecha,
        proveedor_nombre: editFormData.proveedor_nombre,
        monto: parseMonto(editFormData.monto),
        metodo_pago: editFormData.metodo_pago || null,
        observaciones: editFormData.observaciones || null
      })
      await mutate()
      setIsEditDialogOpen(false)
      setEditingPago(null)
      toast({ title: "Pago actualizado", description: "Los cambios se guardaron correctamente." })
    } catch (err: any) {
      toast({ title: "Error al actualizar", description: err.message, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRow("pagos", id)
      await mutate()
      toast({ title: "Pago eliminado" })
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" })
    }
  }

  const metodosUnicos = [...new Set(pagos.map(p => p.metodo_pago).filter(Boolean))] as string[]

  const filteredPagos = pagos
    .filter((p) => !searchTerm || p.proveedor_nombre.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((p) => !fechaDesde || p.fecha >= fechaDesde)
    .filter((p) => !fechaHasta || p.fecha <= fechaHasta)
    .filter((p) => !filtroProveedor || filtroProveedor === "__todos__" || p.proveedor_nombre === filtroProveedor)
    .filter((p) => !filtroMetodo || filtroMetodo === "__todos__" || p.metodo_pago === filtroMetodo)

  const columns = [
    { key: "fecha", header: "Fecha", render: (p: Pago) => formatDate(new Date(p.fecha)) },
    { key: "proveedor_nombre", header: "Proveedor" },
    { key: "monto", header: "Monto", render: (p: Pago) => <CurrencyDisplay amount={Number(p.monto)} className="font-semibold text-destructive" /> },
    { key: "metodo_pago", header: "Metodo", render: (p: Pago) => p.metodo_pago || "-", mobileHidden: true },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar pagos..."
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
        <Select value={filtroMetodo || "__todos__"} onValueChange={v => setFiltroMetodo(v === "__todos__" ? "" : v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Método" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los métodos</SelectItem>
            {metodosUnicos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        {(fechaDesde || fechaHasta || filtroProveedor || filtroMetodo) && (
          <Button variant="outline" size="sm" onClick={() => { setFechaDesde(""); setFechaHasta(""); setFiltroProveedor(""); setFiltroMetodo("") }}>Limpiar filtros</Button>
        )}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="ml-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Pago
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Pago</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={formData.fecha} max={new Date().toISOString().split('T')[0]} onChange={(e) => setFormData({...formData, fecha: e.target.value})} required />
              </div>
              <div>
                <Label>Proveedor</Label>
                <Select value={formData.proveedor_nombre} onValueChange={(value) => setFormData({...formData, proveedor_nombre: value})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
                  <SelectContent>
                    {proveedores.map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monto</Label>
                <Input type="text" inputMode="numeric" placeholder="0" value={formData.monto} onChange={(e) => setFormData({...formData, monto: formatMonto(e.target.value)})} required />
              </div>
              <div>
                <Label>Metodo de Pago</Label>
                <Select value={formData.metodo_pago} onValueChange={(value) => setFormData({...formData, metodo_pago: value})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar metodo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Cuenta Francisco">Cuenta Francisco</SelectItem>
                    <SelectItem value="Cuenta Diego">Cuenta Diego</SelectItem>
                    <SelectItem value="MercadoPago">MercadoPago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observaciones</Label>
                <Input value={formData.observaciones} onChange={(e) => setFormData({...formData, observaciones: e.target.value})} />
              </div>
              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={filteredPagos}
        emptyMessage={isLoading ? "Cargando..." : "No hay pagos registrados"}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pago</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={editFormData.fecha} max={new Date().toISOString().split('T')[0]} onChange={(e) => setEditFormData({ ...editFormData, fecha: e.target.value })} required />
            </div>
            <div>
              <Label>Proveedor</Label>
              <Select value={editFormData.proveedor_nombre} onValueChange={(value) => setEditFormData({ ...editFormData, proveedor_nombre: value })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
                <SelectContent>
                  {proveedores.map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monto</Label>
              <Input type="text" inputMode="numeric" placeholder="0" value={editFormData.monto} onChange={(e) => setEditFormData({ ...editFormData, monto: formatMonto(e.target.value) })} required />
            </div>
            <div>
              <Label>Metodo de Pago</Label>
              <Select value={editFormData.metodo_pago} onValueChange={(value) => setEditFormData({ ...editFormData, metodo_pago: value })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar metodo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Input value={editFormData.observaciones} onChange={(e) => setEditFormData({ ...editFormData, observaciones: e.target.value })} />
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
