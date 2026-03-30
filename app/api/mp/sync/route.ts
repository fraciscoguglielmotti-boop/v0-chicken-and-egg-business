import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const MP_HEADERS = (token: string) => ({ Authorization: `Bearer ${token}` })

// Intenta obtener movimientos de cuenta completos (ingresos + egresos)
async function fetchMovimientosCuenta(
  accessToken: string,
  beginDate: Date,
  endDate: Date
): Promise<any[] | null> {
  try {
    const url = new URL("https://api.mercadopago.com/v1/account/movements/search")
    url.searchParams.set("begin_date", beginDate.toISOString())
    url.searchParams.set("end_date", endDate.toISOString())
    url.searchParams.set("limit", "100")

    const res = await fetch(url.toString(), { headers: MP_HEADERS(accessToken) })
    if (!res.ok) return null

    const data = await res.json()
    if (!Array.isArray(data.results)) return null
    return data.results
  } catch {
    return null
  }
}

// Fallback: payments/search (solo ingresos, pero con datos más ricos)
async function fetchPagosRecibidos(
  accessToken: string,
  beginDate: Date,
  endDate: Date
): Promise<any[]> {
  const url = new URL("https://api.mercadopago.com/v1/payments/search")
  url.searchParams.set("sort", "date_created")
  url.searchParams.set("criteria", "desc")
  url.searchParams.set("range", "date_created")
  url.searchParams.set("begin_date", beginDate.toISOString())
  url.searchParams.set("end_date", endDate.toISOString())
  url.searchParams.set("limit", "100")

  const res = await fetch(url.toString(), { headers: MP_HEADERS(accessToken) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Error MP API: ${res.status}`)
  }
  const data = await res.json()
  return (data.results ?? []).filter((p: any) => p.status === "approved")
}

export async function POST(request: Request) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({ error: "MP_ACCESS_TOKEN no configurado" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const daysBack: number = body.daysBack ?? 30

    const endDate = new Date()
    const beginDate = new Date()
    beginDate.setDate(beginDate.getDate() - daysBack)

    // Obtener user ID propio
    const meRes = await fetch("https://api.mercadopago.com/users/me", {
      headers: MP_HEADERS(accessToken),
    })
    const meData = await meRes.json()
    const myUserId = String(meData.id ?? "")

    // ── Intentar endpoint de movimientos de cuenta (ledger completo) ──
    const movCuenta = await fetchMovimientosCuenta(accessToken, beginDate, endDate)

    let movimientos: any[]

    if (movCuenta && movCuenta.length > 0) {
      // El endpoint de movimientos devuelve monto con signo: positivo = ingreso, negativo = egreso
      movimientos = movCuenta.map((m: any) => {
        const monto = Number(m.amount ?? m.transaction_amount ?? 0)
        const tipo: "ingreso" | "egreso" = monto >= 0 ? "ingreso" : "egreso"
        return {
          id: `mov_${m.id}`,
          fecha: m.date ?? m.date_created,
          tipo,
          monto: Math.abs(monto),
          descripcion: m.description ?? m.action ?? m.type ?? null,
          referencia: String(m.id),
          pagador_nombre: m.counterpart_name ?? null,
          pagador_email: m.counterpart_email ?? null,
          tipo_operacion: m.type ?? m.action ?? null,
          metodo_pago: m.payment_method ?? null,
        }
      })
    } else {
      // ── Fallback: payments/search + detección de dirección por collector_id ──
      const pagos = await fetchPagosRecibidos(accessToken, beginDate, endDate)

      movimientos = pagos.map((p: any) => {
        // Si soy el cobrador → ingreso; si soy el pagador → egreso
        const soyColector = String(p.collector_id) === myUserId
        const tipo: "ingreso" | "egreso" = soyColector ? "ingreso" : "egreso"

        // Descripción enriquecida: item específico > descripción > statement descriptor > operación
        const itemTitle = p.additional_info?.items?.[0]?.title
        const descripcion =
          itemTitle ??
          (p.description && p.description !== "Varios" ? p.description : null) ??
          p.statement_descriptor ??
          p.operation_type ??
          null

        const nombreContraparte = soyColector
          ? [p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(" ") ||
            p.payer?.identification?.number ||
            null
          : p.collector?.nickname ?? p.collector?.email ?? null
        const emailContraparte = soyColector ? (p.payer?.email ?? null) : null

        return {
          id: String(p.id),
          fecha: p.date_approved ?? p.date_created,
          tipo,
          monto: Math.abs(p.transaction_amount),
          descripcion,
          referencia: String(p.id),
          pagador_nombre: nombreContraparte,
          pagador_email: emailContraparte,
          tipo_operacion: p.operation_type ?? null,
          metodo_pago: p.payment_method_id ?? null,
        }
      })
    }

    if (movimientos.length === 0) {
      return NextResponse.json({ synced: 0, message: "Sin movimientos en el período" })
    }

    const supabase = getSupabase()
    const { error } = await supabase
      .from("movimientos_mp")
      .upsert(movimientos, { onConflict: "id" })

    if (error) throw error

    const ingresos = movimientos.filter((m) => m.tipo === "ingreso").length
    const egresos = movimientos.filter((m) => m.tipo === "egreso").length
    const fuente = movCuenta ? "movimientos_cuenta" : "payments_search"

    return NextResponse.json({ synced: movimientos.length, ingresos, egresos, fuente })
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err) ?? "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
