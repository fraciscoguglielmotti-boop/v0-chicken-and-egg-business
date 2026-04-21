/**
 * Tipos que reflejan exactamente las filas de las tablas de Supabase
 * (snake_case, fechas como string ISO). Usalos al leer/escribir con
 * `useSupabase`/`insertRow`/`updateRow`.
 *
 * Los tipos en `lib/types.ts` usan camelCase + Date — solo aplican a legacy
 * local-state / mock data. Mantenerlos permite migración incremental.
 */

// ---------------- Core ----------------

export interface VentaRow {
  id: string
  fecha: string
  cliente_nombre: string
  producto_nombre: string | null
  cantidad: number
  precio_unitario: number
  vendedor: string | null
  observaciones: string | null
  created_at: string | null
}

export interface CobroRow {
  id: string
  fecha: string
  cliente_nombre: string
  monto: number
  metodo_pago: string | null
  cuenta_destino: string | null
  verificado_agroaves: boolean
  observaciones: string | null
  created_at: string | null
}

export interface CompraRow {
  id: string
  fecha: string
  proveedor_nombre: string
  producto: string | null
  cantidad: number
  precio_unitario: number
  total: number
  estado: string | null
  verificado: boolean
  created_at: string | null
}

export interface PagoRow {
  id: string
  fecha: string
  proveedor_nombre: string
  monto: number
  metodo_pago: string | null
  comprobante: string | null
  observaciones: string | null
  created_at: string | null
}

export interface GastoRow {
  id: string
  fecha: string
  categoria: string
  descripcion: string | null
  monto: number
  medio_pago: string | null
  created_at: string | null
}

export interface PagoTarjetaRow {
  id: string
  fecha: string
  tarjeta: string
  monto: number
  cuenta_origen: string | null
  observaciones: string | null
  created_at: string | null
}

// ---------------- MercadoPago ----------------

export interface MovimientoMPRow {
  id: string
  fecha: string
  descripcion: string | null
  monto: number
  tipo: "ingreso" | "egreso"
  contraparte: string | null
  categoria: string | null
  tipo_operacion: string | null
  metodo_pago: string | null
  created_at: string | null
}

// ---------------- Clientes/Proveedores ----------------

export interface ClienteRow {
  id: string
  nombre: string
  cuit: string | null
  telefono: string | null
  direccion: string | null
  localidad: string | null
  saldo: number | null
  created_at: string | null
}

export interface ProveedorRow {
  id: string
  nombre: string
  cuit: string | null
  telefono: string | null
  direccion: string | null
  saldo: number | null
  created_at: string | null
}
