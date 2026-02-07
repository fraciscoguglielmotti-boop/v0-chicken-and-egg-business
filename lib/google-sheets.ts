// Google Sheets Integration
// Para conectar con tus hojas de cálculo existentes
import { parseDate } from "@/lib/utils"

export interface SheetConfig {
  spreadsheetId: string
  credentials: {
    client_email: string
    private_key: string
  }
}

export interface SheetRange {
  sheetName: string
  range: string
}

// Nombres de las hojas esperadas en Google Sheets
export const SHEET_NAMES = {
  VENTAS: "Ventas",
  COBROS: "Cobros",
  COMPRAS: "Compras",
  PAGOS: "Pagos",
  CLIENTES: "Clientes",
  PROVEEDORES: "Proveedores",
  VENDEDORES: "Vendedores",
  GASTOS: "Gastos",
  INVERSIONES: "Inversiones",
  STOCK: "Stock",
  STOCK_MOVIMIENTOS: "StockMovimientos",
} as const

// Estructura de columnas esperada para cada hoja
export const SHEET_COLUMNS = {
  VENTAS: [
    "ID",
    "Fecha",
    "ClienteID",
    "Cliente",
    "Productos",
    "Cantidad",
    "PrecioUnitario",
    "Vendedor",
  ],
  COBROS: [
    "ID",
    "Fecha",
    "ClienteID",
    "Cliente",
    "Monto",
    "MetodoPago",
    "Observaciones",
    "Vendedor",
  ],
  COMPRAS: [
    "ID",
    "Fecha",
    "Proveedor",
    "Producto",
    "Cantidad",
    "Precio Unitario",
    "Total",
    "Estado",
  ],
  PAGOS: [
    "ID",
    "Fecha",
    "ProveedorID",
    "Proveedor",
    "Monto",
    "MetodoPago",
    "Observaciones",
  ],
  CLIENTES: [
    "ID",
    "Nombre",
    "CUIT",
    "Telefono",
    "Direccion",
    "Saldo",
  ],
  PROVEEDORES: [
    "ID",
    "Nombre",
    "CUIT",
    "Telefono",
    "Direccion",
    "Saldo",
  ],
  VENDEDORES: [
    "ID",
    "Nombre",
    "Comision",
    "FechaAlta",
  ],
  GASTOS: [
    "ID",
    "Fecha",
    "Tipo",
    "Categoria",
    "Descripcion",
    "Monto",
  ],
  INVERSIONES: [
    "ID",
    "Fecha",
    "Tipo",
    "Descripcion",
    "Monto",
  ],
  STOCK: [
    "ProductoID",
    "Producto",
    "Cantidad",
    "Unidad",
    "UltimaActualizacion",
    "StockMinimo",
  ],
  STOCK_MOVIMIENTOS: [
    "ID",
    "Fecha",
    "ProductoID",
    "Producto",
    "Tipo",
    "Cantidad",
    "CantidadAnterior",
    "CantidadActual",
    "Referencia",
    "Observaciones",
  ],
}

// API Route handlers para Google Sheets
export async function fetchSheetData(sheetName: string): Promise<unknown[][]> {
  const response = await fetch(`/api/sheets?sheet=${sheetName}`)
  if (!response.ok) {
    throw new Error(`Error fetching sheet: ${sheetName}`)
  }
  return response.json()
}

export async function appendToSheet(
  sheetName: string,
  values: unknown[][]
): Promise<void> {
  const response = await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetName, values }),
  })
  if (!response.ok) {
    throw new Error(`Error appending to sheet: ${sheetName}`)
  }
}

export async function updateSheetRow(
  sheetName: string,
  rowIndex: number,
  values: unknown[]
): Promise<void> {
  const response = await fetch("/api/sheets", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetName, rowIndex, values }),
  })
  if (!response.ok) {
    throw new Error(`Error updating sheet row: ${sheetName}`)
  }
}

// Helpers para parsear datos de sheets
export function parseVentaFromRow(row: string[]): {
  id: string
  fecha: Date
  clienteNombre: string
  producto: string
  cantidad: number
  precioUnitario: number
  total: number
  estado: string
} {
  return {
    id: row[0],
    fecha: parseDate(row[1]),
    clienteNombre: row[2],
    producto: row[3],
    cantidad: Number.parseFloat(row[4]) || 0,
    precioUnitario: Number.parseFloat(row[5]) || 0,
    total: Number.parseFloat(row[6]) || 0,
    estado: row[7] || "pendiente",
  }
}

export function parseCobroFromRow(row: string[]): {
  id: string
  fecha: Date
  clienteNombre: string
  monto: number
  metodoPago: string
  observaciones: string
} {
  return {
    id: row[0],
    fecha: parseDate(row[1]),
    clienteNombre: row[2],
    monto: Number.parseFloat(row[3]) || 0,
    metodoPago: row[4] || "efectivo",
    observaciones: row[5] || "",
  }
}

export function parseClienteFromRow(row: string[]): {
  id: string
  nombre: string
  cuit: string
  telefono: string
  direccion: string
  saldoActual: number
} {
  return {
    id: row[0],
    nombre: row[1],
    cuit: row[2] || "",
    telefono: row[3] || "",
    direccion: row[4] || "",
    saldoActual: Number.parseFloat(row[5]) || 0,
  }
}

// Formatear datos para enviar a sheets
export function formatVentaForSheet(venta: {
  id: string
  fecha: Date
  clienteNombre: string
  producto: string
  cantidad: number
  precioUnitario: number
  total: number
  estado: string
}): string[] {
  return [
    venta.id,
    venta.fecha.toISOString().split("T")[0],
    venta.clienteNombre,
    venta.producto,
    venta.cantidad.toString(),
    venta.precioUnitario.toString(),
    venta.total.toString(),
    venta.estado,
  ]
}

export function formatCobroForSheet(cobro: {
  id: string
  fecha: Date
  clienteNombre: string
  monto: number
  metodoPago: string
  observaciones?: string
}): string[] {
  return [
    cobro.id,
    cobro.fecha.toISOString().split("T")[0],
    cobro.clienteNombre,
    cobro.monto.toString(),
    cobro.metodoPago,
    cobro.observaciones || "",
  ]
}
