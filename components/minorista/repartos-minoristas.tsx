"use client"

import { useState, useMemo } from "react"
import {
  Plus,
  Trash2,
  Truck,
  GripVertical,
  FileDown,
  MapPin,
  ChevronRight,
  ArrowLeftRight,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, todayISO } from "@/lib/utils"
import { insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { useConfirm } from "@/components/confirm-dialog"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  ClienteMinorista,
  PedidoMinorista,
  ItemPedidoMinorista,
  RepartoMinorista,
  ESTADO_LABEL,
} from "./types"

interface Props {
  repartos: RepartoMinorista[]
  pedidos: PedidoMinorista[]
  items: ItemPedidoMinorista[]
  clientes: ClienteMinorista[]
  mutateRepartos: () => Promise<any>
  mutatePedidos: () => Promise<any>
}

export function RepartosMinoristas({
  repartos,
  pedidos,
  items,
  clientes,
  mutateRepartos,
  mutatePedidos,
}: Props) {
  const { toast } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [newOpen, setNewOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newForm, setNewForm] = useState({
    fecha: todayISO(),
    nombre: "",
    repartidor: "",
  })

  const clientesById = useMemo(() => {
    const m = new Map<string, ClienteMinorista>()
    clientes.forEach((c) => m.set(c.id, c))
    return m
  }, [clientes])

  const itemsByPedido = useMemo(() => {
    const m = new Map<string, ItemPedidoMinorista[]>()
    items.forEach((it) => {
      if (!m.has(it.pedido_id)) m.set(it.pedido_id, [])
      m.get(it.pedido_id)!.push(it)
    })
    return m
  }, [items])

  const repartoSelected = useMemo(
    () => repartos.find((r) => r.id === selectedId) || null,
    [repartos, selectedId]
  )

  const pedidosAsignadosId = useMemo(() => {
    const s = new Set<string>()
    repartos.forEach((r) => (r.orden_pedidos || []).forEach((id) => s.add(id)))
    return s
  }, [repartos])

  const pedidosPorAsignar = useMemo(() => {
    if (!repartoSelected) return []
    return pedidos
      .filter((p) => p.fecha === repartoSelected.fecha)
      .filter((p) => !pedidosAsignadosId.has(p.id))
      .filter((p) => !["entregado", "intento_fallido"].includes(p.estado))
  }, [pedidos, repartoSelected, pedidosAsignadosId])

  const pedidosDelReparto = useMemo(() => {
    if (!repartoSelected) return []
    return (repartoSelected.orden_pedidos || [])
      .map((id) => pedidos.find((p) => p.id === id))
      .filter(Boolean) as PedidoMinorista[]
  }, [repartoSelected, pedidos])

  const totalReparto = useMemo(
    () => pedidosDelReparto.reduce((s, p) => s + (p.total || 0), 0),
    [pedidosDelReparto]
  )

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const inserted = await insertRow("repartos_minoristas", {
        fecha: newForm.fecha,
        nombre: newForm.nombre.trim() || `Reparto ${newForm.fecha}`,
        repartidor: newForm.repartidor.trim() || null,
        orden_pedidos: [],
        estado: "armando",
      })
      await mutateRepartos()
      setNewOpen(false)
      setSelectedId(inserted.id)
      setNewForm({
        fecha: todayISO(),
        nombre: "",
        repartidor: "",
      })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateOrden = async (nuevoOrden: string[]) => {
    if (!repartoSelected) return
    try {
      await updateRow("repartos_minoristas", repartoSelected.id, {
        orden_pedidos: nuevoOrden,
      })
      await mutateRepartos()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const addPedido = async (pedidoId: string) => {
    if (!repartoSelected) return
    const nuevoOrden = [...(repartoSelected.orden_pedidos || []), pedidoId]
    await updateOrden(nuevoOrden)
  }

  const removePedido = async (pedidoId: string) => {
    if (!repartoSelected) return
    const nuevoOrden = (repartoSelected.orden_pedidos || []).filter(
      (id) => id !== pedidoId
    )
    await updateOrden(nuevoOrden)
  }

  const handleIniciarReparto = async () => {
    if (!repartoSelected) return
    try {
      await updateRow("repartos_minoristas", repartoSelected.id, {
        estado: "en_curso",
      })
      for (const p of pedidosDelReparto) {
        if (p.estado === "recibido" || p.estado === "confirmado") {
          await updateRow("pedidos_minoristas", p.id, { estado: "en_reparto" })
        }
      }
      await Promise.all([mutateRepartos(), mutatePedidos()])
      toast({ title: "Reparto iniciado", description: "Pedidos marcados en reparto" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleFinalizar = async () => {
    if (!repartoSelected) return
    try {
      await updateRow("repartos_minoristas", repartoSelected.id, {
        estado: "finalizado",
      })
      await mutateRepartos()
      toast({ title: "Reparto finalizado" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleDeleteReparto = async () => {
    if (!repartoSelected) return
    const ok = await confirm({
      title: `Eliminar reparto ${repartoSelected.nombre}?`,
      description: "Los pedidos quedarán sin asignar.",
      destructive: true,
      confirmLabel: "Eliminar",
    })
    if (!ok) return
    try {
      await deleteRow("repartos_minoristas", repartoSelected.id)
      await mutateRepartos()
      setSelectedId(null)
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id && repartoSelected) {
      const prev = repartoSelected.orden_pedidos || []
      const oldIdx = prev.indexOf(String(active.id))
      const newIdx = prev.indexOf(String(over.id))
      if (oldIdx < 0 || newIdx < 0) return
      const nuevoOrden = arrayMove(prev, oldIdx, newIdx)
      updateOrden(nuevoOrden)
    }
  }

  const generarPDF = () => {
    if (!repartoSelected) return
    const doc = new jsPDF({ unit: "mm", format: "a4" })
    const margin = 15

    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("HOJA DE RUTA", margin, 18)

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Reparto: ${repartoSelected.nombre}`, margin, 26)
    doc.text(`Fecha: ${repartoSelected.fecha}`, margin, 31)
    if (repartoSelected.repartidor) {
      doc.text(`Repartidor: ${repartoSelected.repartidor}`, margin, 36)
    }
    doc.text(
      `Pedidos: ${pedidosDelReparto.length}    Total: ${formatCurrency(totalReparto)}`,
      margin,
      41
    )

    const rows = pedidosDelReparto.map((p, idx) => {
      const cli = clientesById.get(p.cliente_id || "")
      const its = itemsByPedido.get(p.id) || []
      const detalle = its
        .map((it) => `${it.cantidad} × ${it.nombre_producto}`)
        .join("\n")
      return [
        String(idx + 1),
        cli ? `${cli.nombre} ${cli.apellido}\n${cli.telefono || ""}` : "-",
        cli?.direccion || "-",
        detalle,
        formatCurrency(p.total),
        p.forma_pago === "mercadopago" ? "MP" : "EFE",
      ]
    })

    autoTable(doc, {
      startY: 48,
      head: [["#", "Cliente", "Dirección", "Pedido", "Total", "Pago"]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 2, valign: "top" },
      headStyles: { fillColor: [71, 85, 105] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 35 },
        2: { cellWidth: 55 },
        3: { cellWidth: 50 },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 12, halign: "center" },
      },
    })

    const finalY = (doc as any).lastAutoTable?.finalY || 200
    doc.setFontSize(9)
    doc.text(
      `Total a cobrar: ${formatCurrency(totalReparto)}`,
      margin,
      finalY + 10
    )

    doc.save(`hoja-ruta-${repartoSelected.fecha}-${repartoSelected.nombre.replace(/\s+/g, "_")}.pdf`)
  }

  const abrirEnGoogleMaps = () => {
    if (!repartoSelected || pedidosDelReparto.length === 0) return
    const stops = pedidosDelReparto
      .map((p) => {
        const c = clientesById.get(p.cliente_id || "")
        if (!c) return null
        if (c.lat != null && c.lng != null) return `${c.lat},${c.lng}`
        if (c.direccion) return encodeURIComponent(c.direccion)
        return null
      })
      .filter(Boolean)
    if (stops.length === 0) return
    const url = `https://www.google.com/maps/dir/${stops.join("/")}`
    window.open(url, "_blank")
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Sidebar: lista de repartos */}
      <div className="lg:col-span-1 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Repartos</h3>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> Nuevo
          </Button>
        </div>
        <div className="space-y-2">
          {repartos.map((r) => {
            const count = (r.orden_pedidos || []).length
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedId === r.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{r.nombre}</span>
                  <Badge
                    variant={r.estado === "finalizado" ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {r.estado === "armando"
                      ? "Armando"
                      : r.estado === "en_curso"
                      ? "En curso"
                      : "Finalizado"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>{r.fecha}</span>
                  <span>{count} pedidos</span>
                </div>
                {r.repartidor && (
                  <div className="text-xs text-muted-foreground">{r.repartidor}</div>
                )}
              </button>
            )
          })}
          {repartos.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Truck className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Aún no hay repartos
            </div>
          )}
        </div>
      </div>

      {/* Detalle del reparto */}
      <div className="lg:col-span-2">
        {!repartoSelected ? (
          <div className="py-24 text-center text-muted-foreground text-sm border-2 border-dashed rounded-lg">
            <Truck className="h-12 w-12 mx-auto mb-2 opacity-30" />
            Seleccioná un reparto o creá uno nuevo
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header del reparto */}
            <Card>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                  <h2 className="text-lg font-bold">{repartoSelected.nombre}</h2>
                  <p className="text-sm text-muted-foreground">
                    {repartoSelected.fecha}
                    {repartoSelected.repartidor &&
                      ` · Repartidor: ${repartoSelected.repartidor}`}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">{pedidosDelReparto.length}</span>{" "}
                    pedidos · Total{" "}
                    <span className="font-semibold">
                      {formatCurrency(totalReparto)}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {repartoSelected.estado === "armando" && (
                    <Button size="sm" onClick={handleIniciarReparto}>
                      <Truck className="h-3.5 w-3.5 mr-1.5" /> Iniciar reparto
                    </Button>
                  )}
                  {repartoSelected.estado === "en_curso" && (
                    <Button size="sm" onClick={handleFinalizar}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Finalizar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={generarPDF}>
                    <FileDown className="h-3.5 w-3.5 mr-1.5" /> Hoja de ruta PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={abrirEnGoogleMaps}
                    disabled={pedidosDelReparto.length === 0}
                  >
                    <MapPin className="h-3.5 w-3.5 mr-1.5" /> Ver en Maps
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-600"
                    onClick={handleDeleteReparto}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pedidos del reparto (sortable) */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Pedidos en este reparto ({pedidosDelReparto.length})
              </h3>
              {pedidosDelReparto.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                  Agregá pedidos de la lista de abajo
                </div>
              ) : (
                <DndContext
                  sensors={useSensors(
                    useSensor(PointerSensor, {
                      activationConstraint: { distance: 5 },
                    })
                  )}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={pedidosDelReparto.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1.5">
                      {pedidosDelReparto.map((p, idx) => (
                        <SortableRow
                          key={p.id}
                          pedido={p}
                          cliente={clientesById.get(p.cliente_id || "")}
                          items={itemsByPedido.get(p.id) || []}
                          index={idx}
                          onRemove={() => removePedido(p.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Pedidos por asignar */}
            {repartoSelected.estado === "armando" && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Pedidos sin asignar del {repartoSelected.fecha} (
                  {pedidosPorAsignar.length})
                </h3>
                {pedidosPorAsignar.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    No hay pedidos pendientes para esta fecha
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {pedidosPorAsignar.map((p) => {
                      const cli = clientesById.get(p.cliente_id || "")
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 p-2 rounded border bg-muted/30"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                {p.numero}
                              </Badge>
                              <span className="text-sm font-medium truncate">
                                {cli
                                  ? `${cli.nombre} ${cli.apellido}`
                                  : "Sin cliente"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {cli?.direccion || "Sin dirección"} ·{" "}
                              {formatCurrency(p.total)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addPedido(p.id)}
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog nuevo reparto */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo reparto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={newForm.fecha}
                onChange={(e) => setNewForm({ ...newForm, fecha: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Nombre *</Label>
              <Input
                value={newForm.nombre}
                onChange={(e) => setNewForm({ ...newForm, nombre: e.target.value })}
                required
                placeholder="Ej: Zona Norte - Mañana"
              />
            </div>
            <div>
              <Label>Repartidor</Label>
              <Input
                value={newForm.repartidor}
                onChange={(e) =>
                  setNewForm({ ...newForm, repartidor: e.target.value })
                }
                placeholder="Nombre del repartidor"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creando…" : "Crear reparto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </div>
  )
}

function SortableRow({
  pedido,
  cliente,
  items,
  index,
  onRemove,
}: {
  pedido: PedidoMinorista
  cliente?: ClienteMinorista
  items: ItemPedidoMinorista[]
  index: number
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: pedido.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 p-2.5 rounded border bg-card"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 mt-0.5"
        aria-label="Arrastrar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {pedido.numero}
          </Badge>
          <span className="font-medium text-sm">
            {cliente ? `${cliente.nombre} ${cliente.apellido}` : "Sin cliente"}
          </span>
          <Badge className="text-[10px]">{ESTADO_LABEL[pedido.estado]}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {cliente?.direccion || "Sin dirección"}
          {cliente?.telefono && ` · ${cliente.telefono}`}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {items.map((it) => `${it.cantidad}× ${it.nombre_producto}`).join(", ")}
        </p>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold">{formatCurrency(pedido.total)}</div>
        <div className="text-[10px] uppercase text-muted-foreground">
          {pedido.forma_pago}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onRemove}
        title="Quitar del reparto"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
