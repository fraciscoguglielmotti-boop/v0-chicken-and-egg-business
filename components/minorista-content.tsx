"use client"

import { useMemo } from "react"
import {
  Home,
  ShoppingBag,
  Truck,
  Tag,
  Users,
  Package,
  Wallet,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency } from "@/lib/utils"
import { buildCostTimeline, getCostAtDate } from "@/lib/cost-timeline"
import {
  MnCliente,
  MnProducto,
  MnPedido,
  MnItemPedido,
  MnItemConNombre,
  RepartoMinorista,
  RendicionMinorista,
  ESTADO_COLOR,
  ESTADO_LABEL,
  pedidoFecha,
  pedidoNumero,
  clienteNombre,
} from "./minorista/types"
import { ClientesMinoristas } from "./minorista/clientes-minoristas"
import { CatalogoMinoristas } from "./minorista/catalogo-minoristas"
import { PedidosMinoristas } from "./minorista/pedidos-minoristas"
import { RepartosMinoristas } from "./minorista/repartos-minoristas"
import { EtiquetasMinoristas } from "./minorista/etiquetas-minoristas"
import { RendicionMinoristas } from "./minorista/rendicion-minoristas"

interface CompraRow {
  fecha: string
  producto?: string
  cantidad?: number
  precio_unitario?: number
  total?: number
}

export interface PedidoCosto {
  costo: number
  ganancia: number
  margenPct: number
  itemsConCosto: number
  itemsSinCosto: number
}

