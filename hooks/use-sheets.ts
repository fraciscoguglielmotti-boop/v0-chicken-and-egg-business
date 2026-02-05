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

function rowsToObjects(headers: string[], data: string[][]): SheetRow[] {
  return data.map((row) => {
    const obj: SheetRow = {}
    headers.forEach((h, i) => {
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

  if (data?.headers && sheetName) {
    console.log(`[v0] Sheet "${sheetName}" headers:`, data.headers)
    if (data.data?.length > 0) {
      console.log(`[v0] Sheet "${sheetName}" first raw row:`, data.data[0])
    }
  }

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
