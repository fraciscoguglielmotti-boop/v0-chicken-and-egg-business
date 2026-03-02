"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, FileDown, ClipboardList, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface Pedido {
  id: string
  cliente: string
  producto: string
  cantidad: number
  precio_unitario: number
  observaciones: string
}

const STORAGE_KEY = "avigest_pedidos_dia"

const emptyForm = {
  cliente: "",
  producto: "",
  cantidad: "",
  precio_unitario: "",
  observaciones: "",
}

export function PedidosContent() {
  const { toast } = useToast()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [form, setForm] = useState(emptyForm)
  const [loaded, setLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setPedidos(JSON.parse(saved))
    } catch {}
    setLoaded(true)
  }, [])

  // Persist to localStorage on every change
  useEffect(() => {
    if (!loaded) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidos))
  }, [pedidos, loaded])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.cliente.trim() || !form.producto.trim() || !form.cantidad) return

    const nuevo: Pedido = {
      id: crypto.randomUUID(),
      cliente: form.cliente.trim(),
      producto: form.producto.trim(),
      cantidad: parseFloat(form.cantidad),
      precio_unitario: parseFloat(form.precio_unitario) || 0,
      observaciones: form.observaciones.trim(),
    }

    setPedidos((prev) => [...prev, nuevo])
    setForm(emptyForm)
    toast({ title: "Pedido agregado", description: `${nuevo.cliente} — ${nuevo.producto}` })
  }

  const handleDelete = (id: string) => {
    setPedidos((prev) => prev.filter((p) => p.id !== id))
  }

  const handleClear = () => {
    if (!confirm(`¿Borrar los ${pedidos.length} pedidos del día?`)) return
    setPedidos([])
    toast({ title: "Lista limpiada", description: "Los pedidos fueron eliminados." })
  }

  const totalPedidos = pedidos.reduce((sum, p) => sum + p.cantidad * p.precio_unitario, 0)

  const handleGenerarPDF = () => {
    if (pedidos.length === 0) {
      toast({ title: "Sin pedidos", description: "Agregá al menos un pedido primero.", variant: "destructive" })
      return
    }

    const doc = new jsPDF()
    const fecha = new Date().toLocaleDateString("es-AR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    // Header
    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    doc.text("AviGest — Pedidos del día", 14, 20)

    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100)
    doc.text(fecha.charAt(0).toUpperCase() + fecha.slice(1), 14, 28)
    doc.text(`Total de pedidos: ${pedidos.length}`, 14, 34)

    doc.setTextColor(0)

    // Table
    autoTable(doc, {
      startY: 42,
      head: [["#", "Cliente", "Producto", "Cantidad", "Precio Unit.", "Total", "Observaciones"]],
      body: pedidos.map((p, i) => [
        i + 1,
        p.cliente,
        p.producto,
        p.cantidad,
        p.precio_unitario > 0 ? formatCurrency(p.precio_unitario) : "-",
        p.precio_unitario > 0 ? formatCurrency(p.cantidad * p.precio_unitario) : "-",
        p.observaciones || "-",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 8 },
        3: { halign: "center" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    })

    // Resumen por cliente
    const porCliente = pedidos.reduce<Record<string, Pedido[]>>((acc, p) => {
      acc[p.cliente] = [...(acc[p.cliente] || []), p]
      return acc
    }, {})

    const finalY = (doc as any).lastAutoTable?.finalY ?? 60
    if (finalY < 240) {
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("Resumen por cliente", 14, finalY + 12)

      autoTable(doc, {
        startY: finalY + 18,
        head: [["Cliente", "Cant. ítems", "Productos"]],
        body: Object.entries(porCliente).map(([cliente, items]) => [
          cliente,
          items.length,
          items.map((i) => `${i.producto} (${i.cantidad})`).join(", "),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [60, 60, 60], textColor: 255 },
      })
    }

    if (totalPedidos > 0) {
      const y = (doc as any).lastAutoTable?.finalY ?? finalY + 40
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text(`Total estimado: ${formatCurrency(totalPedidos)}`, 14, y + 12)
    }

    doc.save(`pedidos-${new Date().toISOString().split("T")[0]}.pdf`)
    toast({ title: "PDF generado", description: "El archivo se descargó." })
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Agregar pedido
        </h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>Cliente *</Label>
              <Input
                placeholder="Nombre del cliente"
                value={form.cliente}
                onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Producto *</Label>
              <Input
                placeholder="Ej: Pollo A, Huevo"
                value={form.producto}
                onChange={(e) => setForm({ ...form, producto: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Cantidad *</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                placeholder="0"
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Precio unitario (opcional)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={form.precio_unitario}
                onChange={(e) => setForm({ ...form, precio_unitario: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>Observaciones</Label>
              <Textarea
                placeholder="Horario de entrega, instrucciones especiales..."
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                rows={1}
                className="resize-none"
              />
            </div>
            <Button type="submit" className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              Agregar
            </Button>
          </div>
        </form>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""} cargado{pedidos.length !== 1 ? "s" : ""}
          </span>
          {totalPedidos > 0 && (
            <Badge variant="secondary">Total estimado: {formatCurrency(totalPedidos)}</Badge>
          )}
        </div>
        <div className="flex gap-2">
          {pedidos.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClear}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Limpiar lista
            </Button>
          )}
          <Button onClick={handleGenerarPDF} disabled={pedidos.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            Generar PDF
          </Button>
        </div>
      </div>

      {/* List */}
      {pedidos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground rounded-lg border border-dashed">
          <ClipboardList className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Sin pedidos por ahora</p>
          <p className="text-sm mt-1">Usá el formulario de arriba para ir anotando</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold">#</th>
                <th className="text-left p-3 font-semibold">Cliente</th>
                <th className="text-left p-3 font-semibold">Producto</th>
                <th className="text-right p-3 font-semibold">Cantidad</th>
                <th className="text-right p-3 font-semibold">Precio Unit.</th>
                <th className="text-right p-3 font-semibold">Total</th>
                <th className="text-left p-3 font-semibold">Observaciones</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p, i) => (
                <tr key={p.id} className="border-t hover:bg-muted/20">
                  <td className="p-3 text-muted-foreground">{i + 1}</td>
                  <td className="p-3 font-medium">{p.cliente}</td>
                  <td className="p-3">{p.producto}</td>
                  <td className="p-3 text-right">{p.cantidad}</td>
                  <td className="p-3 text-right text-muted-foreground">
                    {p.precio_unitario > 0 ? formatCurrency(p.precio_unitario) : "-"}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {p.precio_unitario > 0 ? formatCurrency(p.cantidad * p.precio_unitario) : "-"}
                  </td>
                  <td className="p-3 text-muted-foreground max-w-[200px] truncate">
                    {p.observaciones || "-"}
                  </td>
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(p.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
