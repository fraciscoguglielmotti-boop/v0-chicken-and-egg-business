// ── mn_clientes ─────────────────────────────────────────────────────────────
export interface MnCliente {
  id: number
  telefono: string
  nombre: string
  zona_id?: number | null
  activo?: boolean
  created_at?: string
}

// ── mn_productos ─────────────────────────────────────────────────────────────
export interface MnProducto {
  id: number
  nombre: string
  descripcion?: string | null
  unidad?: string | null
  precio: number
  activo?: boolean
  created_at?: string
}

// ── mn_zonas ─────────────────────────────────────────────────────────────────
export interface MnZona {
  id: number
  nombre: string
  precio_envio?: number | null
  activo?: boolean
}

// ── mn_pedidos ────────────────────────────────────────────────────────────────
export type MnEstadoPedido =
  | "pendiente"
  | "confirmado"
  | "en_reparto"
  | "entregado"
  | "cancelado"

export interface MnPedido {
  id: number
  cliente_id?: number | null
  estado: MnEstadoPedido
  direccion_entrega?: string | null
  notas_direccion?: string | null
  fecha_entrega?: string | null
  subtotal: number
  costo_envio?: number | null
  total: number
  metodo_pago?: string | null
  pago_status?: string | null
  notas?: string | null
  canal?: string | null
  created_at: string
  updated_at?: string | null
  confirmado_at?: string | null
  entregado_at?: string | null
}

// ── mn_items_pedido ───────────────────────────────────────────────────────────
export interface MnItemPedido {
  id: number
  pedido_id: number
  producto_id?: number | null
  cantidad: number
  precio_unitario: number
  subtotal: number
  notas?: string | null
  created_at: string
}

// Enriched with product name computed at UI layer
export interface MnItemConNombre extends MnItemPedido {
  nombre_producto: string
}

// ── repartos_minoristas (own table, not mn_*) ─────────────────────────────────
export interface RepartoMinorista {
  id: string
  fecha: string
  nombre: string
  repartidor?: string | null
  orden_pedidos: string[] // stores String(mn_pedido.id)
  estado: "armando" | "en_curso" | "finalizado"
  created_at: string
}

// ── rendiciones_minoristas (own table) ────────────────────────────────────────
export interface RendicionMinorista {
  id: string
  reparto_id: string | null
  fecha: string
  repartidor?: string | null
  total_cobrado: number
  efectivo_cobrado: number
  mp_cobrado: number
  entregados: number
  no_entregados: number
  notas?: string | null
  created_at: string
}

// ── display helpers ───────────────────────────────────────────────────────────
export const ESTADO_LABEL: Record<MnEstadoPedido, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  en_reparto: "En reparto",
  entregado: "Entregado",
  cancelado: "Cancelado",
}

export const ESTADO_COLOR: Record<MnEstadoPedido, string> = {
  pendiente: "bg-slate-100 text-slate-700 border-slate-200",
  confirmado: "bg-blue-100 text-blue-700 border-blue-200",
  en_reparto: "bg-amber-100 text-amber-700 border-amber-200",
  entregado: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelado: "bg-rose-100 text-rose-700 border-rose-200",
}

export const MN_ESTADOS: MnEstadoPedido[] = [
  "pendiente",
  "confirmado",
  "en_reparto",
  "entregado",
  "cancelado",
]

export function pedidoFecha(p: MnPedido): string {
  return p.created_at?.slice(0, 10) ?? ""
}

export function pedidoNumero(p: MnPedido): string {
  return `#${p.id}`
}

export function clienteNombre(c: MnCliente): string {
  return c.nombre || c.telefono
}
