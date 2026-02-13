"use client"

import { useState, useMemo } from "react"
import {
  Plus,
  Car,
  Wrench,
  Gauge,
  Search,
  Calendar,
  AlertTriangle,
  ChevronLeft,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { SheetsStatus } from "./sheets-status"
import { useSheet, addRow, updateRow, deleteRow } from "@/hooks/use-sheets"
import { formatCurrency, formatDate, formatDateForSheets, formatDateInput, parseDate, parseSheetNumber } from "@/lib/utils"

const TIPOS_MANTENIMIENTO = [
  "Cambio de aceite",
  "Cambio de filtros",
  "Cambio de cubiertas",
  "Service completo",
  "Frenos",
  "Suspension",
  "Electricidad",
  "Chapa y pintura",
  "Alineacion y balanceo",
  "Cambio de correa",
  "Cambio de bateria",
  "Reparacion motor",
  "Reparacion caja",
  "VTV / RTO",
  "Otro",
]

interface Vehiculo {
  id: string
  patente: string
  marca: string
  modelo: string
  anio: string
  kilometraje: number
  _rowIndex: number
}

interface Mantenimiento {
  id: string
  vehiculoId: string
  fecha: Date
  tipo: string
  descripcion: string
  kilometraje: number
  costo: number
  taller: string
  proximoKm: number
  proximaFecha: string
  _rowIndex: number
}

export function VehiculosContent() {
  const sheetsVehiculos = useSheet("Vehiculos")
  const sheetsMantenimientos = useSheet("Mantenimientos")
  const [selectedVehiculo, setSelectedVehiculo] = useState<Vehiculo | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogVehiculo, setDialogVehiculo] = useState(false)
  const [dialogMant, setDialogMant] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editVehiculoIdx, setEditVehiculoIdx] = useState<number | null>(null)
  const [editMantIdx, setEditMantIdx] = useState<number | null>(null)
  const [deleteMant, setDeleteMant] = useState<Mantenimiento | null>(null)
  const [deleteVehiculoConfirm, setDeleteVehiculoConfirm] = useState<Vehiculo | null>(null)

  const [nuevoVehiculo, setNuevoVehiculo] = useState({
    patente: "",
    marca: "",
    modelo: "",
    anio: "",
    kilometraje: "",
  })

  const [nuevoMant, setNuevoMant] = useState({
    fecha: new Date().toISOString().split("T")[0],
    tipo: "",
    descripcion: "",
    kilometraje: "",
    costo: "",
    taller: "",
    proximoKm: "",
    proximaFecha: "",
  })

  const isLoading = sheetsVehiculos.isLoading || sheetsMantenimientos.isLoading
  const hasError = sheetsVehiculos.error
  const isConnected = !hasError && !isLoading

  // Parse vehiculos
  const vehiculos: Vehiculo[] = useMemo(() => {
    return sheetsVehiculos.rows.map((r, i) => ({
      id: r.ID || r.Patente || `v-${i}`,
      patente: r.Patente || "",
      marca: r.Marca || "",
      modelo: r.Modelo || "",
      anio: r.AnioVehiculo || r.Anio || "",
      kilometraje: Number(r.Kilometraje) || 0,
      _rowIndex: i,
    }))
  }, [sheetsVehiculos.rows])

  // Parse mantenimientos
  const mantenimientos: Mantenimiento[] = useMemo(() => {
    return sheetsMantenimientos.rows.map((r, i) => ({
      id: r.ID || `m-${i}`,
      vehiculoId: (r.VehiculoID || r.Patente || "").toUpperCase(),
      fecha: parseDate(r.Fecha || ""),
      tipo: r.TipoMantenimiento || r.Tipo || "",
      descripcion: r.Descripcion || r.Observaciones || "",
      kilometraje: Number(r.Kilometraje) || 0,
      costo: parseSheetNumber(r.Costo) || parseSheetNumber(r.Monto),
      taller: r.Taller || "",
      proximoKm: Number(r.ProximoKM) || 0,
      proximaFecha: r.ProximaFecha || "",
      _rowIndex: i,
    }))
  }, [sheetsMantenimientos.rows])

  // Filter vehicles
  const vehiculosFiltrados = useMemo(() => {
    if (!searchTerm) return vehiculos
    const s = searchTerm.toLowerCase()
    return vehiculos.filter(
      (v) =>
        v.patente.toLowerCase().includes(s) ||
        v.marca.toLowerCase().includes(s) ||
        v.modelo.toLowerCase().includes(s)
    )
  }, [vehiculos, searchTerm])

  // Get mantenimientos for selected vehicle
  const mantVehiculo = useMemo(() => {
    if (!selectedVehiculo) return []
    const patenteUpper = selectedVehiculo.patente.toUpperCase()
    return mantenimientos
      .filter((m) => m.vehiculoId === patenteUpper || m.vehiculoId === selectedVehiculo.id)
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
  }, [selectedVehiculo, mantenimientos])

  // Cost per vehicle
  const costosPorVehiculo = useMemo(() => {
    const map = new Map<string, number>()
    mantenimientos.forEach((m) => {
      const key = m.vehiculoId
      map.set(key, (map.get(key) || 0) + m.costo)
    })
    return map
  }, [mantenimientos])

  // Alertas
  const alertas = useMemo(() => {
    const now = new Date()
    const alerts: Array<{ vehiculo: Vehiculo; mant: Mantenimiento; tipo: "km" | "fecha" }> = []
    vehiculos.forEach((v) => {
      const patenteUpper = v.patente.toUpperCase()
      const vMant = mantenimientos.filter(
        (m) => m.vehiculoId === patenteUpper || m.vehiculoId === v.id
      )
      vMant.forEach((m) => {
        if (m.proximoKm > 0 && v.kilometraje >= m.proximoKm * 0.95) {
          alerts.push({ vehiculo: v, mant: m, tipo: "km" })
        }
        if (m.proximaFecha) {
          const proxDate = parseDate(m.proximaFecha)
          const diffDays = (proxDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          if (diffDays <= 15) {
            alerts.push({ vehiculo: v, mant: m, tipo: "fecha" })
          }
        }
      })
    })
    return alerts
  }, [vehiculos, mantenimientos])

  const resetVehiculoForm = () => {
    setNuevoVehiculo({ patente: "", marca: "", modelo: "", anio: "", kilometraje: "" })
    setEditVehiculoIdx(null)
  }

  const resetMantForm = () => {
    setNuevoMant({ fecha: new Date().toISOString().split("T")[0], tipo: "", descripcion: "", kilometraje: "", costo: "", taller: "", proximoKm: "", proximaFecha: "" })
    setEditMantIdx(null)
  }

  const handleCloseVehiculoDialog = () => {
    setDialogVehiculo(false)
    resetVehiculoForm()
  }

  const handleCloseMantDialog = () => {
    setDialogMant(false)
    resetMantForm()
  }

  const handleEditVehiculo = (v: Vehiculo) => {
    setEditVehiculoIdx(v._rowIndex)
    setNuevoVehiculo({
      patente: v.patente,
      marca: v.marca,
      modelo: v.modelo,
      anio: v.anio,
      kilometraje: String(v.kilometraje),
    })
    setDialogVehiculo(true)
  }

  const handleGuardarVehiculo = async () => {
    if (!nuevoVehiculo.patente || !nuevoVehiculo.marca) return
    setSaving(true)
    try {
      const id = nuevoVehiculo.patente.toUpperCase().replace(/\s/g, "")
      const rowData = [
        editVehiculoIdx !== null ? (sheetsVehiculos.rows[editVehiculoIdx]?.ID || id) : id,
        nuevoVehiculo.patente.toUpperCase(),
        nuevoVehiculo.marca,
        nuevoVehiculo.modelo,
        nuevoVehiculo.anio,
        nuevoVehiculo.kilometraje || "0",
      ]
      if (editVehiculoIdx !== null) {
        await updateRow("Vehiculos", editVehiculoIdx, rowData)
        // Update selectedVehiculo if we're editing the currently selected one
        if (selectedVehiculo && selectedVehiculo._rowIndex === editVehiculoIdx) {
          setSelectedVehiculo({
            ...selectedVehiculo,
            patente: nuevoVehiculo.patente.toUpperCase(),
            marca: nuevoVehiculo.marca,
            modelo: nuevoVehiculo.modelo,
            anio: nuevoVehiculo.anio,
            kilometraje: Number(nuevoVehiculo.kilometraje) || 0,
          })
        }
      } else {
        await addRow("Vehiculos", [rowData])
      }
      await sheetsVehiculos.mutate()
      handleCloseVehiculoDialog()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteVehiculo = async () => {
    if (!deleteVehiculoConfirm) return
    setSaving(true)
    try {
      await deleteRow("Vehiculos", deleteVehiculoConfirm._rowIndex)
      await sheetsVehiculos.mutate()
      if (selectedVehiculo?.id === deleteVehiculoConfirm.id) {
        setSelectedVehiculo(null)
      }
    } catch { /* silent */ } finally {
      setSaving(false)
      setDeleteVehiculoConfirm(null)
    }
  }

  const handleEditMant = (m: Mantenimiento) => {
    setEditMantIdx(m._rowIndex)
    setNuevoMant({
      fecha: formatDateInput(m.fecha),
      tipo: m.tipo,
      descripcion: m.descripcion,
      kilometraje: m.kilometraje > 0 ? String(m.kilometraje) : "",
      costo: m.costo > 0 ? String(m.costo) : "",
      taller: m.taller,
      proximoKm: m.proximoKm > 0 ? String(m.proximoKm) : "",
      proximaFecha: m.proximaFecha ? formatDateInput(m.proximaFecha) : "",
    })
    setDialogMant(true)
  }

  const handleDeleteMant = async () => {
    if (!deleteMant) return
    setSaving(true)
    try {
      await deleteRow("Mantenimientos", deleteMant._rowIndex)
      await sheetsMantenimientos.mutate()
    } catch { /* silent */ } finally {
      setSaving(false)
      setDeleteMant(null)
    }
  }

  const handleGuardarMant = async () => {
    if (!selectedVehiculo || !nuevoMant.tipo) return
    setSaving(true)
    try {
      const rowData = [
        editMantIdx !== null ? (sheetsMantenimientos.rows[editMantIdx]?.ID || `M${Date.now()}`) : `M${Date.now()}`,
        selectedVehiculo.patente.toUpperCase(),
        formatDateForSheets(parseDate(nuevoMant.fecha)),
        nuevoMant.tipo,
        nuevoMant.descripcion,
        nuevoMant.kilometraje || String(selectedVehiculo.kilometraje),
        nuevoMant.costo || "0",
        nuevoMant.taller,
        nuevoMant.proximoKm || "",
        nuevoMant.proximaFecha ? formatDateForSheets(parseDate(nuevoMant.proximaFecha)) : "",
      ]

      if (editMantIdx !== null) {
        await updateRow("Mantenimientos", editMantIdx, rowData)
      } else {
        await addRow("Mantenimientos", [rowData])
      }

      // Update vehicle km if provided and higher
      const newKm = Number(nuevoMant.kilometraje)
      if (newKm > selectedVehiculo.kilometraje) {
        const vIdx = sheetsVehiculos.rows.findIndex(
          (r) => (r.Patente || "").toUpperCase() === selectedVehiculo.patente.toUpperCase()
        )
        if (vIdx >= 0) {
          await updateRow("Vehiculos", vIdx, [
            selectedVehiculo.id,
            selectedVehiculo.patente,
            selectedVehiculo.marca,
            selectedVehiculo.modelo,
            selectedVehiculo.anio,
            String(newKm),
          ])
          await sheetsVehiculos.mutate()
          setSelectedVehiculo({ ...selectedVehiculo, kilometraje: newKm })
        }
      }

      await sheetsMantenimientos.mutate()
      handleCloseMantDialog()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  // Detail view for selected vehicle
  if (selectedVehiculo) {
    const totalCosto = mantVehiculo.reduce((a, m) => a + m.costo, 0)
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setSelectedVehiculo(null)}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Button>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {selectedVehiculo.marca} {selectedVehiculo.modelo}
              </h2>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-mono font-semibold">{selectedVehiculo.patente}</span>
                {selectedVehiculo.anio && <span>Anio: {selectedVehiculo.anio}</span>}
                <span className="flex items-center gap-1">
                  <Gauge className="h-3.5 w-3.5" />
                  {selectedVehiculo.kilometraje.toLocaleString("es-AR")} km
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEditVehiculo(selectedVehiculo)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar Vehiculo
            </Button>
            <Button size="sm" onClick={() => { resetMantForm(); setDialogMant(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Mantenimiento
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Mantenimientos</p>
            <p className="text-2xl font-bold text-foreground">{mantVehiculo.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Costo Total</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalCosto)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Ultimo Servicio</p>
            <p className="text-2xl font-bold text-foreground">
              {mantVehiculo.length > 0 ? formatDate(mantVehiculo[0].fecha) : "-"}
            </p>
          </div>
        </div>

        {/* Mantenimiento timeline */}
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Historial de Mantenimiento</h3>
          {mantVehiculo.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <Wrench className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="font-medium text-foreground">Sin registros de mantenimiento</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crea la hoja &quot;Mantenimientos&quot; con: ID, VehiculoID, Fecha, TipoMantenimiento, Descripcion, Kilometraje, Costo, Taller, ProximoKM, ProximaFecha
              </p>
            </div>
          ) : (
            <div className="relative space-y-4 pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-border">
              {mantVehiculo.map((m) => (
                <div key={m.id} className="group relative rounded-xl border bg-card p-4">
                  <div className="absolute -left-6 top-5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-card">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{m.tipo}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {m.kilometraje > 0 ? `${m.kilometraje.toLocaleString("es-AR")} km` : "-"}
                        </Badge>
                      </div>
                      {m.descripcion && (
                        <p className="text-sm text-muted-foreground">{m.descripcion}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(m.fecha)}
                        </span>
                        {m.taller && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {m.taller}
                          </span>
                        )}
                        {m.proximoKm > 0 && (
                          <span>Proximo: {m.proximoKm.toLocaleString("es-AR")} km</span>
                        )}
                        {m.proximaFecha && (
                          <span>Prox. fecha: {formatDate(m.proximaFecha)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-foreground">{formatCurrency(m.costo)}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditMant(m)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="sr-only">Editar mantenimiento</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteMant(m)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="sr-only">Eliminar mantenimiento</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New/Edit Mantenimiento Dialog */}
        <Dialog open={dialogMant} onOpenChange={handleCloseMantDialog}>
          <DialogContent className="max-w-md" onEscapeKeyDown={handleCloseMantDialog}>
            <DialogHeader>
              <DialogTitle>{editMantIdx !== null ? "Editar Mantenimiento" : "Nuevo Mantenimiento"}</DialogTitle>
              <DialogDescription>
                {selectedVehiculo.marca} {selectedVehiculo.modelo} - {selectedVehiculo.patente}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha</Label>
                  <Input type="date" value={nuevoMant.fecha} onChange={(e) => setNuevoMant({ ...nuevoMant, fecha: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kilometraje</Label>
                  <Input type="number" placeholder={String(selectedVehiculo.kilometraje)} value={nuevoMant.kilometraje} onChange={(e) => setNuevoMant({ ...nuevoMant, kilometraje: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Mantenimiento</Label>
                <Select value={nuevoMant.tipo} onValueChange={(v) => setNuevoMant({ ...nuevoMant, tipo: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_MANTENIMIENTO.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descripcion</Label>
                <Textarea placeholder="Detalle del trabajo realizado..." value={nuevoMant.descripcion} onChange={(e) => setNuevoMant({ ...nuevoMant, descripcion: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Costo</Label>
                  <Input type="number" placeholder="0" value={nuevoMant.costo} onChange={(e) => setNuevoMant({ ...nuevoMant, costo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Taller</Label>
                  <Input placeholder="Nombre del taller" value={nuevoMant.taller} onChange={(e) => setNuevoMant({ ...nuevoMant, taller: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Proximo KM</Label>
                  <Input type="number" placeholder="Ej: 50000" value={nuevoMant.proximoKm} onChange={(e) => setNuevoMant({ ...nuevoMant, proximoKm: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Proxima Fecha</Label>
                  <Input type="date" value={nuevoMant.proximaFecha} onChange={(e) => setNuevoMant({ ...nuevoMant, proximaFecha: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseMantDialog}>Cancelar</Button>
              <Button onClick={handleGuardarMant} disabled={saving || !nuevoMant.tipo}>
                {saving ? "Guardando..." : editMantIdx !== null ? "Guardar Cambios" : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Mantenimiento Confirm */}
        <AlertDialog open={!!deleteMant} onOpenChange={(open) => { if (!open) setDeleteMant(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar mantenimiento</AlertDialogTitle>
              <AlertDialogDescription>
                Eliminar registro de &quot;{deleteMant?.tipo}&quot; del {deleteMant ? formatDate(deleteMant.fecha) : ""}? Esta accion no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {saving ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Vehicle Dialog (reused) */}
        <Dialog open={dialogVehiculo} onOpenChange={handleCloseVehiculoDialog}>
          <DialogContent className="max-w-md" onEscapeKeyDown={handleCloseVehiculoDialog}>
            <DialogHeader>
              <DialogTitle>Editar Vehiculo</DialogTitle>
              <DialogDescription>Modifique los datos del vehiculo</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Patente</Label>
                  <Input
                    placeholder="ABC 123"
                    value={nuevoVehiculo.patente}
                    onChange={(e) => setNuevoVehiculo({ ...nuevoVehiculo, patente: e.target.value.toUpperCase() })}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Anio</Label>
                  <Input type="number" placeholder="2020" value={nuevoVehiculo.anio} onChange={(e) => setNuevoVehiculo({ ...nuevoVehiculo, anio: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Marca</Label>
                  <Input placeholder="Ford, Fiat, etc." value={nuevoVehiculo.marca} onChange={(e) => setNuevoVehiculo({ ...nuevoVehiculo, marca: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Modelo</Label>
                  <Input placeholder="Ranger, Ducato, etc." value={nuevoVehiculo.modelo} onChange={(e) => setNuevoVehiculo({ ...nuevoVehiculo, modelo: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kilometraje Actual</Label>
                <Input type="number" placeholder="50000" value={nuevoVehiculo.kilometraje} onChange={(e) => setNuevoVehiculo({ ...nuevoVehiculo, kilometraje: e.target.value })} />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {editVehiculoIdx !== null && (
                <Button variant="destructive" className="sm:mr-auto" onClick={() => {
                  const v = vehiculos.find((vh) => vh._rowIndex === editVehiculoIdx)
                  if (v) { setDeleteVehiculoConfirm(v); handleCloseVehiculoDialog() }
                }}>
                  Eliminar Vehiculo
                </Button>
              )}
              <Button variant="outline" onClick={handleCloseVehiculoDialog}>Cancelar</Button>
              <Button onClick={handleGuardarVehiculo} disabled={saving || !nuevoVehiculo.patente || !nuevoVehiculo.marca}>
                {saving ? "Guardando..." : editVehiculoIdx !== null ? "Guardar Cambios" : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Vehicle Confirm */}
        <AlertDialog open={!!deleteVehiculoConfirm} onOpenChange={(open) => { if (!open) setDeleteVehiculoConfirm(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar vehiculo</AlertDialogTitle>
              <AlertDialogDescription>
                Eliminar {deleteVehiculoConfirm?.marca} {deleteVehiculoConfirm?.modelo} ({deleteVehiculoConfirm?.patente})? Los registros de mantenimiento asociados no se eliminaran.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteVehiculo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {saving ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // Main list view
  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alertas.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="font-semibold text-destructive text-sm">
              {alertas.length} alerta{alertas.length > 1 ? "s" : ""} de mantenimiento
            </span>
          </div>
          <div className="space-y-1.5">
            {alertas.slice(0, 5).map((a, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{a.vehiculo.patente}</span>
                {" - "}
                {a.mant.tipo}
                {a.tipo === "km"
                  ? ` (proximo a ${a.mant.proximoKm.toLocaleString("es-AR")} km, actual: ${a.vehiculo.kilometraje.toLocaleString("es-AR")} km)`
                  : ` (vence: ${formatDate(a.mant.proximaFecha)})`}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Car className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Vehiculos</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{vehiculos.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Wrench className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Total Servicios</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{mantenimientos.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">Alertas</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-destructive">{alertas.length}</p>
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por patente, marca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <SheetsStatus isLoading={isLoading} error={hasError} isConnected={isConnected} />
        </div>
        <Button size="sm" onClick={() => { resetVehiculoForm(); setDialogVehiculo(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Vehiculo
        </Button>
      </div>

      {/* Vehicle grid */}
      {vehiculosFiltrados.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Car className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-foreground">Sin vehiculos registrados</p>
          <p className="text-sm text-muted-foreground mt-1">
            Crea la hoja &quot;Vehiculos&quot; con: ID, Patente, Marca, Modelo, AnioVehiculo, Kilometraje
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehiculosFiltrados.map((v) => {
            const costoTotal = costosPorVehiculo.get(v.patente.toUpperCase()) || 0
            const cantMant = mantenimientos.filter(
              (m) => m.vehiculoId === v.patente.toUpperCase() || m.vehiculoId === v.id
            ).length
            const tieneAlerta = alertas.some((a) => a.vehiculo.id === v.id)

            return (
              <button
                type="button"
                key={v.id}
                className={`rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md hover:border-primary/30 ${tieneAlerta ? "border-destructive/30" : ""}`}
                onClick={() => setSelectedVehiculo(v)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-foreground">
                      {v.marca} {v.modelo}
                    </h3>
                    <p className="font-mono text-sm font-semibold text-primary">{v.patente}</p>
                  </div>
                  {tieneAlerta && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {v.anio && <Badge variant="outline" className="text-[10px]">{v.anio}</Badge>}
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3 w-3" />
                    {v.kilometraje > 0 ? `${v.kilometraje.toLocaleString("es-AR")} km` : "-"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    {cantMant} servicios
                  </span>
                </div>
                {costoTotal > 0 && (
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    Invertido: {formatCurrency(costoTotal)}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* New Vehicle Dialog (main view) */}
      <Dialog open={dialogVehiculo} onOpenChange={handleCloseVehiculoDialog}>
        <DialogContent className="max-w-md" onEscapeKeyDown={handleCloseVehiculoDialog}>
          <DialogHeader>
            <DialogTitle>{editVehiculoIdx !== null ? "Editar Vehiculo" : "Nuevo Vehiculo"}</DialogTitle>
            <DialogDescription>{editVehiculoIdx !== null ? "Modifique los datos del vehiculo" : "Agrega un vehiculo a la flota"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Patente</Label>
                <Input
                  placeholder="ABC 123"
                  value={nuevoVehiculo.patente}
                  onChange={(e) => setNuevoVehiculo({ ...nuevoVehiculo, patente: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Anio</Label>
                <Input type="number" placeholder="2020" value={nuevoVehiculo.anio} onChange={(e) => setNuevoVehiculo({ ...nuevoVehiculo, anio: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Marca</Label>
                <Input placeholder="Ford, Fiat, etc." value={nuevoVehiculo.marca} onChange={(e) => setNuevoVehiculo({ ...nuevoVehiculo, marca: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo</Label>
                <Input placeholder="Ranger, Ducato, etc." value={nuevoVehiculo.modelo} onChange={(e) => setNuevoVehiculo({ ...nuevoVehiculo, modelo: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kilometraje Actual</Label>
              <Input type="number" placeholder="50000" value={nuevoVehiculo.kilometraje} onChange={(e) => setNuevoVehiculo({ ...nuevoVehiculo, kilometraje: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseVehiculoDialog}>Cancelar</Button>
            <Button onClick={handleGuardarVehiculo} disabled={saving || !nuevoVehiculo.patente || !nuevoVehiculo.marca}>
              {saving ? "Guardando..." : editVehiculoIdx !== null ? "Guardar Cambios" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Vehicle Confirm (main view) */}
      <AlertDialog open={!!deleteVehiculoConfirm} onOpenChange={(open) => { if (!open) setDeleteVehiculoConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar vehiculo</AlertDialogTitle>
            <AlertDialogDescription>
              Eliminar {deleteVehiculoConfirm?.marca} {deleteVehiculoConfirm?.modelo} ({deleteVehiculoConfirm?.patente})? Los registros de mantenimiento asociados no se eliminaran.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVehiculo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
