export interface ClienteMinorista {
  id: string
  customer_id: string
  nombre: string
  apellido: string
  telefono?: string | null
  direccion?: string | null
  lat?: number | null
  lng?: number | null
  notas?: string | null
  activo: boolean
  created_at: string
}

export interface ProductoMinorista {
  id: string
  nombre: string
  descripcion?: string | null
  unidad: string
  precio: number
  activo: boolean
  created_at: string
}

export interface PromoMinorista {
  id: string
  nombre: string
  descripcion?: string | null
  tipo: "precio_fijo" | "descuento_pct"
  valor: number
  activo: boolean
  created_at: string
}

export type EstadoPedido =
  | "recibido"
  | "confirmado"
  | "en_reparto"
  | "entregado"
  | "intento_fallido"

export interface PedidoMinorista {
  id: string
  numero: string
  cliente_id: string | null
  fecha: string
  estado: EstadoPedido
  total: number
  forma_pago: "efectivo" | "mercadopago"
  mp_link?: string | null
  notas?: string | null
  promo_id?: string | null
  descuento: number
  created_at: string
}

export interface ItemPedidoMinorista {
  id: string
  pedido_id: string
  producto_id: string | null
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  created_at: string
}

export interface RepartoMinorista {
  id: string
  fecha: string
  nombre: string
  repartidor?: string | null
  orden_pedidos: string[]
  estado: "armando" | "en_curso" | "finalizado"
  created_at: string
}

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

export const ESTADO_LABEL: Record<EstadoPedido, string> = {
  recibido: "Recibido",
  confirmado: "Confirmado",
  en_reparto: "En reparto",
  entregado: "Entregado",
  intento_fallido: "Intento fallido",
}

export const ESTADO_COLOR: Record<EstadoPedido, string> = {
  recibido: "bg-slate-100 text-slate-700 border-slate-200",
  confirmado: "bg-blue-100 text-blue-700 border-blue-200",
  en_reparto: "bg-amber-100 text-amber-700 border-amber-200",
  entregado: "bg-emerald-100 text-emerald-700 border-emerald-200",
  intento_fallido: "bg-rose-100 text-rose-700 border-rose-200",
}

export function nextCustomerId(clientes: ClienteMinorista[]): string {
  const nums = clientes
    .map((c) => parseInt(c.customer_id?.replace(/\D/g, "") || "0", 10))
    .filter((n) => !isNaN(n))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `MIN-${String(next).padStart(4, "0")}`
}

export function nextPedidoNumero(pedidos: PedidoMinorista[]): string {
  const nums = pedidos
    .map((p) => parseInt(p.numero?.replace(/\D/g, "") || "0", 10))
    .filter((n) => !isNaN(n))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `PED-${String(next).padStart(4, "0")}`
}
