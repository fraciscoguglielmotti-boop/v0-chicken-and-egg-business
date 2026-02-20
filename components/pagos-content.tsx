"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { useSupabase, insertRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"

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
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    proveedor_nombre: "",
    monto: "",
    metodo_pago: "",
    observaciones: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await insertRow("pagos", {
      fecha: formData.fecha,
      proveedor_nombre: formData.proveedor_nombre,
      monto: parseFloat(formData.monto),
      metodo_pago: formData.metodo_pago || null,
      observaciones: formData.observaciones || null
    })
    mutate()
    setIsDialogOpen(false)
    setFormData({ fecha: new Date().toISOString().split('T')[0], proveedor_nombre: "", monto: "", metodo_pago: "", observaciones: "" })
  }

  const filteredPagos = pagos.filter((p) =>
    p.proveedor_nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns = [
    { key: "fecha", header: "Fecha", render: (p: Pago) => formatDate(new Date(p.fecha)) },
    { key: "proveedor_nombre", header: "Proveedor" },
    { key: "monto", header: "Monto", render: (p: Pago) => <span className="font-semibold text-destructive">{formatCurrency(Number(p.monto))}</span> },
    { key: "metodo_pago", header: "Metodo", render: (p: Pago) => p.metodo_pago || "-" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar pagos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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
                <Input type="date" value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} required />
              </div>
              <div>
                <Label>Proveedor</Label>
                <Input list="proveedores-pagos" value={formData.proveedor_nombre} onChange={(e) => setFormData({...formData, proveedor_nombre: e.target.value})} required />
                <datalist id="proveedores-pagos">
                  {proveedores.map(p => <option key={p.id} value={p.nombre} />)}
                </datalist>
              </div>
              <div>
                <Label>Monto</Label>
                <Input type="number" step="0.01" value={formData.monto} onChange={(e) => setFormData({...formData, monto: e.target.value})} required />
              </div>
              <div>
                <Label>Metodo de Pago</Label>
                <Input value={formData.metodo_pago} onChange={(e) => setFormData({...formData, metodo_pago: e.target.value})} placeholder="Efectivo, Transferencia, etc." />
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
      />
    </div>
  )
}
