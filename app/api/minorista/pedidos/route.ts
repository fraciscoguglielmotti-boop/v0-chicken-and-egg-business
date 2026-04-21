import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 30

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Faltan variables de entorno de Supabase")
  return createClient(url, key)
}

async function nextPedidoNumero(supabase: ReturnType<typeof getSupabase>): Promise<string> {
  const { data } = await supabase
    .from("pedidos_minoristas")
    .select("numero")
  const nums = (data || [])
    .map((r: any) => parseInt(String(r.numero || "").replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `PED-${String(next).padStart(4, "0")}`
}

async function nextCustomerId(supabase: ReturnType<typeof getSupabase>): Promise<string> {
  const { data } = await supabase
    .from("clientes_minoristas")
    .select("customer_id")
  const nums = (data || [])
    .map((r: any) => parseInt(String(r.customer_id || "").replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `MIN-${String(next).padStart(4, "0")}`
}

/**
 * POST /api/minorista/pedidos
 *
 * Webhook para crear pedidos minoristas desde Make u otro origen externo.
 *
 * Body JSON esperado:
 * {
 *   cliente: {
 *     customer_id?: string,       // si existe, se usa para buscar cliente
 *     nombre: string,
 *     apellido: string,
 *     telefono?: string,
 *     direccion?: string,
 *     lat?: number,
 *     lng?: number,
 *     notas?: string
 *   },
 *   fecha?: string,               // YYYY-MM-DD (default: hoy)
 *   items: [
 *     { producto?: string, nombre: string, cantidad: number, precio_unitario: number }
 *   ],
 *   forma_pago?: "efectivo" | "mercadopago",
 *   mp_link?: string,
 *   notas?: string,
 *   total?: number                // opcional, si no se calcula de items
 * }
 *
 * Seguridad simple: header X-Webhook-Secret debe coincidir con
 * MINORISTA_WEBHOOK_SECRET (env). Si la variable no está, no se verifica.
 */
export async function POST(request: Request) {
  try {
    const expected = process.env.MINORISTA_WEBHOOK_SECRET
    if (expected) {
      const provided = request.headers.get("x-webhook-secret")
      if (provided !== expected) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const body = await request.json()
    const supabase = getSupabase()

    const cli = body?.cliente || {}
    if (!cli.nombre || !cli.apellido) {
      return NextResponse.json(
        { error: "cliente.nombre y cliente.apellido son requeridos" },
        { status: 400 }
      )
    }

    // 1. Buscar o crear cliente
    let clienteId: string | null = null

    if (cli.customer_id) {
      const { data } = await supabase
        .from("clientes_minoristas")
        .select("id")
        .eq("customer_id", cli.customer_id)
        .maybeSingle()
      if (data?.id) clienteId = data.id
    }

    if (!clienteId && cli.telefono) {
      const { data } = await supabase
        .from("clientes_minoristas")
        .select("id")
        .eq("telefono", cli.telefono)
        .maybeSingle()
      if (data?.id) clienteId = data.id
    }

    if (!clienteId) {
      const customer_id = await nextCustomerId(supabase)
      const { data: inserted, error } = await supabase
        .from("clientes_minoristas")
        .insert({
          customer_id,
          nombre: String(cli.nombre).trim(),
          apellido: String(cli.apellido).trim(),
          telefono: cli.telefono ? String(cli.telefono).trim() : null,
          direccion: cli.direccion ? String(cli.direccion).trim() : null,
          lat: cli.lat != null ? Number(cli.lat) : null,
          lng: cli.lng != null ? Number(cli.lng) : null,
          notas: cli.notas ? String(cli.notas).trim() : null,
          activo: true,
        })
        .select("id")
        .single()
      if (error) throw error
      clienteId = inserted.id
    }

    // 2. Crear pedido
    const items = Array.isArray(body?.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json(
        { error: "items es requerido (array con al menos 1 item)" },
        { status: 400 }
      )
    }

    const subtotal = items.reduce(
      (s: number, it: any) =>
        s + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0),
      0
    )
    const total =
      body.total != null && !isNaN(Number(body.total)) ? Number(body.total) : subtotal

    const numero = await nextPedidoNumero(supabase)
    const fecha = body.fecha || new Date().toISOString().slice(0, 10)

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos_minoristas")
      .insert({
        numero,
        cliente_id: clienteId,
        fecha,
        estado: "recibido",
        forma_pago: body.forma_pago === "mercadopago" ? "mercadopago" : "efectivo",
        mp_link: body.mp_link || null,
        notas: body.notas || null,
        descuento: Math.max(0, subtotal - total),
        total,
      })
      .select("id")
      .single()
    if (pedidoErr) throw pedidoErr

    // 3. Crear items
    const itemRows = items
      .filter((it: any) => it.nombre && Number(it.cantidad) > 0)
      .map((it: any) => ({
        pedido_id: pedido.id,
        producto_id: null,
        nombre_producto: String(it.nombre).trim(),
        cantidad: Number(it.cantidad),
        precio_unitario: Number(it.precio_unitario) || 0,
        subtotal: Number(it.cantidad) * (Number(it.precio_unitario) || 0),
      }))

    if (itemRows.length > 0) {
      const { error: itemsErr } = await supabase
        .from("items_pedido_minorista")
        .insert(itemRows)
      if (itemsErr) throw itemsErr
    }

    return NextResponse.json({
      ok: true,
      pedido_id: pedido.id,
      numero,
      cliente_id: clienteId,
      total,
    })
  } catch (err: any) {
    console.error("[minorista/pedidos] error:", err)
    return NextResponse.json(
      { error: err.message || "Error procesando pedido" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "Endpoint POST /api/minorista/pedidos activo. Ver README para el schema JSON.",
  })
}
