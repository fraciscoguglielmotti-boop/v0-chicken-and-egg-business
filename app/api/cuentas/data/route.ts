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

    const [clientes, proveedores, ventas, cobros, compras, pagos] = await Promise.all([
      fetchAll<any>(
        supabase,
        "clientes",
        "id,nombre,saldo_inicial,saldo_verificado,activo"
      ),
      fetchAll<any>(supabase, "proveedores", "id,nombre"),
      fetchAll<any>(
        supabase,
        "ventas",
        "id,fecha,cliente_nombre,cantidad,precio_unitario,productos"
      ),
      fetchAll<any>(
        supabase,
        "cobros",
        "id,fecha,cliente_nombre,monto,metodo_pago,cuenta_destino,verificado_agroaves"
      ),
      fetchAll<any>(
        supabase,
        "compras",
        "id,fecha,proveedor_nombre,producto,cantidad,precio_unitario,total"
      ),
      fetchAll<any>(
        supabase,
        "pagos",
        "id,fecha,proveedor_nombre,monto,metodo_pago"
      ),
    ])

    return NextResponse.json({ clientes, proveedores, ventas, cobros, compras, pagos })
  } catch (err: any) {
    console.error("[cuentas/data]", err)
    return NextResponse.json(
      { error: err?.message ?? "Error obteniendo cuentas" },
      { status: 500 }
    )
  }
}
