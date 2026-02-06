// Store temporal con datos de ejemplo (se reemplazara con Google Sheets)

import type { Cliente, Proveedor, Venta, Cobro, DashboardStats } from "./types"

// Datos de ejemplo con fechas fijas (strings ISO) para evitar hydration mismatch
export const clientesIniciales: Cliente[] = [
  {
    id: "1",
    nombre: "Carniceria El Buen Corte",
    cuit: "20-12345678-9",
    telefono: "11-5555-1234",
    direccion: "Av. San Martin 1234",
    saldoActual: 45000,
    createdAt: new Date("2024-01-15T12:00:00.000Z"),
  },
  {
    id: "2",
    nombre: "Supermercado Don Pedro",
    cuit: "30-98765432-1",
    telefono: "11-5555-5678",
    direccion: "Calle Mitre 567",
    saldoActual: 78500,
    createdAt: new Date("2024-02-20T12:00:00.000Z"),
  },
  {
    id: "3",
    nombre: "Restaurante La Parrilla",
    cuit: "27-11223344-5",
    telefono: "11-5555-9012",
    direccion: "Belgrano 890",
    saldoActual: 0,
    createdAt: new Date("2024-03-10T12:00:00.000Z"),
  },
  {
    id: "4",
    nombre: "Polleria Central",
    cuit: "20-55667788-0",
    telefono: "11-5555-3456",
    direccion: "Rivadavia 2345",
    saldoActual: 32000,
    createdAt: new Date("2024-04-05T12:00:00.000Z"),
  },
]

export const proveedoresIniciales: Proveedor[] = [
  {
    id: "1",
    nombre: "Granja Los Pollos",
    cuit: "30-11111111-1",
    telefono: "11-4444-1111",
    direccion: "Ruta 8 km 45",
    saldoActual: 120000,
    createdAt: new Date("2024-01-01T12:00:00.000Z"),
  },
  {
    id: "2",
    nombre: "Avicola San Juan",
    cuit: "30-22222222-2",
    telefono: "11-4444-2222",
    direccion: "Parque Industrial",
    saldoActual: 85000,
    createdAt: new Date("2024-01-15T12:00:00.000Z"),
  },
]

export const ventasIniciales: Venta[] = [
  {
    id: "1",
    fecha: new Date("2026-02-05T12:00:00.000Z"),
    clienteId: "1",
    clienteNombre: "Carniceria El Buen Corte",
    items: [
      {
        productoId: "pollo_a",
        productoNombre: "Pollo Calibre A",
        cantidad: 50,
        precioUnitario: 2500,
        subtotal: 125000,
      },
      {
        productoId: "huevo_1",
        productoNombre: "Cajon Huevo N\u00b01",
        cantidad: 10,
        precioUnitario: 8500,
        subtotal: 85000,
      },
    ],
    total: 210000,
    estado: "pendiente",
    createdAt: new Date("2026-02-05T12:00:00.000Z"),
  },
  {
    id: "2",
    fecha: new Date("2026-02-04T12:00:00.000Z"),
    clienteId: "2",
    clienteNombre: "Supermercado Don Pedro",
    items: [
      {
        productoId: "pollo_b",
        productoNombre: "Pollo Calibre B",
        cantidad: 80,
        precioUnitario: 2200,
        subtotal: 176000,
      },
    ],
    total: 176000,
    estado: "pagada",
    createdAt: new Date("2026-02-04T12:00:00.000Z"),
  },
  {
    id: "3",
    fecha: new Date("2026-02-03T12:00:00.000Z"),
    clienteId: "4",
    clienteNombre: "Polleria Central",
    items: [
      {
        productoId: "pollo_a",
        productoNombre: "Pollo Calibre A",
        cantidad: 30,
        precioUnitario: 2500,
        subtotal: 75000,
      },
      {
        productoId: "huevo_2",
        productoNombre: "Cajon Huevo N\u00b02",
        cantidad: 5,
        precioUnitario: 7500,
        subtotal: 37500,
      },
    ],
    total: 112500,
    estado: "parcial",
    createdAt: new Date("2026-02-03T12:00:00.000Z"),
  },
]

export const cobrosIniciales: Cobro[] = [
  {
    id: "1",
    fecha: new Date("2026-02-05T12:00:00.000Z"),
    clienteId: "2",
    clienteNombre: "Supermercado Don Pedro",
    monto: 176000,
    metodoPago: "transferencia",
    observaciones: "Pago completo factura del dia anterior",
    createdAt: new Date("2026-02-05T12:00:00.000Z"),
  },
  {
    id: "2",
    fecha: new Date("2026-02-04T12:00:00.000Z"),
    clienteId: "4",
    clienteNombre: "Polleria Central",
    monto: 50000,
    metodoPago: "efectivo",
    observaciones: "Pago parcial",
    createdAt: new Date("2026-02-04T12:00:00.000Z"),
  },
]

export function calcularStats(): DashboardStats {
  const hoy = new Date("2026-02-05T00:00:00.000Z")
  const inicioMes = new Date("2026-02-01T00:00:00.000Z")

  const ventasHoy = ventasIniciales
    .filter((v) => new Date(v.fecha) >= hoy)
    .reduce((acc, v) => acc + v.total, 0)

  const ventasMes = ventasIniciales
    .filter((v) => new Date(v.fecha) >= inicioMes)
    .reduce((acc, v) => acc + v.total, 0)

  const cobrosHoy = cobrosIniciales
    .filter((c) => new Date(c.fecha) >= hoy)
    .reduce((acc, c) => acc + c.monto, 0)

  const cobrosMes = cobrosIniciales
    .filter((c) => new Date(c.fecha) >= inicioMes)
    .reduce((acc, c) => acc + c.monto, 0)

  const cuentasPorCobrar = clientesIniciales.reduce(
    (acc, c) => acc + c.saldoActual,
    0
  )

  const cuentasPorPagar = proveedoresIniciales.reduce(
    (acc, p) => acc + p.saldoActual,
    0
  )

  return {
    ventasHoy,
    ventasMes,
    cobrosHoy,
    cobrosMes,
    cuentasPorCobrar,
    cuentasPorPagar,
  }
}
