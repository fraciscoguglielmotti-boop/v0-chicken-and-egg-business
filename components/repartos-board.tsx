"use client"

import { useState, useMemo } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Truck, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface Pedido {
  id: string
  cliente: string
  producto: string
  cantidad: number
  precio_unitario: number
  observaciones: string
}

interface Vehiculo {
  id: string
  patente: string
  marca: string
  modelo: string
}

interface RepartosBoardProps {
  pedidos: Pedido[]
  vehiculos: Vehiculo[]
}

// Tarjeta individual de pedido (draggable)
function PedidoCard({ pedido, isDragging }: { pedido: Pedido; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: pedido.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-2 rounded-lg border bg-card p-3 text-sm shadow-sm",
        isDragging && "opacity-40"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{pedido.cliente}</p>
        <p className="text-muted-foreground text-xs">{pedido.producto} × {pedido.cantidad}</p>
        {pedido.observaciones && (
          <p className="text-muted-foreground text-xs italic truncate">{pedido.observaciones}</p>
        )}
      </div>
      <Badge variant="outline" className="shrink-0 text-xs">{pedido.cantidad} u.</Badge>
    </div>
  )
}

// Columna de vehículo (droppable)
function VehiculoColumna({
  vehiculoId,
  label,
  pedidosIds,
  allPedidos,
  capacidad,
  onCapacidadChange,
}: {
  vehiculoId: string
  label: string
  pedidosIds: string[]
  allPedidos: Pedido[]
  capacidad: number
  onCapacidadChange: (val: number) => void
}) {
  const pedidosColumna = pedidosIds
    .map(id => allPedidos.find(p => p.id === id))
    .filter(Boolean) as Pedido[]

  const totalUnidades = pedidosColumna.reduce((sum, p) => sum + p.cantidad, 0)
  const totalMonto = pedidosColumna.reduce((sum, p) => sum + p.cantidad * p.precio_unitario, 0)
  const porcentaje = capacidad > 0 ? Math.min((totalUnidades / capacidad) * 100, 100) : 0
  const excede = capacidad > 0 && totalUnidades > capacidad

  return (
    <div className="flex flex-col min-w-[240px] w-[240px] shrink-0">
      {/* Header */}
      <div className={cn("rounded-t-lg border border-b-0 p-3", excede ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/50")}>
        <div className="flex items-center gap-2 mb-2">
          <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-semibold text-sm truncate">{label}</span>
          {excede
            ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 ml-auto" />
            : pedidosIds.length > 0
              ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 ml-auto" />
              : null
          }
        </div>

        {/* Capacidad */}
        <div className="flex items-center gap-2 text-xs mb-2">
          <span className="text-muted-foreground shrink-0">Cap.:</span>
          <Input
            type="number"
            min={0}
            value={capacidad || ""}
            onChange={e => onCapacidadChange(parseInt(e.target.value) || 0)}
            className="h-6 w-16 text-xs px-1"
            placeholder="—"
          />
          <span className="text-muted-foreground shrink-0">u.</span>
        </div>

        {/* Barra de progreso */}
        {capacidad > 0 && (
          <Progress
            value={porcentaje}
            className={cn("h-1.5", excede && "[&>div]:bg-red-500")}
          />
        )}

        {/* Contador */}
        <div className="flex justify-between items-center mt-1.5 text-xs">
          <span className={cn("font-medium", excede ? "text-red-500" : "text-foreground")}>
            {totalUnidades}{capacidad > 0 ? ` / ${capacidad} u.` : " u."}
          </span>
          {totalMonto > 0 && (
            <span className="text-muted-foreground">{formatCurrency(totalMonto)}</span>
          )}
        </div>
      </div>

      {/* Zona drop */}
      <SortableContext items={pedidosIds} strategy={verticalListSortingStrategy}>
        <div
          className={cn(
            "flex-1 rounded-b-lg border border-t-0 p-2 space-y-2 min-h-[120px] transition-colors",
            excede ? "border-red-200 dark:border-red-800" : "border-border"
          )}
        >
          {pedidosColumna.map(p => (
            <PedidoCard key={p.id} pedido={p} />
          ))}
          {pedidosColumna.length === 0 && (
            <div className="h-20 flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed rounded-lg">
              Arrastrá pedidos acá
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export function RepartosBoard({ pedidos, vehiculos }: RepartosBoardProps) {
  const SIN_ASIGNAR = "__sin_asignar__"

  // Estado: qué pedido está en qué columna
  const [asignaciones, setAsignaciones] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = { [SIN_ASIGNAR]: pedidos.map(p => p.id) }
    vehiculos.forEach(v => { init[v.id] = [] })
    return init
  })

  // Capacidades editables por vehículo
  const [capacidades, setCapacidades] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    vehiculos.forEach(v => { init[v.id] = 0 })
    return init
  })

  const [activeId, setActiveId] = useState<string | null>(null)
  const activePedido = activeId ? pedidos.find(p => p.id === activeId) : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  )

  // Mapa inverso: pedido → columna
  const pedidoAColumna = useMemo(() => {
    const map: Record<string, string> = {}
    Object.entries(asignaciones).forEach(([col, ids]) => {
      ids.forEach(id => { map[id] = col })
    })
    return map
  }, [asignaciones])

  const findColumna = (id: string) => pedidoAColumna[id] ?? null

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
  }

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const colOrigen = findColumna(activeId)
    // overId puede ser una columna o un pedido dentro de una columna
    const colDestino = asignaciones[overId] !== undefined ? overId : findColumna(overId)

    if (!colOrigen || !colDestino || colOrigen === colDestino) return

    setAsignaciones(prev => {
      const origen = prev[colOrigen].filter(id => id !== activeId)
      const destino = [...prev[colDestino], activeId]
      return { ...prev, [colOrigen]: origen, [colDestino]: destino }
    })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const colActual = findColumna(activeId)
    const colDestino = asignaciones[overId] !== undefined ? overId : findColumna(overId)

    if (!colActual || !colDestino || colActual !== colDestino) return

    // Reordenar dentro de la misma columna
    setAsignaciones(prev => {
      const col = [...prev[colActual]]
      const fromIdx = col.indexOf(activeId)
      const toIdx = col.indexOf(overId)
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev
      col.splice(fromIdx, 1)
      col.splice(toIdx, 0, activeId)
      return { ...prev, [colActual]: col }
    })
  }

  // Columnas en orden: sin asignar primero, luego vehículos
  const columnas = [
    { id: SIN_ASIGNAR, label: "Sin asignar" },
    ...vehiculos.map(v => ({ id: v.id, label: `${v.patente} · ${v.marca} ${v.modelo}` })),
  ]

  // Resumen
  const totalAsignados = Object.entries(asignaciones)
    .filter(([k]) => k !== SIN_ASIGNAR)
    .reduce((sum, [, ids]) => sum + ids.length, 0)
  const totalSinAsignar = (asignaciones[SIN_ASIGNAR] ?? []).length

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex flex-wrap gap-3 text-sm">
        <Badge variant="outline">{pedidos.length} pedidos totales</Badge>
        <Badge variant="default">{totalAsignados} asignados</Badge>
        {totalSinAsignar > 0 && <Badge variant="secondary">{totalSinAsignar} sin asignar</Badge>}
      </div>

      {vehiculos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay vehículos registrados. Agregá vehículos en la sección <strong>Vehículos</strong> para usar el planificador de repartos.
        </p>
      )}

      {/* Tablero con scroll horizontal */}
      <div className="overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-max">
            {columnas.map(col => (
              <VehiculoColumna
                key={col.id}
                vehiculoId={col.id}
                label={col.label}
                pedidosIds={asignaciones[col.id] ?? []}
                allPedidos={pedidos}
                capacidad={col.id === SIN_ASIGNAR ? 0 : (capacidades[col.id] ?? 0)}
                onCapacidadChange={val =>
                  setCapacidades(prev => ({ ...prev, [col.id]: val }))
                }
              />
            ))}
          </div>

          <DragOverlay>
            {activePedido && (
              <div className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm shadow-lg rotate-1 opacity-90">
                <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{activePedido.cliente}</p>
                  <p className="text-muted-foreground text-xs">{activePedido.producto} × {activePedido.cantidad}</p>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
