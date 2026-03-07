"use client"

import { useState } from "react"
import { Plus, Trash2, FileDown, ClipboardList, RotateCcw, ShoppingCart, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { useSupabase, insertRow, deleteRow, updateRow } from "@/hooks/use-supabase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RepartosBoard } from "./repartos-board"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface Pedido {
  id: string
  cliente: string
  producto: string
  cantidad: number
  precio_unitario: number
  observaciones: string
  created_at: string
}

interface Cliente {
  id: string
  nombre: string
}

interface Producto {
  id: string
  nombre: string
  activo: boolean
}

const emptyForm = {
  cliente: "",
  producto: "",
  cantidad: "",
  precio_unitario: "",
  observaciones: "",
}

export function PedidosContent() {
  const { toast } = useToast()
  const { data: pedidosDesc = [], isLoading, mutate } = useSupabase<Pedido>("pedidos_dia")
  const { data: clientes = [] } = useSupabase<Cliente>("clientes")
  const { data: productosAll = [] } = useSupabase<Producto>("productos")
  const { data: vehiculos = [] } = useSupabase<{ id: string; patente: string; marca: string; modelo: string }>("vehiculos")
  const productos = productosAll.filter((p) => p.activo)
  const pedidos = [...pedidosDesc].reverse() // mostrar en orden de carga (más nuevo al final)
  const [form, setForm] = useState(emptyForm)
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.cliente || !form.producto || !form.cantidad) return

    try {
      await insertRow("pedidos_dia", {
        cliente: form.cliente.trim(),
        producto: form.producto.trim(),
        cantidad: parseFloat(form.cantidad),
        precio_unitario: parseFloat(form.precio_unitario) || 0,
        observaciones: form.observaciones.trim() || null,
      })

      await mutate()
      setForm(emptyForm)
      toast({ title: "Pedido agregado", description: `${form.cliente.trim()} — ${form.producto.trim()}` })
    } catch (err: any) {
      toast({ title: "Error al agregar", description: err?.message ?? "Error desconocido", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRow("pedidos_dia", id)
      await mutate()
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err?.message ?? "Error desconocido", variant: "destructive" })
    }
  }

  const handleClear = async () => {
    if (!confirm(`¿Borrar los ${pedidos.length} pedidos del día?`)) return
    try {
      await Promise.all(pedidos.map((p) => deleteRow("pedidos_dia", p.id)))
      await mutate()
      toast({ title: "Lista limpiada", description: "Los pedidos fueron eliminados." })
    } catch (err: any) {
      toast({ title: "Error al limpiar", description: err?.message ?? "Error desconocido", variant: "destructive" })
    }
  }

  const handleEdit = (p: Pedido) => {
    setEditingPedido(p)
    setEditForm({
      cliente: p.cliente,
      producto: p.producto,
      cantidad: String(p.cantidad),
      precio_unitario: p.precio_unitario > 0 ? String(p.precio_unitario) : "",
      observaciones: p.observaciones || "",
    })
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPedido) return
    try {
      await updateRow("pedidos_dia", editingPedido.id, {
        cliente: editForm.cliente.trim(),
        producto: editForm.producto.trim(),
        cantidad: parseFloat(editForm.cantidad),
        precio_unitario: parseFloat(editForm.precio_unitario) || 0,
        observaciones: editForm.observaciones.trim() || null,
      })
      await mutate()
      setEditingPedido(null)
      toast({ title: "Pedido actualizado", description: `${editForm.cliente} — ${editForm.producto}` })
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err?.message ?? "Error desconocido", variant: "destructive" })
    }
  }

  const totalPedidos = pedidos.reduce((sum, p) => sum + p.cantidad * p.precio_unitario, 0)

  const handleCargarVentas = async () => {
    if (pedidos.length === 0) return
    if (!confirm(`¿Cargar los ${pedidos.length} pedidos como ventas del día? Esto los registrará en la sección Ventas.`)) return

    const fecha = new Date().toISOString().split("T")[0]
    try {
      await Promise.all(
        pedidos.map((p) =>
          insertRow("ventas", {
            fecha,
            cliente_nombre: p.cliente,
            producto_nombre: p.producto,
            cantidad: p.cantidad,
            precio_unitario: p.precio_unitario,
          })
        )
      )
      toast({
        title: "Ventas cargadas",
        description: `${pedidos.length} pedido${pedidos.length !== 1 ? "s" : ""} registrado${pedidos.length !== 1 ? "s" : ""} en Ventas.`,
      })
    } catch (err: any) {
      toast({ title: "Error al cargar ventas", description: err?.message ?? "Error desconocido", variant: "destructive" })
    }
  }

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

    // Resumen de cajones
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    const tiposCajones = [
      { label: "Pollo A", keyword: "pollo a" },
      { label: "Pollo B", keyword: "pollo b" },
      { label: "Cajón N1 (Huevo)", keyword: "cajon n" },
    ]

    const resumenCajones = tiposCajones
      .map(({ label, keyword }) => ({
        label,
        total: pedidos
          .filter((p) => normalize(p.producto).includes(keyword))
          .reduce((sum, p) => sum + p.cantidad, 0),
      }))
      .filter((c) => c.total > 0)

    const totalPollos = pedidos
      .filter((p) => normalize(p.producto).includes("pollo"))
      .reduce((sum, p) => sum + p.cantidad, 0)

    if (resumenCajones.length > 0) {
      const yCajones = (doc as any).lastAutoTable?.finalY ?? finalY + 40
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("Resumen de cajones", 14, yCajones + 12)

      const bodyFilas: any[] = resumenCajones.map((c) => [c.label, c.total])
      if (resumenCajones.some((c) => c.label.startsWith("Pollo"))) {
        bodyFilas.push(["Total pollos (A + B)", totalPollos])
      }

      autoTable(doc, {
        startY: yCajones + 18,
        head: [["Tipo", "Cajones"]],
        body: bodyFilas,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [40, 90, 40], textColor: 255, fontStyle: "bold" },
        columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
        didParseCell: (data) => {
          if (data.row.index === bodyFilas.length - 1 && resumenCajones.some((c) => c.label.startsWith("Pollo"))) {
            data.cell.styles.fontStyle = "bold"
            data.cell.styles.fillColor = [220, 240, 220]
          }
        },
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
    <Tabs defaultValue="pedidos" className="space-y-6">
      <TabsList>
        <TabsTrigger value="pedidos">Pedidos del día</TabsTrigger>
        <TabsTrigger value="repartos">
          Repartos
          {pedidos.length > 0 && (
            <span className="ml-2 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5">
              {pedidos.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="repartos">
        <RepartosBoard pedidos={pedidos} vehiculos={vehiculos} />
      </TabsContent>

      <TabsContent value="pedidos">
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
              <Select value={form.cliente} onValueChange={(v) => setForm({ ...form, cliente: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Producto *</Label>
              <Select value={form.producto} onValueChange={(v) => setForm({ ...form, producto: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <Button variant="outline" onClick={handleCargarVentas} disabled={pedidos.length === 0}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Cargar como ventas
          </Button>
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
          <p className="font-medium">{isLoading ? "Cargando..." : "Sin pedidos por ahora"}</p>
          {!isLoading && <p className="text-sm mt-1">Usá el formulario de arriba para ir anotando</p>}
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
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(p.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingPedido} onOpenChange={(open) => { if (!open) setEditingPedido(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar pedido</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cliente *</Label>
                <Select value={editForm.cliente} onValueChange={(v) => setEditForm({ ...editForm, cliente: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Producto *</Label>
                <Select value={editForm.producto} onValueChange={(v) => setEditForm({ ...editForm, producto: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {productos.map((p) => (
                      <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad *</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={editForm.cantidad}
                  onChange={(e) => setEditForm({ ...editForm, cantidad: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Precio unitario</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.precio_unitario}
                  onChange={(e) => setEditForm({ ...editForm, precio_unitario: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea
                value={editForm.observaciones}
                onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
                rows={2}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingPedido(null)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
      </TabsContent>
    </Tabs>
  )
}