export function MinoristaContent() {
  const { data: clientes = [], mutate: mutateClientes } =
    useSupabase<MnCliente>("mn_clientes", { orderBy: "nombre", ascending: true })
  const { data: productos = [], mutate: mutateProductos } =
    useSupabase<MnProducto>("mn_productos", { orderBy: "nombre", ascending: true })
  const { data: pedidos = [], mutate: mutatePedidos } =
    useSupabase<MnPedido>("mn_pedidos", { limit: 1000 })
  const { data: items = [], mutate: mutateItems } =
    useSupabase<MnItemPedido>("mn_items_pedido", { limit: 2000 })
  const { data: repartos = [], mutate: mutateRepartos } =
    useSupabase<RepartoMinorista>("repartos_minoristas")
  const { data: rendiciones = [], mutate: mutateRendiciones } =
    useSupabase<RendicionMinorista>("rendiciones_minoristas")
  const { data: compras = [] } = useSupabase<CompraRow>("compras")

  // Enrich items with product name from mn_productos
  const productosById = useMemo(() => {
    const m = new Map<number, MnProducto>()
    productos.forEach((p) => m.set(p.id, p))
    return m
  }, [productos])

  const itemsConNombre = useMemo<MnItemConNombre[]>(() => {
    return items.map((it) => ({
      ...it,
      nombre_producto: it.producto_id
        ? productosById.get(it.producto_id)?.nombre ?? `Producto ${it.producto_id}`
        : it.notas || "Producto libre",
    }))
  }, [items, productosById])

  const costTimeline = useMemo(() => buildCostTimeline(compras), [compras])

  const costoByPedido = useMemo(() => {
    const m = new Map<string, PedidoCosto>()
    const itemsByPed = new Map<string, MnItemConNombre[]>()
    for (const it of itemsConNombre) {
      const key = String(it.pedido_id)
      const arr = itemsByPed.get(key) ?? []
      arr.push(it)
      itemsByPed.set(key, arr)
    }
    for (const p of pedidos) {
      const key = String(p.id)
      const its = itemsByPed.get(key) ?? []
      let costo = 0
      let conCosto = 0
      let sinCosto = 0
      const fecha = pedidoFecha(p)
      for (const it of its) {
        const c = getCostAtDate(it.nombre_producto, fecha, costTimeline)
        if (c > 0) {
          costo += c * it.cantidad
          conCosto++
        } else {
          sinCosto++
        }
      }
      const ganancia = (p.total ?? 0) - costo
      const margenPct = (p.total ?? 0) > 0 ? (ganancia / p.total) * 100 : 0
      m.set(key, { costo, ganancia, margenPct, itemsConCosto: conCosto, itemsSinCosto: sinCosto })
    }
    return m
  }, [pedidos, itemsConNombre, costTimeline])

  return (
    <Tabs defaultValue="hoy" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto">
        <TabsTrigger value="hoy">
          <Home className="h-4 w-4 mr-1.5" />
          Hoy
        </TabsTrigger>
        <TabsTrigger value="pedidos">
          <ShoppingBag className="h-4 w-4 mr-1.5" />
          Pedidos
        </TabsTrigger>
        <TabsTrigger value="repartos">
          <Truck className="h-4 w-4 mr-1.5" />
          Repartos
        </TabsTrigger>
        <TabsTrigger value="etiquetas">
          <Tag className="h-4 w-4 mr-1.5" />
          Etiquetas
        </TabsTrigger>
        <TabsTrigger value="clientes">
          <Users className="h-4 w-4 mr-1.5" />
          Clientes
        </TabsTrigger>
        <TabsTrigger value="catalogo">
          <Package className="h-4 w-4 mr-1.5" />
          Catálogo
        </TabsTrigger>
        <TabsTrigger value="rendicion">
          <Wallet className="h-4 w-4 mr-1.5" />
          Rendición
        </TabsTrigger>
      </TabsList>

      <TabsContent value="hoy">
        <HoyTab
          pedidos={pedidos}
          items={itemsConNombre}
          clientes={clientes}
          repartos={repartos}
          costoByPedido={costoByPedido}
        />
      </TabsContent>

      <TabsContent value="pedidos">
        <PedidosMinoristas
          pedidos={pedidos}
          items={itemsConNombre}
          clientes={clientes}
          productos={productos}
          mutatePedidos={mutatePedidos}
          mutateItems={mutateItems}
          costoByPedido={costoByPedido}
        />
      </TabsContent>

      <TabsContent value="repartos">
        <RepartosMinoristas
          repartos={repartos}
          pedidos={pedidos}
          items={itemsConNombre}
          clientes={clientes}
          mutateRepartos={mutateRepartos}
          mutatePedidos={mutatePedidos}
        />
      </TabsContent>

      <TabsContent value="etiquetas">
        <EtiquetasMinoristas
          pedidos={pedidos}
          items={itemsConNombre}
          clientes={clientes}
          repartos={repartos}
        />
      </TabsContent>

      <TabsContent value="clientes">
        <ClientesMinoristas clientes={clientes} mutate={mutateClientes} />
      </TabsContent>

      <TabsContent value="catalogo">
        <CatalogoMinoristas
          productos={productos}
          mutateProductos={mutateProductos}
        />
      </TabsContent>

      <TabsContent value="rendicion">
        <RendicionMinoristas
          repartos={repartos}
          pedidos={pedidos}
          clientes={clientes}
          rendiciones={rendiciones}
          mutateRendiciones={mutateRendiciones}
        />
      </TabsContent>
    </Tabs>
  )
}

// ── Hoy ──────────────────────────────────────────────────────────────────────

