import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
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

    // Fetch payments from MP API (covers cobros por QR, link de pago y transferencias)
    const url = new URL("https://api.mercadopago.com/v1/payments/search")
    url.searchParams.set("sort", "date_created")
    url.searchParams.set("criteria", "desc")
    url.searchParams.set("range", "date_created")
    url.searchParams.set("begin_date", beginDate.toISOString())
    url.searchParams.set("end_date", endDate.toISOString())
    url.searchParams.set("limit", "100")

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `Error MP API: ${res.status}`)
    }

    const data = await res.json()
    const payments: any[] = data.results ?? []

    const aprobados = payments.filter((p) => p.status === "approved")

    if (aprobados.length === 0) {
      return NextResponse.json({ synced: 0, message: "Sin movimientos nuevos en el período" })
    }

    const movimientos = aprobados.map((p) => ({
      id: String(p.id),
      fecha: p.date_approved ?? p.date_created,
      tipo: p.transaction_amount >= 0 ? "ingreso" : "egreso",
      monto: Math.abs(p.transaction_amount),
      descripcion: p.description ?? p.statement_descriptor ?? null,
      referencia: String(p.id),
      pagador_nombre:
        [p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(" ") || null,
      pagador_email: p.payer?.email ?? null,
    }))

    const supabase = getSupabase()
    const { error } = await supabase
      .from("movimientos_mp")
      .upsert(movimientos, { onConflict: "id" })

    if (error) throw error

    return NextResponse.json({ synced: movimientos.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
