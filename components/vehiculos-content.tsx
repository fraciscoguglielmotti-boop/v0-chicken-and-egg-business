"use client"

import { useState } from "react"
import { Plus, Search, Pencil, Trash2, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "./data-table"
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Vehiculo {
  id: string
  patente: string
  marca: string
  modelo: string
  anio: string
  kilometraje: number
}

interface Mantenimiento {
  id: string
  vehiculo_id: string
  fecha: string
  tipo: string
  descripcion?: string
  kilometraje?: number
  costo: number
  taller?: string
  proximo_km?: number
  proxima_fecha?: string
  medio_pago?: string
  gasto_id?: string | null
}

const TIPOS_MANTENIMIENTO = [
  "Service",
  "Cambio Aceite",
  "Neumaticos",
  "Frenos",
  "Bateria",
  "Revision General",
  "Reparacion",
  "Otro"
]

const MEDIOS_PAGO = ["Efectivo", "Cuenta Francisco", "Cuenta Diego", "MercadoPago", "Tarjeta Credito"]
const CATEGORIA_GASTO_MANTENIMIENTO = "Mantenimiento Vehículos"

export function VehiculosContent() {
  const { data: vehiculos = [], isLoading: loadingVehiculos, mutate: mutateVehiculos } = useSupabase<Vehiculo>("vehiculos")
  const { data: mantenimientos = [], isLoading: loadingMantenimientos, mutate: mutateMantenimientos } = useSupabase<Mantenimiento>("mantenimientos")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isMantenimientoDialogOpen, setIsMantenimientoDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedVehiculo, setSelectedVehiculo] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    patente: "",
    marca: "",
    modelo: "",
    anio: "",
    kilometraje: ""
  })

  const [mantenimientoForm, setMantenimientoForm] = useState({
    vehiculo_id: "",
    fecha: new Date().toISOString().split('T')[0],
    tipo: "",
    descripcion: "",
    kilometraje: "",
    costo: "",
    taller: "",
    proximo_km: "",
    proxima_fecha: "",
    medio_pago: "Efectivo"
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = { ...formData, kilometraje: parseFloat(formData.kilometraje) || 0 }
    
    if (editingId) {
      await updateRow("vehiculos", editingId, data)
      setEditingId(null)
    } else {
      await insertRow("vehiculos", data)
    }
    mutateVehiculos()
    setIsDialogOpen(false)
    resetForm()
  }

  const handleMantenimientoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const costo = parseFloat(mantenimientoForm.costo) || 0
    const vehiculo = vehiculos.find(v => v.id === mantenimientoForm.vehiculo_id)
    const partes = [
      "Mantenimiento",
      mantenimientoForm.tipo,
      vehiculo?.patente ? `- ${vehiculo.patente}` : "",
      mantenimientoForm.descripcion ? `(${mantenimientoForm.descripcion})` : "",
    ].filter(Boolean)
    const descripcionGasto = partes.join(" ").trim()

    let gastoId: string | null = null
    if (costo > 0) {
      const gasto = await insertRow("gastos", {
        fecha: mantenimientoForm.fecha,
        tipo: "Egreso",
        categoria: CATEGORIA_GASTO_MANTENIMIENTO,
        descripcion: descripcionGasto,
        monto: costo,
        medio_pago: mantenimientoForm.medio_pago || "Efectivo",
        pagado: true,
      })
      gastoId = gasto?.id ?? null
    }

    const data = {
      ...mantenimientoForm,
      costo,
      kilometraje: mantenimientoForm.kilometraje ? parseFloat(mantenimientoForm.kilometraje) : null,
      proximo_km: mantenimientoForm.proximo_km ? parseFloat(mantenimientoForm.proximo_km) : null,
      proxima_fecha: mantenimientoForm.proxima_fecha || null,
      gasto_id: gastoId,
    }

    await insertRow("mantenimientos", data)
    mutateMantenimientos()
    setIsMantenimientoDialogOpen(false)
    resetMantenimientoForm()
  }

  const handleDelete = async (id: string) => {
    if (confirm("¿Eliminar este vehiculo?")) {
      await deleteRow("vehiculos", id)
      mutateVehiculos()
    }
  }

  const handleDeleteMantenimiento = async (id: string) => {
    if (!confirm("¿Eliminar este mantenimiento? También se eliminará el gasto asociado.")) return
    const m = mantenimientos.find(x => x.id === id)
    await deleteRow("mantenimientos", id)
    if (m?.gasto_id) {
      try {
        await deleteRow("gastos", m.gasto_id)
      } catch (err) {
        console.error("No se pudo eliminar el gasto asociado al mantenimiento:", err)
      }
    }
    mutateMantenimientos()
  }

  const resetForm = () => {
    setFormData({ patente: "", marca: "", modelo: "", anio: "", kilometraje: "" })
  }

  const resetMantenimientoForm = () => {
    setMantenimientoForm({
      vehiculo_id: "",
      fecha: new Date().toISOString().split('T')[0],
      tipo: "",
      descripcion: "",
      kilometraje: "",
      costo: "",
      taller: "",
      proximo_km: "",
      proxima_fecha: "",
      medio_pago: "Efectivo"
    })
  }

  const vehiculosColumns = [
    { key: "patente", header: "Patente", render: (v: Vehiculo) => <span className="font-medium">{v.patente}</span> },
    { key: "marca", header: "Marca" },
    { key: "modelo", header: "Modelo" },
    { key: "anio", header: "Año" },
    { key: "kilometraje", header: "Kilometraje", render: (v: Vehiculo) => `${v.kilometraje.toLocaleString()} km` },
    {
      key: "actions",
      header: "Acciones",
      render: (v: Vehiculo) => (
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              setSelectedVehiculo(v.id)
              setMantenimientoForm({...mantenimientoForm, vehiculo_id: v.id})
              setIsMantenimientoDialogOpen(true)
            }}
          >
            <Wrench className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  ]

  const mantenimientosColumns = [
    { key: "fecha", header: "Fecha", render: (m: Mantenimiento) => formatDate(new Date(m.fecha)) },
    { key: "vehiculo", header: "Vehiculo", render: (m: Mantenimiento) => vehiculos.find(v => v.id === m.vehiculo_id)?.patente || "-" },
    { key: "tipo", header: "Tipo", render: (m: Mantenimiento) => <Badge>{m.tipo}</Badge> },
    { key: "descripcion", header: "Descripcion", render: (m: Mantenimiento) => m.descripcion || "-" },
    { key: "kilometraje", header: "Km", render: (m: Mantenimiento) => m.kilometraje ? `${m.kilometraje.toLocaleString()} km` : "-" },
    { key: "costo", header: "Costo", render: (m: Mantenimiento) => formatCurrency(m.costo) },
    { key: "taller", header: "Taller", render: (m: Mantenimiento) => m.taller || "-" },
    {
      key: "actions",
      header: "Acciones",
      render: (m: Mantenimiento) => (
        <Button variant="ghost" size="icon" onClick={() => handleDeleteMantenimiento(m.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )
    },
  ]

  return (
    <div className="space-y-6">
      <Tabs defaultValue="vehiculos">
        <TabsList>
          <TabsTrigger value="vehiculos">Vehiculos</TabsTrigger>
          <TabsTrigger value="mantenimientos">Mantenimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="vehiculos">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar vehiculos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Vehiculo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo Vehiculo</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Patente</Label>
                    <Input value={formData.patente} onChange={(e) => setFormData({...formData, patente: e.target.value})} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Marca</Label>
                      <Input value={formData.marca} onChange={(e) => setFormData({...formData, marca: e.target.value})} required />
                    </div>
                    <div>
                      <Label>Modelo</Label>
                      <Input value={formData.modelo} onChange={(e) => setFormData({...formData, modelo: e.target.value})} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Año</Label>
                      <Input value={formData.anio} onChange={(e) => setFormData({...formData, anio: e.target.value})} required />
                    </div>
                    <div>
                      <Label>Kilometraje</Label>
                      <Input type="number" value={formData.kilometraje} onChange={(e) => setFormData({...formData, kilometraje: e.target.value})} required />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Guardar</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <DataTable
            columns={vehiculosColumns}
            data={vehiculos.filter(v => v.patente.toLowerCase().includes(searchTerm.toLowerCase()))}
            emptyMessage={loadingVehiculos ? "Cargando..." : "No hay vehiculos registrados"}
          />
        </TabsContent>

        <TabsContent value="mantenimientos">
          <div className="mb-4">
            <Dialog open={isMantenimientoDialogOpen} onOpenChange={setIsMantenimientoDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Mantenimiento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nuevo Mantenimiento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleMantenimientoSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Vehiculo</Label>
                      <Select value={mantenimientoForm.vehiculo_id} onValueChange={(value) => setMantenimientoForm({...mantenimientoForm, vehiculo_id: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar vehiculo" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehiculos.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.patente} - {v.marca} {v.modelo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Fecha</Label>
                      <Input type="date" value={mantenimientoForm.fecha} onChange={(e) => setMantenimientoForm({...mantenimientoForm, fecha: e.target.value})} required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo</Label>
                      <Select value={mantenimientoForm.tipo} onValueChange={(value) => setMantenimientoForm({...mantenimientoForm, tipo: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo de mantenimiento" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_MANTENIMIENTO.map(tipo => (
                            <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Costo</Label>
                      <Input type="number" step="0.01" value={mantenimientoForm.costo} onChange={(e) => setMantenimientoForm({...mantenimientoForm, costo: e.target.value})} required />
                    </div>
                  </div>

                  <div>
                    <Label>Descripcion</Label>
                    <Input value={mantenimientoForm.descripcion} onChange={(e) => setMantenimientoForm({...mantenimientoForm, descripcion: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Kilometraje Actual</Label>
                      <Input type="number" value={mantenimientoForm.kilometraje} onChange={(e) => setMantenimientoForm({...mantenimientoForm, kilometraje: e.target.value})} />
                    </div>
                    <div>
                      <Label>Taller</Label>
                      <Input value={mantenimientoForm.taller} onChange={(e) => setMantenimientoForm({...mantenimientoForm, taller: e.target.value})} />
                    </div>
                  </div>

                  <div>
                    <Label>Medio de pago</Label>
                    <Select value={mantenimientoForm.medio_pago} onValueChange={(value) => setMantenimientoForm({...mantenimientoForm, medio_pago: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Medio de pago" />
                      </SelectTrigger>
                      <SelectContent>
                        {MEDIOS_PAGO.map(mp => (
                          <SelectItem key={mp} value={mp}>{mp}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Proximo Mantenimiento (Km)</Label>
                      <Input type="number" value={mantenimientoForm.proximo_km} onChange={(e) => setMantenimientoForm({...mantenimientoForm, proximo_km: e.target.value})} />
                    </div>
                    <div>
                      <Label>Proxima Fecha</Label>
                      <Input type="date" value={mantenimientoForm.proxima_fecha} onChange={(e) => setMantenimientoForm({...mantenimientoForm, proxima_fecha: e.target.value})} />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="submit">Guardar</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <DataTable
            columns={mantenimientosColumns}
            data={mantenimientos}
            emptyMessage={loadingMantenimientos ? "Cargando..." : "No hay mantenimientos registrados"}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
