import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function fetchPayments(
  accessToken: string,
  beginDate: Date,
  endDate: Date,
  extraParams: Record<string, string> = {}
): Promise<any[]> {
  const url = new URL("https://api.mercadopago.com/v1/payments/search")
  url.searchParams.set("sort", "date_created")
  url.searchParams.set("criteria", "desc")
  url.searchParams.set("range", "date_created")
  url.searchParams.set("begin_date", beginDate.toISOString())
  url.searchParams.set("end_date", endDate.toISOString())
  url.searchParams.set("limit", "100")
  for (const [k, v] of Object.entries(extraParams)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Error MP API: ${res.status}`)
  }
  const data = await res.json()
  return data.results ?? []
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

    // Obtener el user ID propio para identificar egresos
    const meRes = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const meData = await meRes.json()
    const myUserId = String(meData.id ?? "")

    // 1. Ingresos: pagos donde soy el cobrador (comportamiento por defecto)
    const cobros = await fetchPayments(accessToken, beginDate, endDate)
    const cobrosAprobados = cobros.filter((p) => p.status === "approved")

    // 2. Egresos: pagos donde soy el pagador
    let pagosAprobados: any[] = []
    if (myUserId) {
      const pagos = await fetchPayments(accessToken, beginDate, endDate, {
        "payer.id": myUserId,
      })
      pagosAprobados = pagos.filter(
        (p) => p.status === "approved" && String(p.collector_id) !== myUserId
      )
    }

    const toMovimiento = (p: any, tipo: "ingreso" | "egreso") => ({
      id: tipo === "egreso" ? `egreso_${p.id}` : String(p.id),
      fecha: p.date_approved ?? p.date_created,
      tipo,
      monto: Math.abs(p.transaction_amount),
      descripcion: p.description ?? p.statement_descriptor ?? null,
      referencia: String(p.id),
      pagador_nombre:
        tipo === "ingreso"
          ? [p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(" ") || null
          : [p.collector?.first_name, p.collector?.last_name].filter(Boolean).join(" ") || null,
      pagador_email:
        tipo === "ingreso"
          ? (p.payer?.email ?? null)
          : (p.collector?.email ?? null),
    })

    const movimientos = [
      ...cobrosAprobados.map((p) => toMovimiento(p, "ingreso")),
      ...pagosAprobados.map((p) => toMovimiento(p, "egreso")),
    ]

    if (movimientos.length === 0) {
      return NextResponse.json({ synced: 0, message: "Sin movimientos nuevos en el período" })
    }

    const supabase = getSupabase()
    const { error } = await supabase
      .from("movimientos_mp")
      .upsert(movimientos, { onConflict: "id" })

    if (error) throw error

    return NextResponse.json({
      synced: movimientos.length,
      ingresos: cobrosAprobados.length,
      egresos: pagosAprobados.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err) ?? "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
