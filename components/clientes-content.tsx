"use client"

import { useState } from "react"
import { Plus, Search, Phone, MapPin, CreditCard, User, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface Cliente {
  id: string
  nombre: string
  cuit?: string
  whatsapp?: string
  telefono?: string  // legacy — se lee para compatibilidad pero ya no se escribe
  direccion?: string
  saldo_inicial: number
  fecha_alta: string
  created_at: string
  vendedor_nombre?: string
  condicion_pago?: string
  plazo_dias?: number
  dia_pago?: number
}

const DIAS_SEMANA = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]

interface Vendedor {
  id: string
  nombre: string
}

interface Venta {
  id: string
  cliente_nombre: string
  cantidad: number
  precio_unitario: number
}

interface Cobro {
  id: string
  cliente_nombre: string
  monto: number
}

export function ClientesContent() {
  const { data: clientes = [], mutate, isLoading } = useSupabase<Cliente>("clientes")
  const { data: ventas = [] } = useSupabase<Venta>("ventas")
  const { data: cobros = [] } = useSupabase<Cobro>("cobros")
  const { data: vendedores = [] } = useSupabase<Vendedor>("vendedores")
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [form, setForm] = useState({
    nombre: "",
    cuit: "",
    whatsapp: "",
    direccion: "",
    saldo_inicial: "0",
    vendedor_nombre: "",
    condicion_pago: "inmediato",
    plazo_dias: "0",
    dia_pago: "1",
  })

  // WhatsApp phone dialog state
  const [waDialogOpen, setWaDialogOpen] = useState(false)
  const [waCliente, setWaCliente] = useState<Cliente | null>(null)
  const [waTempPhone, setWaTempPhone] = useState("")
  const [waSending, setWaSending] = useState(false)

  const filteredClientes = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cuit || "").includes(searchTerm)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const condData = {
        condicion_pago: form.condicion_pago,
        plazo_dias: form.condicion_pago === 'dias' ? Number(form.plazo_dias) : null,
        dia_pago: (form.condicion_pago === 'dia_semana' || form.condicion_pago === 'dia_mes') ? Number(form.dia_pago) : null,
      }
      if (editingCliente) {
        await updateRow("clientes", editingCliente.id, {
          nombre: form.nombre,
          cuit: form.cuit || null,
          whatsapp: form.whatsapp || null,
          direccion: form.direccion || null,
          saldo_inicial: Number(form.saldo_inicial),
          vendedor_nombre: form.vendedor_nombre || null,
          ...condData,
        })
      } else {
        await insertRow("clientes", {
          nombre: form.nombre,
          cuit: form.cuit || null,
          whatsapp: form.whatsapp || null,
          direccion: form.direccion || null,
          saldo_inicial: Number(form.saldo_inicial),
          fecha_alta: new Date().toISOString().split('T')[0],
          vendedor_nombre: form.vendedor_nombre || null,
          ...condData,
        })
      }
      await mutate()
      setDialogOpen(false)
      resetForm()
      toast({ title: editingCliente ? "Cliente actualizado" : "Cliente creado" })
    } catch (error: any) {
      console.error("[v0] Error guardando cliente:", error)
      toast({ title: "Error al guardar", description: error?.message ?? "No se pudo guardar el cliente", variant: "destructive" })
    }
  }

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente)
    setForm({
      nombre: cliente.nombre,
      cuit: cliente.cuit || "",
      whatsapp: cliente.whatsapp || cliente.telefono || "",
      direccion: cliente.direccion || "",
      saldo_inicial: String(cliente.saldo_inicial || 0),
      vendedor_nombre: cliente.vendedor_nombre || "",
      condicion_pago: cliente.condicion_pago || "inmediato",
      plazo_dias: String(cliente.plazo_dias || 0),
      dia_pago: String(cliente.dia_pago || 1),
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este cliente?")) return
    try {
      await deleteRow("clientes", id)
      await mutate()
      toast({ title: "Cliente eliminado" })
    } catch (error: any) {
      toast({ title: "Error al eliminar", description: error?.message ?? "No se pudo eliminar", variant: "destructive" })
    }
  }

  const resetForm = () => {
    setForm({ nombre: "", cuit: "", whatsapp: "", direccion: "", saldo_inicial: "0", vendedor_nombre: "", condicion_pago: "inmediato", plazo_dias: "0", dia_pago: "1" })
    setEditingCliente(null)
  }

  const labelCondicion = (c: Cliente) => {
    switch (c.condicion_pago) {
      case 'dias': return `${c.plazo_dias ?? 0} días`
      case 'dia_semana': return DIAS_SEMANA[(c.dia_pago ?? 1) - 1] ?? "—"
      case 'dia_mes': return `Día ${c.dia_pago}`
      default: return "Inmediato"
    }
  }

  const getClienteBalance = (nombre: string) => {
    const key = nombre.toLowerCase().trim()
    const totalVentas = ventas
      .filter(v => v.cliente_nombre.toLowerCase().trim() === key)
      .reduce((acc, v) => acc + v.cantidad * v.precio_unitario, 0)
    const totalCobrado = cobros
      .filter(c => c.cliente_nombre.toLowerCase().trim() === key)
      .reduce((acc, c) => acc + Number(c.monto), 0)
    return { totalVentas, totalCobrado, saldo: totalVentas - totalCobrado }
  }

  const sendWhatsApp = async (cliente: Cliente, telefono: string) => {
    setWaSending(true)
    try {
      const balance = getClienteBalance(cliente.nombre)
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono,
          clienteNombre: cliente.nombre,
          saldo: balance.saldo,
          totalVentas: balance.totalVentas,
          totalCobrado: balance.totalCobrado,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? "Error al enviar")
      }
      toast({ title: "WhatsApp enviado", description: `Estado de cuenta enviado a ${cliente.nombre}` })
      setWaDialogOpen(false)
      setWaTempPhone("")
    } catch (err) {
      toast({ title: "Error al enviar WhatsApp", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setWaSending(false)
    }
  }

  const handleWhatsAppClick = (cliente: Cliente) => {
    const numero = cliente.whatsapp || cliente.telefono
    if (numero) {
      sendWhatsApp(cliente, numero)
    } else {
      setWaCliente(cliente)
      setWaTempPhone("")
      setWaDialogOpen(true)
    }
  }

  const columns = [
    { key: "nombre", header: "Nombre", render: (c: Cliente) => <span className="font-medium">{c.nombre}</span> },
    { key: "cuit", header: "CUIT", render: (c: Cliente) => c.cuit || "-", mobileHidden: true },
    { key: "whatsapp", header: "Telefono", render: (c: Cliente) => c.whatsapp || c.telefono || "-" },
    { key: "direccion", header: "Direccion", render: (c: Cliente) => c.direccion || "-", mobileHidden: true },
    { key: "vendedor_nombre", header: "Vendedor", render: (c: Cliente) => c.vendedor_nombre || "-", mobileHidden: true },
    { key: "condicion_pago", header: "Cond. Pago", render: (c: Cliente) => <span className="text-sm text-muted-foreground">{labelCondicion(c)}</span>, mobileHidden: true },
    { key: "saldo_inicial", header: "Saldo Inicial", render: (c: Cliente) => <Badge variant={c.saldo_inicial > 0 ? "destructive" : "outline"}>{formatCurrency(c.saldo_inicial)}</Badge> },
    { key: "fecha_alta", header: "Fecha Alta", render: (c: Cliente) => formatDate(new Date(c.fecha_alta)), mobileHidden: true },
    {
      key: "whatsapp",
      header: "WhatsApp",
      render: (c: Cliente) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
          onClick={(e) => { e.stopPropagation(); handleWhatsAppClick(c) }}
          title="Enviar estado de cuenta por WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCliente ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="nombre"
                    placeholder="Nombre del cliente"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cuit">CUIT</Label>
                <Input
                  id="cuit"
                  placeholder="XX-XXXXXXXX-X"
                  value={form.cuit}
                  onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">Telefono</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="whatsapp"
                      placeholder="Telefono"
                      value={form.whatsapp}
                      onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saldo_inicial">Saldo Inicial</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="saldo_inicial"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.saldo_inicial}
                      onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccion">Direccion</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="direccion"
                    placeholder="Direccion completa"
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vendedor asignado</Label>
                <Select value={form.vendedor_nombre} onValueChange={(v) => setForm({ ...form, vendedor_nombre: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {vendedores.map(v => <SelectItem key={v.id} value={v.nombre}>{v.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label className="text-sm font-semibold">Condición de pago</Label>
                <Select value={form.condicion_pago} onValueChange={(v) => setForm({ ...form, condicion_pago: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inmediato">Inmediato (en el momento)</SelectItem>
                    <SelectItem value="dias">A X días de la venta</SelectItem>
                    <SelectItem value="dia_semana">Día fijo de la semana</SelectItem>
                    <SelectItem value="dia_mes">Día fijo del mes</SelectItem>
                  </SelectContent>
                </Select>
                {form.condicion_pago === 'dias' && (
                  <div className="flex items-center gap-2 mt-2">
                    <Label className="text-sm whitespace-nowrap">Plazo (días)</Label>
                    <Input type="number" min="1" max="365" value={form.plazo_dias} onChange={e => setForm({ ...form, plazo_dias: e.target.value })} className="w-24" />
                  </div>
                )}
                {form.condicion_pago === 'dia_semana' && (
                  <Select value={form.dia_pago} onValueChange={v => setForm({ ...form, dia_pago: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((d, i) => <SelectItem key={i+1} value={String(i+1)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {form.condicion_pago === 'dia_mes' && (
                  <div className="flex items-center gap-2 mt-2">
                    <Label className="text-sm whitespace-nowrap">Día del mes</Label>
                    <Input type="number" min="1" max="31" value={form.dia_pago} onChange={e => setForm({ ...form, dia_pago: e.target.value })} className="w-24" />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">{editingCliente ? "Guardar" : "Crear"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* WhatsApp phone dialog for clients without phone */}
      <Dialog open={waDialogOpen} onOpenChange={(open) => { setWaDialogOpen(open); if (!open) { setWaCliente(null); setWaTempPhone("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Enviar por WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {waCliente?.nombre} no tiene teléfono registrado. Ingresá el número para enviar el estado de cuenta.
            </p>
            <div className="space-y-2">
              <Label htmlFor="wa-phone">Número de WhatsApp</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="wa-phone"
                  placeholder="5491112345678"
                  value={waTempPhone}
                  onChange={(e) => setWaTempPhone(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">Formato internacional sin + (ej: 5491112345678)</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWaDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => waCliente && sendWhatsApp(waCliente, waTempPhone)}
              disabled={!waTempPhone || waSending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              {waSending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DataTable
        columns={columns}
        data={filteredClientes}
        emptyMessage={isLoading ? "Cargando..." : "No hay clientes"}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  )
}
