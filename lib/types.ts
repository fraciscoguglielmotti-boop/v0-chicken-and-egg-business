// Tipos para el sistema de gestión

export interface Cliente {
  id: string
  nombre: string
  cuit?: string
  telefono?: string
  direccion?: string
  saldoActual: number
  createdAt: Date
}

export interface Proveedor {
  id: string
  nombre: string
  cuit?: string
  telefono?: string
  direccion?: string
  saldoActual: number
  createdAt: Date
}

export type ProductoTipo = 'pollo_a' | 'pollo_b' | 'huevo_1' | 'huevo_2'

export interface Producto {
  id: ProductoTipo
  nombre: string
  unidad: string
  precioBase: number
}

export interface Venta {
  id: string
  fecha: Date
  clienteId: string
  clienteNombre: string
  items: VentaItem[]
  total: number
  estado: 'pendiente' | 'pagada' | 'parcial'
  createdAt: Date
}

export interface VentaItem {
  productoId: ProductoTipo
  productoNombre: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

export interface Cobro {
  id: string
  fecha: Date
  clienteId: string
  clienteNombre: string
  monto: number
  metodoPago: 'efectivo' | 'transferencia' | 'cheque'
  comprobante?: string
  observaciones?: string
  createdAt: Date
}

export interface Compra {
  id: string
  fecha: Date
  proveedorId: string
  proveedorNombre: string
  items: CompraItem[]
  total: number
  estado: 'pendiente' | 'pagada' | 'parcial'
  createdAt: Date
}

export interface CompraItem {
  productoId: ProductoTipo
  productoNombre: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

export interface Pago {
  id: string
  fecha: Date
  proveedorId: string
  proveedorNombre: string
  monto: number
  metodoPago: 'efectivo' | 'transferencia' | 'cheque'
  comprobante?: string
  observaciones?: string
  createdAt: Date
}

export interface StockMovement {
  id: string
  fecha: Date
  productoId: ProductoTipo
  productoNombre: string
  tipo: 'compra' | 'venta' | 'ajuste'
  cantidad: number // positive for entrada, negative for salida
  cantidadAnterior: number
  cantidadActual: number
  referencia: string // ID de la compra/venta/ajuste
  observaciones?: string
}

export interface StockActual {
  productoId: ProductoTipo
  productoNombre: string
  cantidad: number
  unidad: string
  ultimaActualizacion: Date
  stockMinimo?: number
  alertaBajo: boolean
}

export interface MovimientoCuenta {
  id: string
  fecha: Date
  tipo: 'venta' | 'cobro' | 'compra' | 'pago'
  descripcion: string
  debe: number
  haber: number
  saldo: number
}

export interface DashboardStats {
  ventasHoy: number
  ventasMes: number
  cobrosHoy: number
  cobrosMes: number
  cuentasPorCobrar: number
  cuentasPorPagar: number
}

export const PRODUCTOS: Producto[] = [
  { id: 'pollo_a', nombre: 'Pollo Calibre A', unidad: 'kg', precioBase: 0 },
  { id: 'pollo_b', nombre: 'Pollo Calibre B', unidad: 'kg', precioBase: 0 },
  { id: 'huevo_1', nombre: 'Cajon Huevo N°1', unidad: 'cajon', precioBase: 0 },
  { id: 'huevo_2', nombre: 'Cajon Huevo N°2', unidad: 'cajon', precioBase: 0 },
]
