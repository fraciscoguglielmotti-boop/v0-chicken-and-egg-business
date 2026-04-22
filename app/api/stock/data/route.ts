import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const maxDuration = 30

// ─── Paginación ──────────────────────────────────────────────────────────────

async function fetchAll<T>(
  supabase: any,
  table: string,
  select: string,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const [productos, compras, ventas] = await Promise.all([
      fetchAll<{ id: string; nombre: string }>(supabase, "productos", "id,nombre"),
      fetchAll<{ id: string; producto: string; cantidad: number; fecha: string }>(
        supabase,
        "compras",
        "id,producto,cantidad,fecha"
      ),
      fetchAll<{ id: string; producto_nombre: string | null; cantidad: number; fecha: string }>(
        supabase,
        "ventas",
        "id,producto_nombre,cantidad,fecha"
      ),
    ])

    return NextResponse.json({ productos, compras, ventas })
  } catch (err: any) {
    console.error("[stock/data]", err)
    return NextResponse.json(
      { error: err?.message ?? "Error obteniendo stock" },
      { status: 500 }
    )
  }
}
