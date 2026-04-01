import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Faltan variables de entorno de Supabase")
  return createClient(url, key)
}

const MP_HEADERS = (token: string) => ({ Authorization: `Bearer ${token}` })

const OPERACION_ES: Record<string, string> = {
  regular_payment: "Pago",
  money_transfer: "Transferencia",
  recurring_payment: "Pago recurrente",
  account_fund: "Carga de saldo",
  pos_payment: "Pago QR/POS",
  cellphone_recharge: "Recarga celular",
  payment_addition: "Pago adicional",
  investment_transfer: "Inversión",
}

const METODO_ES: Record<string, string> = {
  account_money: "Saldo MP",
  debit_card: "Tarjeta débito",
  credit_card: "Tarjeta crédito",
  bank_transfer: "Transferencia bancaria",
  ticket: "Efectivo/cupón",
  atm: "Cajero automático",
  prepaid_card: "Tarjeta prepaga",
}

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

        // Descripción enriquecida con múltiples fallbacks
        const itemTitle = p.additional_info?.items?.[0]?.title
        const storeInfo = p.additional_info?.shipments?.receiver_address?.city_name
        const descripcionRaw =
          itemTitle ??
          storeInfo ??
          (p.description && !["Varios", "null", "undefined"].includes(p.description)
            ? p.description : null) ??
          p.statement_descriptor ??
          null
        const tipoOp = OPERACION_ES[p.operation_type] ?? p.operation_type ?? null
        const descripcion = descripcionRaw ?? tipoOp

        // Nombre de contraparte: quién pagó (ingreso) o quién cobró (egreso)
        const nombreContraparte = soyColector
          ? ([p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(" ").trim() ||
            p.additional_info?.payer?.first_name ||
            null)
          : (p.collector?.nickname ||
            [p.collector?.first_name, p.collector?.last_name].filter(Boolean).join(" ").trim() ||
            null)
        const emailContraparte = soyColector
          ? (p.payer?.email ?? null)
          : (p.collector?.email ?? null)

        return {
          id: String(p.id),
          fecha: p.date_approved ?? p.date_created,
          tipo,
          monto: Math.abs(p.transaction_amount),
          descripcion,
          referencia: String(p.id),
          pagador_nombre: nombreContraparte || null,
          pagador_email: emailContraparte,
          tipo_operacion: OPERACION_ES[p.operation_type] ?? p.operation_type ?? null,
          metodo_pago: METODO_ES[p.payment_method_id] ?? p.payment_method_id ?? null,
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

    // ── Auto-clasificar egresos sin categoria usando reglas_categorias ──
    let clasificados = 0
    const egresosIds = movimientos
      .filter((m) => m.tipo === "egreso")
      .map((m) => m.id)

    if (egresosIds.length > 0) {
      const [{ data: reglas }, { data: sinCategoria }] = await Promise.all([
        supabase.from("reglas_categorias").select("texto_original, categoria"),
        supabase
          .from("movimientos_mp")
          .select("id, descripcion, pagador_nombre")
          .in("id", egresosIds)
          .is("categoria", null),
      ])

      if (reglas && reglas.length > 0 && sinCategoria && sinCategoria.length > 0) {
        const updates: Array<{ id: string; categoria: string }> = []

        for (const mov of sinCategoria) {
          // Buscar en descripcion Y en pagador_nombre
          const textosBusqueda = [mov.descripcion, mov.pagador_nombre]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()

          const match = reglas.find((r) =>
            textosBusqueda.includes(r.texto_original.toLowerCase())
          )
          if (match) updates.push({ id: mov.id, categoria: match.categoria })
        }

        if (updates.length > 0) {
          await Promise.all(
            updates.map((u) =>
              supabase
                .from("movimientos_mp")
                .update({ categoria: u.categoria })
                .eq("id", u.id)
            )
          )
          clasificados = updates.length
        }
      }
    }

    return NextResponse.json({ synced: movimientos.length, ingresos, egresos, clasificados, fuente })
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err) ?? "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
