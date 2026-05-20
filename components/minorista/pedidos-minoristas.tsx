"use client"

import { useState, useMemo } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  ShoppingBag,
  X,
  Search,
  Filter,
  Phone,
  MapPin,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { useConfirm } from "@/components/confirm-dialog"
import { createClient } from "@/lib/supabase/client"
import {
  MnCliente,
  MnProducto,
  MnPedido,
  MnItemConNombre,
  MnEstadoPedido,
  ESTADO_LABEL,
  ESTADO_COLOR,
  MN_ESTADOS,
  pedidoFecha,
  pedidoNumero,
  clienteNombre,
} from "./types"
import type { PedidoCosto } from "../minorista-content"

interface Props {
  pedidos: MnPedido[]
  items: MnItemConNombre[]
  clientes: MnCliente[]
  productos: MnProducto[]
  mutatePedidos: () => Promise<any>
  mutateItems: () => Promise<any>
  costoByPedido: Map<string, PedidoCosto>
}

interface DraftItem {
  producto_id: number | null
  nombre_producto: string
  cantidad: string
  precio_unitario: string
}

export function PedidosMinoristas({
  pedidos,
  items,
  clientes,
  productos,
  mutatePedidos,
  mutateItems,
  costoByPedido,
}: Props) {
  const { toast } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MnPedido | null>(null)
  const [search, setSearch] = useState("")
  const [filterEstado, setFilterEstado] = useState<string>("todos")
  const [filterFecha, setFilterFecha] = useState<string>("")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clienteId, setClienteId] = useState<string>("")
  const [direccion, setDireccion] = useState("")
  const [metodoPago, setMetodoPago] = useState("efectivo")
  const [notas, setNotas] = useState("")
  const [costoEnvio, setCostoEnvio] = useState("0")
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])

  const clientesById = useMemo(() => {
    const m = new Map<number, MnCliente>()
    clientes.forEach((c) => m.set(c.id, c))
    return m
  }, [clientes])

  const itemsByPedido = useMemo(() => {
    const m = new Map<string, MnItemConNombre[]>()
    items.forEach((it) => {
      const key = String(it.pedido_id)
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(it)
    })
    return m
  }, [items])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return pedidos.filter((p) => {
      const cliente = p.cliente_id ? clientesById.get(p.cliente_id) : undefined
      const clientStr = cliente
        ? `${clienteNombre(cliente)} ${cliente.telefono || ""}`.toLowerCase()
        : ""
      const pedNum = String(p.id)
      if (q && !(pedNum.includes(q) || clientStr.includes(q))) return false
      if (filterEstado !== "todos" && p.estado !== filterEstado) return false
      if (filterFecha && pedidoFecha(p) !== filterFecha) return false
      return true
    })
  }, [pedidos, clientesById, search, filterEstado, filterFecha])

  const resetForm = () => {
    setClienteId("")
    setDireccion("")
    setMetodoPago("efectivo")
    setNotas("")
    setCostoEnvio("0")
    setDraftItems([{ producto_id: null, nombre_producto: "", cantidad: "1", precio_unitario: "0" }])
  }

  const openNew = () => {
    setEditing(null)
    resetForm()
    setOpen(true)
  }

  const openEdit = (p: MnPedido) => {
    setEditing(p)
    setClienteId(p.cliente_id ? String(p.cliente_id) : "")
    setDireccion(p.direccion_entrega || "")
    setMetodoPago(p.metodo_pago || "efectivo")
    setNotas(p.notas || "")
    setCostoEnvio(String(p.costo_envio ?? 0))
    const pedidoItems = itemsByPedido.get(String(p.id)) || []
    setDraftItems(
      pedidoItems.map((it) => ({
        producto_id: it.producto_id ?? null,
        nombre_producto: it.nombre_producto,
        cantidad: String(it.cantidad),
        precio_unitario: String(it.precio_unitario),
      }))
    )
    setOpen(true)
  }

  const addItem = () => {
    setDraftItems((prev) => [
      ...prev,
      { producto_id: null, nombre_producto: "", cantidad: "1", precio_unitario: "0" },
    ])
  }

  const removeItem = (idx: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateDraftItem = (idx: number, patch: Partial<DraftItem>) => {
    setDraftItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const pickProducto = (idx: number, productoId: string) => {
    const p = productos.find((x) => String(x.id) === productoId)
    if (!p) return
    updateDraftItem(idx, {
      producto_id: p.id,
      nombre_producto: p.nombre,
      precio_unitario: String(p.precio),
    })
  }

  const subtotal = useMemo(
    () =>
      draftItems.reduce(
        (s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0),
        0
      ),
    [draftItems]
  )

  const total = subtotal + (Number(costoEnvio) || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    if (draftItems.length === 0 || draftItems.every((it) => !it.nombre_producto)) {
      toast({ title: "Sin items", description: "Agregá al menos un producto.", variant: "destructive" })
      return
    }
    setIsSubmitting(true)
    try {
      const payload: Record<string, any> = {
        cliente_id: clienteId ? Number(clienteId) : null,
        direccion_entrega: direccion.trim() || null,
        metodo_pago: metodoPago,
        notas: notas.trim() || null,
        costo_envio: Number(costoEnvio) || 0,
        subtotal,
        total,
        canal: "manual",
      }

      let pedidoId: number
      if (editing) {
        await updateRow("mn_pedidos", editing.id, payload)
        pedidoId = editing.id
        const supabase = createClient()
        await supabase.from("mn_items_pedido").delete().eq("pedido_id", pedidoId)
      } else {
        const inserted = await insertRow("mn_pedidos", { ...payload, estado: "pendiente" })
        pedidoId = inserted.id
      }

      const validItems = draftItems.filter(
        (it) => it.nombre_producto && Number(it.cantidad) > 0
      )
      if (validItems.length > 0) {
        const supabase = createClient()
        const rows = validItems.map((it) => ({
          pedido_id: pedidoId,
          producto_id: it.producto_id,
          cantidad: Number(it.cantidad),
          precio_unitario: Number(it.precio_unitario),
          subtotal: Number(it.cantidad) * Number(it.precio_unitario),
        }))
        const { error } = await supabase.from("mn_items_pedido").insert(rows)
        if (error) throw error
      }

      await Promise.all([mutatePedidos(), mutateItems()])
      toast({ title: editing ? "Pedido actualizado" : "Pedido creado" })
      setOpen(false)
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (p: MnPedido) => {
    const ok = await confirm({
      title: `Eliminar pedido ${pedidoNumero(p)}?`,
      description: "Se borrarán también sus items.",
      destructive: true,
      confirmLabel: "Eliminar",
    })
    if (!ok) return
    try {
      await deleteRow("mn_pedidos", p.id)
      await Promise.all([mutatePedidos(), mutateItems()])
      toast({ title: "Pedido eliminado" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const cambiarEstado = async (p: MnPedido, nuevo: MnEstadoPedido) => {
    try {
      const extra: Record<string, any> = {}
      if (nuevo === "confirmado" && !p.confirmado_at) {
        extra.confirmado_at = new Date().toISOString()
      }
      if (nuevo === "entregado" && !p.entregado_at) {
        extra.entregado_at = new Date().toISOString()
      }
      await updateRow("mn_pedidos", p.id, { estado: nuevo, ...extra })
      await mutatePedidos()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const copiarResumen = (p: MnPedido) => {
    const cli = p.cliente_id ? clientesById.get(p.cliente_id) : undefined
    const pedidoItems = itemsByPedido.get(String(p.id)) || []
    const lines = [
      `Pedido ${pedidoNumero(p)}`,
      cli ? `Cliente: ${clienteNombre(cli)}` : "",
      cli?.telefono ? `Tel: ${cli.telefono}` : "",
      p.direccion_entrega ? `Dirección: ${p.direccion_entrega}` : "",
      "",
      ...pedidoItems.map(
        (it) => `• ${it.cantidad} x ${it.nombre_producto} — ${formatCurrency(it.subtotal)}`
      ),
      "",
      `Total: ${formatCurrency(p.total)}`,
      `Pago: ${p.metodo_pago || ""}`,
      p.notas ? `Notas: ${p.notas}` : "",
    ]
      .filter(Boolean)
      .join("\n")
    navigator.clipboard.writeText(lines)
    toast({ title: "Resumen copiado", description: "Pegalo en WhatsApp" })
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número o cliente"
            className="pl-9"
          />
        </div>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="h-4 w-4 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {MN_ESTADOS.map((e) => (
              <SelectItem key={e} value={e}>
                {ESTADO_LABEL[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filterFecha}
          onChange={(e) => setFilterFecha(e.target.value)}
          className="w-full sm:w-44"
        />
        {filterFecha && (
          <Button variant="ghost" size="icon" onClick={() => setFilterFecha("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo pedido
        </Button>
      </div>

      {/* Listado */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => {
          const cliente = p.cliente_id ? clientesById.get(p.cliente_id) : undefined
          const pedidoItems = itemsByPedido.get(String(p.id)) || []
          const cg = costoByPedido.get(String(p.id))
          return (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">
                        {pedidoNumero(p)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {pedidoFecha(p)}
                        {p.canal === "whatsapp" && (
                          <span className="ml-1 text-emerald-600">· WA</span>
                        )}
                      </span>
                    </div>
                    <h3 className="font-semibold leading-tight">
                      {cliente ? clienteNombre(cliente) : "Sin cliente"}
                    </h3>
                    {cliente?.telefono && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {cliente.telefono}
                      </div>
                    )}
                    {p.direccion_entrega && (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {p.direccion_entrega}
                      </div>
                    )}
                  </div>
                  <Badge className={`${ESTADO_COLOR[p.estado]} border`}>
                    {ESTADO_LABEL[p.estado]}
                  </Badge>
                </div>

                <div className="text-xs space-y-0.5">
                  {pedidoItems.map((it) => (
                    <div key={it.id} className="flex justify-between">
                      <span>
                        {it.cantidad} × {it.nombre_producto}
                      </span>
                      <span className="text-muted-foreground">{formatCurrency(it.subtotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-2 space-y-1">
                  {cg && (cg.itemsConCosto > 0 || cg.itemsSinCosto > 0) && (
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        Costo {formatCurrency(cg.costo)}
                        {cg.itemsSinCosto > 0 && (
                          <span className="ml-1 text-amber-600">({cg.itemsSinCosto} sin costo)</span>
                        )}
                      </span>
                      <span
                        className={
                          cg.ganancia >= 0
                            ? "text-emerald-600 font-medium"
                            : "text-rose-600 font-medium"
                        }
                      >
                        Gan. {formatCurrency(cg.ganancia)} ({cg.margenPct.toFixed(0)}%)
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase">
                      {p.metodo_pago || "—"}
                    </span>
                    <span className="text-lg font-bold">{formatCurrency(p.total)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <Select
                    value={p.estado}
                    onValueChange={(v) => cambiarEstado(p, v as MnEstadoPedido)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MN_ESTADOS.map((e) => (
                        <SelectItem key={e} value={e}>
                          {ESTADO_LABEL[e]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => copiarResumen(p)}
                      title="Copiar para WhatsApp"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-rose-600"
                      onClick={() => handleDelete(p)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
            <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-30" />
            {search || filterEstado !== "todos" || filterFecha
              ? "No hay pedidos con esos filtros"
              : "Todavía no hay pedidos."}
          </div>
        )}
      </div>

      {/* Dialog crear/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Editar pedido ${pedidoNumero(editing)}` : "Nuevo pedido"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Cliente</Label>
                <Select
                  value={clienteId || "none"}
                  onValueChange={(v) => setClienteId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin cliente</SelectItem>
                    {clientes
                      .filter((c) => c.activo !== false)
                      .map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {clienteNombre(c)} · {c.telefono}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Método de pago</Label>
                <Select value={metodoPago} onValueChange={setMetodoPago}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="mercadopago">MercadoPago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Dirección de entrega</Label>
              <Input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, localidad"
              />
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar item
                </Button>
              </div>
              <div className="space-y-2">
                {draftItems.map((it, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-end p-2 rounded bg-muted/40"
                  >
                    <div className="col-span-12 sm:col-span-5">
                      <Label className="text-xs">Producto</Label>
                      <Select
                        value={it.producto_id ? String(it.producto_id) : ""}
                        onValueChange={(v) => pickProducto(idx, v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Elegir" />
                        </SelectTrigger>
                        <SelectContent>
                          {productos
                            .filter((p) => p.activo !== false)
                            .map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.nombre}
                                {p.precio ? ` (${formatCurrency(p.precio)}/${p.unidad ?? "u"})` : ""}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Label className="text-xs">Cant</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={it.cantidad}
                        onChange={(e) => updateDraftItem(idx, { cantidad: e.target.value })}
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <Label className="text-xs">Precio u.</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={it.precio_unitario}
                        onChange={(e) => updateDraftItem(idx, { precio_unitario: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2 text-right text-sm font-medium">
                      {formatCurrency((Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0))}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-600"
                        onClick={() => removeItem(idx)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Costo de envío</Label>
              <Input
                type="number"
                step="0.01"
                value={costoEnvio}
                onChange={(e) => setCostoEnvio(e.target.value)}
              />
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder="Timbre, horario, referencias..."
              />
            </div>

            {/* Totales */}
            <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {(Number(costoEnvio) || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Envío</span>
                  <span>{formatCurrency(Number(costoEnvio) || 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-1">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando…" : editing ? "Guardar" : "Crear pedido"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </div>
  )
}
