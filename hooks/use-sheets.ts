"use client"

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
  cliente: "Cliente",
  productos: "Productos",
  producto: "Producto",
  cantidad: "Cantidad",
  preciounitario: "PrecioUnitario",
  total: "Total",
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
}

function getCanonicalKey(header: string): string {
  const norm = normalizeKey(header)
  return CANONICAL_KEYS[norm] || header
}

function rowsToObjects(headers: string[], data: string[][]): SheetRow[] {
  const canonicalHeaders = headers.map(getCanonicalKey)
  return data.map((row) => {
    const obj: SheetRow = {}
    canonicalHeaders.forEach((h, i) => {
      obj[h] = row[i] || ""
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