function HoyTab({
  pedidos,
  items,
  clientes,
  repartos,
  costoByPedido,
}: {
  pedidos: MnPedido[]
  items: MnItemConNombre[]
  clientes: MnCliente[]
  repartos: RepartoMinorista[]
  costoByPedido: Map<string, PedidoCosto>
}) {
  const hoy = new Date().toISOString().slice(0, 10)

  const clientesById = useMemo(() => {
    const m = new Map<number, MnCliente>()
    clientes.forEach((c) => m.set(c.id, c))
    return m
  }, [clientes])

  const pedidosById = useMemo(() => {
    const m = new Map<string, MnPedido>()
    pedidos.forEach((p) => m.set(String(p.id), p))
    return m
  }, [pedidos])

  const itemsByPedido = useMemo(() => {
    const m = new Map<string, MnItemConNombre[]>()
    items.forEach((it) => {
      const key = String(it.pedido_id)
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(it)
    })
    return m
  }, [items])

  const pedidosHoy = pedidos.filter((p) => pedidoFecha(p) === hoy)
  const totalHoy = pedidosHoy.reduce((s, p) => s + (p.total || 0), 0)
  const enReparto = pedidosHoy.filter((p) => p.estado === "en_reparto").length
  const entregados = pedidosHoy.filter((p) => p.estado === "entregado").length
  const fallidos = pedidosHoy.filter((p) => p.estado === "cancelado").length
  const pendientes = pedidosHoy.filter((p) =>
    ["pendiente", "confirmado"].includes(p.estado)
  ).length

  const pedidosCobrados = pedidosHoy.filter((p) => p.estado === "entregado")
  const gananciaHoy = pedidosCobrados.reduce(
    (s, p) => s + (costoByPedido.get(String(p.id))?.ganancia ?? 0),
    0
  )
  const ventasCobradasHoy = pedidosCobrados.reduce((s, p) => s + (p.total ?? 0), 0)
  const margenPctHoy = ventasCobradasHoy > 0 ? (gananciaHoy / ventasCobradasHoy) * 100 : 0
  const itemsSinCostoHoy = pedidosHoy.reduce(
    (s, p) => s + (costoByPedido.get(String(p.id))?.itemsSinCosto ?? 0),
    0
  )

  const repartosHoy = repartos.filter((r) => r.fecha === hoy)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Pedidos hoy"
          value={String(pedidosHoy.length)}
          subtitle={`Total ${formatCurrency(totalHoy)}`}
          icon={ShoppingCart}
          variant="success"
        />
        <StatCard
          title="Pendientes"
          value={String(pendientes)}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="En reparto"
          value={String(enReparto)}
          icon={Truck}
        />
        <StatCard
          title="Entregados"
          value={String(entregados)}
          subtitle={fallidos > 0 ? `${fallidos} cancelados` : undefined}
          icon={CheckCircle2}
          variant={fallidos > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          title="Ganancia (entregados hoy)"
          value={formatCurrency(gananciaHoy)}
          subtitle={ventasCobradasHoy > 0 ? `${margenPctHoy.toFixed(1)}% margen` : "Sin entregas aún"}
          icon={DollarSign}
          variant={gananciaHoy >= 0 ? "success" : "warning"}
        />
        <StatCard
          title="Ventas cobradas hoy"
          value={formatCurrency(ventasCobradasHoy)}
          subtitle={`${pedidosCobrados.length} entregado(s)`}
          icon={TrendingUp}
        />
        {itemsSinCostoHoy > 0 && (
          <StatCard
            title="Items sin costo"
            value={String(itemsSinCostoHoy)}
            subtitle="Productos sin compra registrada"
            icon={AlertTriangle}
            variant="warning"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Repartos de hoy</h3>
              <Badge variant="outline">{repartosHoy.length}</Badge>
            </div>
            {repartosHoy.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Aún no hay repartos para hoy
              </p>
            ) : (
              <div className="space-y-2">
                {repartosHoy.map((r) => {
                  const ped = (r.orden_pedidos || []).length
                  const tot = (r.orden_pedidos || []).reduce(
                    (s, id) => s + (pedidosById.get(id)?.total || 0),
                    0
                  )
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-2.5 rounded border bg-muted/30"
                    >
                      <div>
                        <div className="font-medium text-sm">{r.nombre}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.repartidor || "Sin asignar"} · {ped} pedidos
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{formatCurrency(tot)}</div>
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
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Pedidos recientes (hoy)</h3>
              <Badge variant="outline">{pedidosHoy.length}</Badge>
            </div>
            {pedidosHoy.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Todavía no hay pedidos hoy
              </p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {pedidosHoy
                  .slice()
                  .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
                  .slice(0, 10)
                  .map((p) => {
                    const cli = p.cliente_id ? clientesById.get(p.cliente_id) : undefined
                    const its = itemsByPedido.get(String(p.id)) || []
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 p-2 rounded border bg-card"
                      >
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {pedidoNumero(p)}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {cli ? clienteNombre(cli) : "Sin cliente"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {its.map((it) => `${it.cantidad}× ${it.nombre_producto}`).join(", ")}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold">{formatCurrency(p.total)}</div>
                          <Badge className={`${ESTADO_COLOR[p.estado]} border text-[9px]`}>
                            {ESTADO_LABEL[p.estado]}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {fallidos > 0 && (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-rose-800">
            <AlertTriangle className="h-4 w-4" />
            Hoy hay {fallidos} pedido(s) cancelado(s). Revisá la pestaña Pedidos.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
