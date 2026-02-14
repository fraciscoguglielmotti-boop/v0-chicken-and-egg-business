"use client"

import { useEffect, useRef } from "react"
import useSWR, { mutate as globalMutate } from "swr"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error de red" }))
    throw new Error(err.error || "Error al cargar datos")
  }
  return res.json()
}

export interface SheetRow {
  [key: string]: string
}

// Normalize a header: remove spaces, accents, lowercase, etc.
// "Precio Unitario" -> "preciounitario"
function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/\s+/g, "") // remove spaces
    .toLowerCase()
}

// Map of normalized keys to canonical keys used in the app
const CANONICAL_KEYS: Record<string, string> = {
  id: "ID",
  fecha: "Fecha",
  clienteid: "ClienteID",
  idcliente: "ClienteID",
  cliente: "Cliente",
  productos: "Productos",
  producto: "Producto",
  cantidad: "Cantidad",
  preciounitario: "PrecioUnitario",
  preciou: "PrecioUnitario",
  precioun: "PrecioUnitario",
  pu: "PrecioUnitario",
  precio: "Precio",
  preciokilo: "PrecioUnitario",
  preciounidad: "PrecioUnitario",
  precioxkg: "PrecioUnitario",
  pxkg: "PrecioUnitario",
  importe: "Total",
  total: "Total",
  subtotal: "Total",
  estado: "Estado",
  vendedor: "Vendedor",
  proveedorid: "ProveedorID",
  proveedor: "Proveedor",
  nombre: "Nombre",
  cuit: "CUIT",
  telefono: "Telefono",
  direccion: "Direccion",
  saldo: "Saldo",
  fechaalta: "FechaAlta",
  monto: "Monto",
  metodopago: "MetodoPago",
  metodo: "MetodoPago",
  observaciones: "Observaciones",
  comision: "Comision",
  tipo: "Tipo",
  categoria: "Categoria",
  descripcion: "Descripcion",
  tarjeta: "Tarjeta",
  banco: "Banco",
  cuotaactual: "CuotaActual",
  cuotastotal: "CuotasTotal",
  origenpdf: "OrigenPDF",
  presupuesto: "Presupuesto",
  mes: "Mes",
  anio: "Anio",
  vehiculoid: "VehiculoID",
  vehiculo: "Vehiculo",
  patente: "Patente",
  marca: "Marca",
  modelo: "Modelo",
  aniovehiculo: "AnioVehiculo",
  kilometraje: "Kilometraje",
  tipomantenimiento: "TipoMantenimiento",
  costo: "Costo",
  taller: "Taller",
  proximokm: "ProximoKM",
  proximafecha: "ProximaFecha",
  verificadoagroaves: "VerificadoAgroaves",
  verificado: "VerificadoAgroaves",
  saldoinicial: "SaldoInicial",
  saldo: "SaldoInicial",
}

function getCanonicalKey(header: string): string {
  const norm = normalizeKey(header)
  return CANONICAL_KEYS[norm] || header
}

function rowsToObjects(headers: string[], data: string[][]): SheetRow[] {
  const canonicalHeaders = headers.map(getCanonicalKey)
  const colCount = canonicalHeaders.length
  return data.map((row) => {
    const obj: SheetRow = {}
    // Pad the row to match header count - Google Sheets API omits trailing empty cells
    const paddedRow = [...row]
    while (paddedRow.length < colCount) {
      paddedRow.push("")
    }
    canonicalHeaders.forEach((h, i) => {
      obj[h] = paddedRow[i] || ""
    })
    return obj
  })
}

export function useSheet(sheetName: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    sheetName ? `/api/sheets?sheet=${encodeURIComponent(sheetName)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  const rows: SheetRow[] =
    data?.headers && data?.data ? rowsToObjects(data.headers, data.data) : []

  // Auto-assign IDs to rows without ID (for manually added rows in Sheets)
  const autoIdSheets = ["Ventas", "Cobros", "Pagos", "Compras", "Gastos", "Mantenimientos"]
  const hasAssignedRef = useRef(false)
  
  useEffect(() => {
    if (
      !sheetName ||
      !autoIdSheets.includes(sheetName) ||
      rows.length === 0 ||
      hasAssignedRef.current ||
      isLoading
    ) return

    // Check if any row is missing an ID
    const hasMissingIds = rows.some((r) => !r.ID || r.ID.trim() === "")
    if (hasMissingIds) {
      hasAssignedRef.current = true
      assignIds(sheetName).catch(() => {
        // Reset on error so it can retry
        hasAssignedRef.current = false
      })
    }
  }, [sheetName, rows, isLoading])

  return {
    rows,
    headers: (data?.headers as string[]) || [],
    rawData: (data?.data as string[][]) || [],
    isLoading,
    error: error?.message || null,
    mutate,
  }
}

export async function addRow(sheetName: string, values: string[][]) {
  const res = await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetName, values }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error de red" }))
    throw new Error(err.error || "Error al guardar")
  }
  // Revalidate the sheet data
  await globalMutate(`/api/sheets?sheet=${encodeURIComponent(sheetName)}`)
  return res.json()
}

// Auto-assign IDs to rows that don't have one
export async function assignIds(sheetName: string) {
  const res = await fetch("/api/sheets/auto-id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetName }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error de red" }))
    throw new Error(err.error || "Error al asignar IDs")
  }
  const result = await res.json()
  if (result.updated > 0) {
    // Revalidate the sheet data so new IDs show up
    await globalMutate(`/api/sheets?sheet=${encodeURIComponent(sheetName)}`)
  }
  return result
}

export async function updateRow(
  sheetName: string,
  rowIndex: number,
  values: string[]
) {
  const res = await fetch("/api/sheets", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetName, rowIndex, values }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error de red" }))
    throw new Error(err.error || "Error al actualizar")
  }
  await globalMutate(`/api/sheets?sheet=${encodeURIComponent(sheetName)}`)
  return res.json()
}

export async function updateCell(
  sheetName: string,
  rowIndex: number,
  column: string,
  value: string,
) {
  const res = await fetch("/api/sheets", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetName, rowIndex, column, value }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error de red" }))
    throw new Error(err.error || "Error al actualizar celda")
  }
  await globalMutate(`/api/sheets?sheet=${encodeURIComponent(sheetName)}`)
  return res.json()
}

export async function deleteRow(sheetName: string, rowIndex: number) {
  const res = await fetch("/api/sheets", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheetName, rowIndex }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error de red" }))
    throw new Error(err.error || "Error al eliminar")
  }
  await globalMutate(`/api/sheets?sheet=${encodeURIComponent(sheetName)}`)
  return res.json()
}
