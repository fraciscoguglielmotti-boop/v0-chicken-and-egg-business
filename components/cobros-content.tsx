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

interface Cobro {
  id: string
  fecha: string
  cliente_nombre: string
  monto: number
  metodo_pago?: string
  cuenta_destino?: string
  observaciones?: string
  verificado_agroaves: boolean
}

interface Cliente {
  id: string
  nombre: string
}

interface Proveedor {
  id: string
  nombre: string
}

const CUENTAS_DESTINO = ["Agroaves", "Francisco", "Diego", "Otra"]

export function CobrosContent() {
  const { data: cobros = [], isLoading, mutate } = useSupabase<Cobro>("cobros")
  const { data: clientes = [] } = useSupabase<Cliente>("clientes")
  const { data: proveedores = [] } = useSupabase<Proveedor>("proveedores")
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    cliente_nombre: "",
    monto: "",
    metodo_pago: "efectivo",
    cuenta_destino: "",
    observaciones: "",
    verificado_agroaves: false
  })
  const [editingCobro, setEditingCobro] = useState<Cobro | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    fecha: "",
    cliente_nombre: "",
    monto: "",
    metodo_pago: "efectivo",
    cuenta_destino: "",
    observaciones: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await insertRow("cobros", {
        fecha: formData.fecha,
        cliente_nombre: formData.cliente_nombre,
        monto: parseFloat(formData.monto),
        metodo_pago: formData.metodo_pago,
        cuenta_destino: formData.metodo_pago === "transferencia" ? formData.cuenta_destino : null,
        observaciones: formData.observaciones || null,
        verificado_agroaves: formData.verificado_agroaves
      })

      if (formData.metodo_pago === "transferencia" && formData.cuenta_destino?.toLowerCase() === "agroaves") {
        const proveedorAgroaves = proveedores.find(p =>
          p.nombre.toLowerCase().includes('agroaves') ||
          p.nombre.toLowerCase().includes('agro aves')
        )
        if (proveedorAgroaves) {
          await insertRow("pagos", {
            fecha: formData.fecha,
            proveedor_nombre: proveedorAgroaves.nombre,
            monto: parseFloat(formData.monto),
            metodo_pago: "Transferencia directa",
            observaciones: `Transferencia directa desde ${formData.cliente_nombre}`
          })
          toast({ title: "Cobro y pago registrados", description: `Se creó automáticamente el pago a ${proveedorAgroaves.nombre}` })
        }
      } else {
        toast({ title: "Cobro registrado", description: "El cobro se ha guardado correctamente" })
      }

      mutate()
      setIsDialogOpen(false)
      setFormData({ fecha: new Date().toISOString().split('T')[0], cliente_nombre: "", monto: "", metodo_pago: "efectivo", cuenta_destino: "", observaciones: "", verificado_agroaves: false })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo registrar el cobro", variant: "destructive" })
    }
  }

  const handleEdit = (cobro: Cobro) => {
    setEditingCobro(cobro)
    setEditFormData({
      fecha: cobro.fecha?.split('T')[0] ?? "",
      cliente_nombre: cobro.cliente_nombre ?? "",
      monto: String(cobro.monto ?? ""),
      metodo_pago: cobro.metodo_pago ?? "efectivo",
      cuenta_destino: cobro.cuenta_destino ?? "",
      observaciones: cobro.observaciones ?? ""
    })
    setIsEditDialogOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCobro) return
    try {
      await updateRow("cobros", editingCobro.id, {
        fecha: editFormData.fecha,
        cliente_nombre: editFormData.cliente_nombre,
        monto: parseFloat(editFormData.monto),
        metodo_pago: editFormData.metodo_pago,
        cuenta_destino: editFormData.metodo_pago === "transferencia" ? editFormData.cuenta_destino : null,
        observaciones: editFormData.observaciones || null
      })
      await mutate()
      setIsEditDialogOpen(false)
      setEditingCobro(null)
      toast({ title: "Cobro actualizado", description: "Los cambios se guardaron correctamente." })
    } catch (err: any) {
      toast({ title: "Error al actualizar", description: err.message, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRow("cobros", id)
      mutate()
      toast({ title: "Cobro eliminado" })
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" })
    }
  }

  const filteredCobros = cobros
    .filter((c) => c.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((c) => !fechaDesde || c.fecha >= fechaDesde)
    .filter((c) => !fechaHasta || c.fecha <= fechaHasta)

  const columns = [
    { key: "fecha", header: "Fecha", render: (c: Cobro) => formatDate(new Date(c.fecha)) },
    { key: "cliente_nombre", header: "Cliente" },
    { key: "monto", header: "Monto", render: (c: Cobro) => <CurrencyDisplay amount={Number(c.monto)} className="font-semibold text-primary" /> },
    { key: "metodo_pago", header: "Metodo", render: (c: Cobro) => <span className="capitalize">{c.metodo_pago || "-"}</span> },
    { key: "cuenta_destino", header: "Destino", render: (c: Cobro) => c.cuenta_destino || "-" },
    { key: "verificado_agroaves", header: "Verificado", render: (c: Cobro) => (
      <Badge
        variant={c.verificado_agroaves ? "default" : "outline"}
        className="cursor-pointer select-none"
        onClick={async (e) => {
          e.stopPropagation()
          try {
            await updateRow("cobros", c.id, { verificado_agroaves: !c.verificado_agroaves })
            mutate()
          } catch (err: any) {
            toast({ title: "Error", description: err?.message ?? "No se pudo actualizar", variant: "destructive" })
          }
        }}
      >
        {c.verificado_agroaves ? "✓" : "-"}
      </Badge>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cobros..."
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
        {(fechaDesde || fechaHasta) && (
          <Button variant="outline" size="sm" onClick={() => { setFechaDesde(""); setFechaHasta("") }}>Limpiar</Button>
        )}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="ml-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Cobro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Cobro</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={formData.fecha} max={new Date().toISOString().split('T')[0]} onChange={(e) => setFormData({...formData, fecha: e.target.value})} required />
              </div>
              <div>
                <Label>Cliente</Label>
                <Select value={formData.cliente_nombre} onValueChange={(value) => setFormData({...formData, cliente_nombre: value})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monto</Label>
                <Input type="number" step="0.01" value={formData.monto} onChange={(e) => setFormData({...formData, monto: e.target.value})} required />
              </div>
              <div>
                <Label>Metodo de Pago</Label>
                <Select value={formData.metodo_pago} onValueChange={(value) => setFormData({...formData, metodo_pago: value})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar metodo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.metodo_pago === "transferencia" && (
                <div>
                  <Label>Cuenta Destino</Label>
                  <Select value={formData.cuenta_destino} onValueChange={(value) => setFormData({...formData, cuenta_destino: value})}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                    <SelectContent>
                      {CUENTAS_DESTINO.map(cuenta => <SelectItem key={cuenta} value={cuenta}>{cuenta}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Observaciones</Label>
                <Input value={formData.observaciones} onChange={(e) => setFormData({...formData, observaciones: e.target.value})} />
              </div>
              {formData.metodo_pago === "transferencia" && formData.cuenta_destino?.toLowerCase() === "agroaves" && (
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox id="verificado_agroaves" checked={formData.verificado_agroaves} onCheckedChange={(checked) => setFormData({...formData, verificado_agroaves: checked as boolean})} />
                    <Label htmlFor="verificado_agroaves" className="cursor-pointer text-sm">Verificar como pago a proveedor</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-6">Esto creará automáticamente un pago al proveedor Agroaves</p>
                </div>
              )}
              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={filteredCobros}
        emptyMessage={isLoading ? "Cargando..." : "No hay cobros registrados"}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cobro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={editFormData.fecha} max={new Date().toISOString().split('T')[0]} onChange={(e) => setEditFormData({ ...editFormData, fecha: e.target.value })} required />
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={editFormData.cliente_nombre} onValueChange={(value) => setEditFormData({ ...editFormData, cliente_nombre: value })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {clientes.map(c => <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monto</Label>
              <Input type="number" step="0.01" value={editFormData.monto} onChange={(e) => setEditFormData({ ...editFormData, monto: e.target.value })} required />
            </div>
            <div>
              <Label>Metodo de Pago</Label>
              <Select value={editFormData.metodo_pago} onValueChange={(value) => setEditFormData({ ...editFormData, metodo_pago: value })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar metodo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editFormData.metodo_pago === "transferencia" && (
              <div>
                <Label>Cuenta Destino</Label>
                <Select value={editFormData.cuenta_destino} onValueChange={(value) => setEditFormData({ ...editFormData, cuenta_destino: value })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                  <SelectContent>
                    {CUENTAS_DESTINO.map(cuenta => <SelectItem key={cuenta} value={cuenta}>{cuenta}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
