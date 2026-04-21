"use client"

import { useState, useMemo } from "react"
import { FileDown, Tag, CheckSquare, Square, Truck } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import jsPDF from "jspdf"
import {
  ClienteMinorista,
  PedidoMinorista,
  ItemPedidoMinorista,
  RepartoMinorista,
} from "./types"

interface Props {
  pedidos: PedidoMinorista[]
  items: ItemPedidoMinorista[]
  clientes: ClienteMinorista[]
  repartos: RepartoMinorista[]
}

export function EtiquetasMinoristas({ pedidos, items, clientes, repartos }: Props) {
  const { toast } = useToast()
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [repartoId, setRepartoId] = useState<string>("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())

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

  const filtered = useMemo(() => {
    let base = pedidos.filter((p) => p.fecha === fecha)
    if (repartoId !== "all") {
      const r = repartos.find((x) => x.id === repartoId)
      const orden = r?.orden_pedidos || []
      const setIds = new Set(orden)
      base = base.filter((p) => setIds.has(p.id))
      base.sort(
        (a, b) =>
          orden.indexOf(a.id) - orden.indexOf(b.id)
      )
    }
    return base
  }, [pedidos, fecha, repartoId, repartos])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((p) => p.id)))
    }
  }

  const generarEtiquetas = () => {
    const list = filtered.filter((p) => selected.has(p.id))
    if (list.length === 0) {
      toast({
        title: "Sin pedidos",
        description: "Seleccioná al menos un pedido",
        variant: "destructive",
      })
      return
    }

    // Formato térmico 10x15cm (100 x 150 mm), una etiqueta por página
    const doc = new jsPDF({
      unit: "mm",
      format: [100, 150],
      orientation: "portrait",
    })

    list.forEach((p, idx) => {
      if (idx > 0) doc.addPage([100, 150], "portrait")
      const cli = clientesById.get(p.cliente_id || "")
      const its = itemsByPedido.get(p.id) || []

      let y = 8

      // Header: número y fecha
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.text(p.numero, 6, y)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.text(p.fecha, 94, y, { align: "right" })
      y += 2
      doc.setLineWidth(0.3)
      doc.line(6, y, 94, y)
      y += 5

      // Cliente
      doc.setFont("helvetica", "bold")
      doc.setFontSize(14)
      const nombre = cli ? `${cli.nombre} ${cli.apellido}` : "Sin cliente"
      doc.text(nombre, 6, y)
      y += 6

      // Teléfono
      if (cli?.telefono) {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(10)
        doc.text(`Tel: ${cli.telefono}`, 6, y)
        y += 5
      }

      // Dirección (wrap)
      if (cli?.direccion) {
        doc.setFont("helvetica", "bold")
        doc.setFontSize(11)
        const dirLines = doc.splitTextToSize(cli.direccion, 88)
        doc.text(dirLines, 6, y)
        y += dirLines.length * 5 + 1
      }

      // Notas
      if (p.notas) {
        doc.setFont("helvetica", "italic")
        doc.setFontSize(8)
        const notesLines = doc.splitTextToSize(`Nota: ${p.notas}`, 88)
        doc.text(notesLines, 6, y)
        y += notesLines.length * 4 + 2
      }

      // Separador
      doc.setLineWidth(0.2)
      doc.line(6, y, 94, y)
      y += 4

      // Detalle de items
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.text("DETALLE", 6, y)
      y += 5
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      its.forEach((it) => {
        const line = `${it.cantidad} × ${it.nombre_producto}`
        const wrapped = doc.splitTextToSize(line, 60)
        doc.text(wrapped, 6, y)
        doc.text(formatCurrency(it.subtotal), 94, y, { align: "right" })
        y += wrapped.length * 4.5
      })
      y += 2

      // Total
      doc.setLineWidth(0.2)
      doc.line(6, y, 94, y)
      y += 5
      doc.setFont("helvetica", "bold")
      doc.setFontSize(13)
      doc.text("TOTAL", 6, y)
      doc.text(formatCurrency(p.total), 94, y, { align: "right" })
      y += 6

      // Forma de pago
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      const pagoTxt =
        p.forma_pago === "mercadopago" ? "Pago: MercadoPago" : "Pago: Efectivo"
      doc.text(pagoTxt, 6, y)
    })

    doc.save(`etiquetas-${fecha}.pdf`)
    toast({ title: "PDF generado", description: `${list.length} etiquetas` })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="w-full sm:w-48">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-64">
          <Label>Reparto (opcional)</Label>
          <Select value={repartoId} onValueChange={setRepartoId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los pedidos de la fecha</SelectItem>
              {repartos
                .filter((r) => r.fecha === fecha)
                .map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre} ({(r.orden_pedidos || []).length})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {selected.size === filtered.length && filtered.length > 0 ? (
              <>
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" /> Deseleccionar
              </>
            ) : (
              <>
                <Square className="h-3.5 w-3.5 mr-1.5" /> Seleccionar todos
              </>
            )}
          </Button>
          <Button onClick={generarEtiquetas} disabled={selected.size === 0}>
            <FileDown className="h-4 w-4 mr-2" />
            Generar PDF ({selected.size})
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Etiquetas 10×15 cm (térmicas). Una etiqueta por hoja.
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm border-2 border-dashed rounded-lg">
          <Tag className="h-10 w-10 mx-auto mb-2 opacity-30" />
          No hay pedidos para esa fecha / reparto
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((p) => {
            const cli = clientesById.get(p.cliente_id || "")
            const its = itemsByPedido.get(p.id) || []
            const isChecked = selected.has(p.id)
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  isChecked
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-2">
                  {isChecked ? (
                    <CheckSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {p.numero}
                      </Badge>
                      <span className="text-sm font-medium truncate">
                        {cli ? `${cli.nombre} ${cli.apellido}` : "Sin cliente"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {cli?.direccion || "Sin dirección"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {its.map((it) => `${it.cantidad}× ${it.nombre_producto}`).join(", ")}
                    </p>
                    <p className="text-sm font-bold">{formatCurrency(p.total)}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
