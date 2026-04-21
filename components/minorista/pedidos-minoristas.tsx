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
import { createClient } from "@/lib/supabase/client"
import {
  ClienteMinorista,
  ProductoMinorista,
  PromoMinorista,
  PedidoMinorista,
  ItemPedidoMinorista,
  EstadoPedido,
  ESTADO_LABEL,
  ESTADO_COLOR,
  nextPedidoNumero,
} from "./types"

interface Props {
  pedidos: PedidoMinorista[]
  items: ItemPedidoMinorista[]
  clientes: ClienteMinorista[]
  productos: ProductoMinorista[]
  promos: PromoMinorista[]
  mutatePedidos: () => Promise<any>
  mutateItems: () => Promise<any>
}

interface DraftItem {
  producto_id: string | null
  nombre_producto: string
  cantidad: string
  precio_unitario: string
}

const ESTADOS: EstadoPedido[] = [
  "recibido",
  "confirmado",
  "en_reparto",
  "entregado",
  "intento_fallido",
]

export function PedidosMinoristas({
  pedidos,
  items,
  clientes,
  productos,
  promos,
  mutatePedidos,
  mutateItems,
}: Props) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PedidoMinorista | null>(null)
  const [search, setSearch] = useState("")
  const [filterEstado, setFilterEstado] = useState<string>("todos")
  const [filterFecha, setFilterFecha] = useState<string>("")

  const [clienteId, setClienteId] = useState<string>("")
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [formaPago, setFormaPago] = useState<"efectivo" | "mercadopago">("efectivo")
  const [mpLink, setMpLink] = useState("")
  const [notas, setNotas] = useState("")
  const [promoId, setPromoId] = useState<string>("")
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])

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
    const q = search.toLowerCase().trim()
    return pedidos.filter((p) => {
      const cliente = clientesById.get(p.cliente_id || "")
      const clientStr = cliente
        ? `${cliente.nombre} ${cliente.apellido} ${cliente.telefono || ""}`.toLowerCase()
        : ""
      if (q && !(p.numero.toLowerCase().includes(q) || clientStr.includes(q))) {
        return false
      }
      if (filterEstado !== "todos" && p.estado !== filterEstado) return false
      if (filterFecha && p.fecha !== filterFecha) return false
      return true
    })
  }, [pedidos, clientesById, search, filterEstado, filterFecha])

  const resetForm = () => {
    setClienteId("")
    setFecha(new Date().toISOString().slice(0, 10))
    setFormaPago("efectivo")
    setMpLink("")
    setNotas("")
    setPromoId("")
    setDraftItems([
      {
        producto_id: null,
        nombre_producto: "",
        cantidad: "1",
        precio_unitario: "0",
      },
    ])
  }

  const openNew = () => {
    setEditing(null)
    resetForm()
    setOpen(true)
  }

  const openEdit = (p: PedidoMinorista) => {
    setEditing(p)
    setClienteId(p.cliente_id || "")
    setFecha(p.fecha)
    setFormaPago(p.forma_pago)
    setMpLink(p.mp_link || "")
    setNotas(p.notas || "")
    setPromoId(p.promo_id || "")
    const pedidoItems = itemsByPedido.get(p.id) || []
    setDraftItems(
      pedidoItems.map((it) => ({
        producto_id: it.producto_id,
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
    const p = productos.find((x) => x.id === productoId)
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

  const { total, descuento } = useMemo(() => {
    const promo = promos.find((p) => p.id === promoId)
    if (!promo) return { total: subtotal, descuento: 0 }
    if (promo.tipo === "precio_fijo") {
      return { total: promo.valor, descuento: Math.max(0, subtotal - promo.valor) }
    }
    const desc = (subtotal * promo.valor) / 100
    return { total: Math.max(0, subtotal - desc), descuento: desc }
  }, [draftItems, promoId, promos, subtotal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clienteId) {
      toast({
        title: "Falta cliente",
        description: "Seleccioná un cliente antes de guardar.",
        variant: "destructive",
      })
      return
    }
    if (draftItems.length === 0 || draftItems.every((it) => !it.nombre_producto)) {
      toast({
        title: "Sin items",
        description: "Agregá al menos un producto.",
        variant: "destructive",
      })
      return
    }
    try {
      const payload = {
        cliente_id: clienteId,
        fecha,
        forma_pago: formaPago,
        mp_link: formaPago === "mercadopago" ? mpLink || null : null,
        notas: notas.trim() || null,
        promo_id: promoId || null,
        descuento,
        total,
      }
      let pedidoId: string
      if (editing) {
        await updateRow("pedidos_minoristas", editing.id, payload)
        pedidoId = editing.id
        const supabase = createClient()
        await supabase
          .from("items_pedido_minorista")
          .delete()
          .eq("pedido_id", pedidoId)
      } else {
        const inserted = await insertRow("pedidos_minoristas", {
          ...payload,
          numero: nextPedidoNumero(pedidos),
          estado: "recibido" as EstadoPedido,
        })
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
          nombre_producto: it.nombre_producto,
          cantidad: Number(it.cantidad),
          precio_unitario: Number(it.precio_unitario),
          subtotal: Number(it.cantidad) * Number(it.precio_unitario),
        }))
        const { error } = await supabase.from("items_pedido_minorista").insert(rows)
        if (error) throw error
      }

      await Promise.all([mutatePedidos(), mutateItems()])
      toast({ title: editing ? "Pedido actualizado" : "Pedido creado" })
      setOpen(false)
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleDelete = async (p: PedidoMinorista) => {
    if (!confirm(`Eliminar pedido ${p.numero}?`)) return
    try {
      await deleteRow("pedidos_minoristas", p.id)
      await Promise.all([mutatePedidos(), mutateItems()])
      toast({ title: "Pedido eliminado" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const cambiarEstado = async (p: PedidoMinorista, nuevo: EstadoPedido) => {
    try {
      await updateRow("pedidos_minoristas", p.id, { estado: nuevo })
      await mutatePedidos()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const copiarResumen = (p: PedidoMinorista) => {
    const cliente = clientesById.get(p.cliente_id || "")
    const pedidoItems = itemsByPedido.get(p.id) || []
    const lines = [
      `Pedido ${p.numero}`,
      cliente ? `Cliente: ${cliente.nombre} ${cliente.apellido}` : "",
      cliente?.telefono ? `Tel: ${cliente.telefono}` : "",
      cliente?.direccion ? `Dirección: ${cliente.direccion}` : "",
      "",
      ...pedidoItems.map(
        (it) =>
          `• ${it.cantidad} x ${it.nombre_producto} — ${formatCurrency(it.subtotal)}`
      ),
      "",
      `Total: ${formatCurrency(p.total)}`,
      `Pago: ${p.forma_pago}`,
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
            {ESTADOS.map((e) => (
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
          const cliente = clientesById.get(p.cliente_id || "")
          const pedidoItems = itemsByPedido.get(p.id) || []
          return (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">
                        {p.numero}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{p.fecha}</span>
                    </div>
                    <h3 className="font-semibold leading-tight">
                      {cliente
                        ? `${cliente.nombre} ${cliente.apellido}`
                        : "Sin cliente"}
                    </h3>
                    {cliente?.telefono && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {cliente.telefono}
                      </div>
                    )}
                    {cliente?.direccion && (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {cliente.direccion}
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
                      <span className="text-muted-foreground">
                        {formatCurrency(it.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-xs text-muted-foreground uppercase">
                    {p.forma_pago}
                  </span>
                  <span className="text-lg font-bold">{formatCurrency(p.total)}</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <Select
                    value={p.estado}
                    onValueChange={(v) => cambiarEstado(p, v as EstadoPedido)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS.map((e) => (
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
              : "Todavía no hay pedidos. Creá el primero."}
          </div>
        )}
      </div>

      {/* Dialog crear/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Editar ${editing.numero}` : "Nuevo pedido"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Cliente *</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes
                      .filter((c) => c.activo !== false)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre} {c.apellido} · {c.customer_id}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                >
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
                        value={it.producto_id || ""}
                        onValueChange={(v) => pickProducto(idx, v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Elegir" />
                        </SelectTrigger>
                        <SelectContent>
                          {productos
                            .filter((p) => p.activo !== false)
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nombre} ({formatCurrency(p.precio)}/{p.unidad})
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
                        onChange={(e) =>
                          updateDraftItem(idx, { cantidad: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <Label className="text-xs">Precio u.</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={it.precio_unitario}
                        onChange={(e) =>
                          updateDraftItem(idx, { precio_unitario: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-2 text-right text-sm font-medium">
                      {formatCurrency(
                        (Number(it.cantidad) || 0) *
                          (Number(it.precio_unitario) || 0)
                      )}
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

            {/* Promo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Promo (opcional)</Label>
                <Select
                  value={promoId || "none"}
                  onValueChange={(v) => setPromoId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin promo</SelectItem>
                    {promos
                      .filter((p) => p.activo !== false)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre} (
                          {p.tipo === "descuento_pct"
                            ? `${p.valor}% off`
                            : formatCurrency(p.valor)}
                          )
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Forma de pago</Label>
                <Select
                  value={formaPago}
                  onValueChange={(v: any) => setFormaPago(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="mercadopago">MercadoPago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formaPago === "mercadopago" && (
              <div>
                <Label>Link MercadoPago</Label>
                <Input
                  value={mpLink}
                  onChange={(e) => setMpLink(e.target.value)}
                  placeholder="https://mpago.la/..."
                />
              </div>
            )}

            <div>
              <Label>Notas</Label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder="Tocar timbre, horario, etc."
              />
            </div>

            {/* Totales */}
            <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {descuento > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Descuento</span>
                  <span>- {formatCurrency(descuento)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-1">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editing ? "Guardar" : "Crear pedido"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
