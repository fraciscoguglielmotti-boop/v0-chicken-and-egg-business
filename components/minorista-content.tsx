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
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency } from "@/lib/utils"
import {
  ClienteMinorista,
  ProductoMinorista,
  PromoMinorista,
  PedidoMinorista,
  ItemPedidoMinorista,
  RepartoMinorista,
  RendicionMinorista,
  ESTADO_COLOR,
  ESTADO_LABEL,
} from "./minorista/types"
import { ClientesMinoristas } from "./minorista/clientes-minoristas"
import { CatalogoMinoristas } from "./minorista/catalogo-minoristas"
import { PedidosMinoristas } from "./minorista/pedidos-minoristas"
import { RepartosMinoristas } from "./minorista/repartos-minoristas"
import { EtiquetasMinoristas } from "./minorista/etiquetas-minoristas"
import { RendicionMinoristas } from "./minorista/rendicion-minoristas"

export function MinoristaContent() {
  const {
    data: clientes = [],
    mutate: mutateClientes,
    isLoading: lC,
  } = useSupabase<ClienteMinorista>("clientes_minoristas")
  const {
    data: productos = [],
    mutate: mutateProductos,
  } = useSupabase<ProductoMinorista>("productos_minoristas")
  const {
    data: promos = [],
    mutate: mutatePromos,
  } = useSupabase<PromoMinorista>("promos_minoristas")
  const {
    data: pedidos = [],
    mutate: mutatePedidos,
  } = useSupabase<PedidoMinorista>("pedidos_minoristas")
  const {
    data: items = [],
    mutate: mutateItems,
  } = useSupabase<ItemPedidoMinorista>("items_pedido_minorista")
  const {
    data: repartos = [],
    mutate: mutateRepartos,
  } = useSupabase<RepartoMinorista>("repartos_minoristas")
  const {
    data: rendiciones = [],
    mutate: mutateRendiciones,
  } = useSupabase<RendicionMinorista>("rendiciones_minoristas")

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
          items={items}
          clientes={clientes}
          repartos={repartos}
        />
      </TabsContent>

      <TabsContent value="pedidos">
        <PedidosMinoristas
          pedidos={pedidos}
          items={items}
          clientes={clientes}
          productos={productos}
          promos={promos}
          mutatePedidos={mutatePedidos}
          mutateItems={mutateItems}
        />
      </TabsContent>

      <TabsContent value="repartos">
        <RepartosMinoristas
          repartos={repartos}
          pedidos={pedidos}
          items={items}
          clientes={clientes}
          mutateRepartos={mutateRepartos}
          mutatePedidos={mutatePedidos}
        />
      </TabsContent>

      <TabsContent value="etiquetas">
        <EtiquetasMinoristas
          pedidos={pedidos}
          items={items}
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
          promos={promos}
          mutateProductos={mutateProductos}
          mutatePromos={mutatePromos}
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

// --------- Hoy ---------

function HoyTab({
  pedidos,
  items,
  clientes,
  repartos,
}: {
  pedidos: PedidoMinorista[]
  items: ItemPedidoMinorista[]
  clientes: ClienteMinorista[]
  repartos: RepartoMinorista[]
}) {
  const hoy = new Date().toISOString().slice(0, 10)

  const clientesById = useMemo(() => {
    const m = new Map<string, ClienteMinorista>()
    clientes.forEach((c) => m.set(c.id, c))
    return m
  }, [clientes])

  const pedidosById = useMemo(() => {
    const m = new Map<string, PedidoMinorista>()
    pedidos.forEach((p) => m.set(p.id, p))
    return m
  }, [pedidos])

  const itemsByPedido = useMemo(() => {
    const m = new Map<string, ItemPedidoMinorista[]>()
    items.forEach((it) => {
      if (!m.has(it.pedido_id)) m.set(it.pedido_id, [])
      m.get(it.pedido_id)!.push(it)
    })
    return m
  }, [items])

  const pedidosHoy = pedidos.filter((p) => p.fecha === hoy)
  const totalHoy = pedidosHoy.reduce((s, p) => s + (p.total || 0), 0)
  const enReparto = pedidosHoy.filter((p) => p.estado === "en_reparto").length
  const entregados = pedidosHoy.filter((p) => p.estado === "entregado").length
  const fallidos = pedidosHoy.filter((p) => p.estado === "intento_fallido").length
  const pendientes = pedidosHoy.filter((p) =>
    ["recibido", "confirmado"].includes(p.estado)
  ).length

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
          subtitle={fallidos > 0 ? `${fallidos} fallidos` : undefined}
          icon={CheckCircle2}
          variant={fallidos > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Repartos del día */}
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
                  const tot = (r.orden_pedidos || [])
                    .reduce((s, id) => s + (pedidosById.get(id)?.total || 0), 0)
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
                        <div className="text-sm font-bold">
                          {formatCurrency(tot)}
                        </div>
                        <Badge
                          variant={
                            r.estado === "finalizado" ? "secondary" : "outline"
                          }
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

        {/* Pedidos recientes hoy */}
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
                  .sort((a, b) =>
                    (b.created_at || "").localeCompare(a.created_at || "")
                  )
                  .slice(0, 10)
                  .map((p) => {
                    const cli = clientesById.get(p.cliente_id || "")
                    const its = itemsByPedido.get(p.id) || []
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 p-2 rounded border bg-card"
                      >
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {p.numero}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {cli
                              ? `${cli.nombre} ${cli.apellido}`
                              : "Sin cliente"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {its
                              .map(
                                (it) => `${it.cantidad}× ${it.nombre_producto}`
                              )
                              .join(", ")}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold">
                            {formatCurrency(p.total)}
                          </div>
                          <Badge
                            className={`${ESTADO_COLOR[p.estado]} border text-[9px]`}
                          >
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
            Hoy hay {fallidos} intento(s) de entrega fallido(s). Revisá la pestaña
            Pedidos para reprogramar.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
