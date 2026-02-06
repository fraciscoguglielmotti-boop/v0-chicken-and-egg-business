"use client"

import useSWR, { mutate as globalMutate } from "swr"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

export type SheetRow = Record<string, string | number>

export function useSheet(sheetName: string) {
  const { data, error, isLoading, mutate } = useSWR<{ rows: SheetRow[] }>(
    `/api/sheets?sheet=${sheetName}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  )

  return {
    rows: data?.rows || [],
    isLoading,
    error,
    mutate,
  }
}

export async function addRow(sheetName: string, values: (string | number)[][]) {
  const res = await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheet: sheetName, values }),
  })

  if (!res.ok) throw new Error("Failed to add row")

  // Revalidate the sheet data
  await globalMutate(`/api/sheets?sheet=${sheetName}`)

  return res.json()
}

export async function updateRow(
  sheetName: string,
  rowIndex: number,
  values: (string | number)[]
) {
  const res = await fetch("/api/sheets", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheet: sheetName, rowIndex, values }),
  })

  if (!res.ok) throw new Error("Failed to update row")

  // Revalidate the sheet data
  await globalMutate(`/api/sheets?sheet=${sheetName}`)

  return res.json()
}

export async function deleteRow(sheetName: string, rowIndex: number) {
  const res = await fetch("/api/sheets", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sheet: sheetName, rowIndex }),
  })

  if (!res.ok) throw new Error("Failed to delete row")

  // Revalidate the sheet data
  await globalMutate(`/api/sheets?sheet=${sheetName}`)

  return res.json()
}
