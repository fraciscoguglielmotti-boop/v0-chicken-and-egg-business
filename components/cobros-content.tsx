"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { useSupabase, insertRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface Cobro {
  id: string
  fecha: string
  cliente_nombre: string
  monto: number
  metodo_pago?: string
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

export function CobrosContent() {
  const { data: cobros = [], isLoading, mutate } = useSupabase<Cobro>("cobros")
  const { data: clientes = [] } = useSupabase<Cliente>("clientes")
  const { data: proveedores = [] } = useSupabase<Proveedor>("proveedores")
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    cliente_nombre: "",
    monto: "",
    metodo_pago: "",
    observaciones: "",
    verificado_agroaves: false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Crear el cobro
      await insertRow("cobros", {
        fecha: formData.fecha,
        cliente_nombre: formData.cliente_nombre,
        monto: parseFloat(formData.monto),
        metodo_pago: formData.metodo_pago || null,
        observaciones: formData.observaciones || null,
        verificado_agroaves: formData.verificado_agroaves
      })

      // Si está verificado para agroaves, crear automáticamente un pago al proveedor
      if (formData.verificado_agroaves) {
        const proveedorAgroaves = proveedores.find(p => 
          p.nombre.toLowerCase().includes('agroaves') || 
          p.nombre.toLowerCase().includes('agro aves')
        )

        if (proveedorAgroaves) {
          await insertRow("pagos", {
            fecha: formData.fecha,
            proveedor_nombre: proveedorAgroaves.nombre,
            monto: parseFloat(formData.monto),
            metodo_pago: "Transferencia de cliente",
            observaciones: `Pago automático desde cobro de ${formData.cliente_nombre}`
          })
          
          toast({
            title: "Cobro y pago registrados",
            description: `Se creó automáticamente el pago a ${proveedorAgroaves.nombre}`,
          })
        } else {
          toast({
            title: "Cobro registrado",
            description: "Advertencia: No se encontró proveedor Agroaves para crear el pago automático",
            variant: "destructive"
          })
        }
      } else {
        toast({
          title: "Cobro registrado",
          description: "El cobro se ha guardado correctamente",
        })
      }

      mutate()
      setIsDialogOpen(false)
      setFormData({ 
        fecha: new Date().toISOString().split('T')[0], 
        cliente_nombre: "", 
        monto: "", 
        metodo_pago: "", 
        observaciones: "", 
        verificado_agroaves: false 
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo registrar el cobro",
        variant: "destructive"
      })
    }
  }

  const filteredCobros = cobros.filter((c) =>
    c.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns = [
    { key: "fecha", header: "Fecha", render: (c: Cobro) => formatDate(new Date(c.fecha)) },
    { key: "cliente_nombre", header: "Cliente" },
    { key: "monto", header: "Monto", render: (c: Cobro) => <span className="font-semibold text-primary">{formatCurrency(Number(c.monto))}</span> },
    { key: "metodo_pago", header: "Metodo", render: (c: Cobro) => <span className="capitalize">{c.metodo_pago || "-"}</span> },
    { key: "verificado_agroaves", header: "A Agroaves", render: (c: Cobro) => (
      <Badge variant={c.verificado_agroaves ? "default" : "outline"}>
        {c.verificado_agroaves ? "Si" : "No"}
      </Badge>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cobros..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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
                <Input type="date" value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} required />
              </div>
              <div>
                <Label>Cliente</Label>
                <Input list="clientes-cobros" value={formData.cliente_nombre} onChange={(e) => setFormData({...formData, cliente_nombre: e.target.value})} required />
                <datalist id="clientes-cobros">
                  {clientes.map(c => <option key={c.id} value={c.nombre} />)}
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
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="verificado_agroaves"
                  checked={formData.verificado_agroaves} 
                  onCheckedChange={(checked) => setFormData({...formData, verificado_agroaves: checked as boolean})} 
                />
                <Label htmlFor="verificado_agroaves" className="cursor-pointer">
                  Pago directo a Agroaves (crea pago automático)
                </Label>
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
        data={filteredCobros}
        emptyMessage={isLoading ? "Cargando..." : "No hay cobros registrados"}
      />
    </div>
  )
}
