import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logAndSanitize } from "@/lib/api-errors"

export const maxDuration = 30

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Faltan variables de entorno de Supabase")
  return createClient(url, key)
}

async function nextPedidoNumero(supabase: ReturnType<typeof getSupabase>): Promise<string> {
  const { data, error } = await supabase.rpc("next_pedido_numero")
  if (!error && data) return data as string
  // Fallback si el RPC aún no fue migrado: SELECT MAX (menos seguro ante concurrencia)
  const { data: rows } = await supabase.from("pedidos_minoristas").select("numero")
  const nums = (rows || [])
    .map((r: any) => parseInt(String(r.numero || "").replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n))
  return `PED-${String(((nums.length ? Math.max(...nums) : 0) + 1)).padStart(4, "0")}`
}

async function nextCustomerId(supabase: ReturnType<typeof getSupabase>): Promise<string> {
  const { data, error } = await supabase.rpc("next_customer_id")
  if (!error && data) return data as string
  // Fallback si el RPC aún no fue migrado
  const { data: rows } = await supabase.from("clientes_minoristas").select("customer_id")
  const nums = (rows || [])
    .map((r: any) => parseInt(String(r.customer_id || "").replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n))
  return `MIN-${String(((nums.length ? Math.max(...nums) : 0) + 1)).padStart(4, "0")}`
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
 * Seguridad: header X-Webhook-Secret debe coincidir con
 * MINORISTA_WEBHOOK_SECRET (env). Si la variable NO está configurada, se
 * rechazan todas las requests — el endpoint queda desactivado hasta setearla.
 */
export async function POST(request: Request) {
  try {
    const expected = process.env.MINORISTA_WEBHOOK_SECRET
    if (!expected) {
      return NextResponse.json(
        { error: "Webhook no configurado (falta MINORISTA_WEBHOOK_SECRET)" },
        { status: 503 }
      )
    }
    const provided = request.headers.get("x-webhook-secret")
    if (provided !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
    const items: any[] = Array.isArray(body?.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json(
        { error: "items es requerido (array con al menos 1 item)" },
        { status: 400 }
      )
    }

    interface SanitizedItem {
      nombre: string
      cantidad: number
      precio_unitario: number
    }
    const sanitizedItems: SanitizedItem[] = items.map((it: any) => {
      const cant = Number(it.cantidad)
      const precio = Number(it.precio_unitario)
      return {
        nombre: String(it.nombre || ""),
        cantidad: Number.isFinite(cant) && cant > 0 ? cant : 0,
        precio_unitario: Number.isFinite(precio) && precio >= 0 ? precio : 0,
      }
    })

    if (!sanitizedItems.some((it) => it.nombre && it.cantidad > 0)) {
      return NextResponse.json(
        { error: "items debe contener al menos un item con cantidad > 0 y precio_unitario >= 0" },
        { status: 400 }
      )
    }

    const subtotal = sanitizedItems.reduce(
      (s, it) => s + it.cantidad * it.precio_unitario,
      0
    )
    const totalRaw = body.total != null ? Number(body.total) : subtotal
    const total = Number.isFinite(totalRaw) && totalRaw >= 0 ? totalRaw : subtotal

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
    const itemRows = sanitizedItems
      .filter((it) => it.nombre && String(it.nombre).trim() && it.cantidad > 0)
      .map((it) => ({
        pedido_id: pedido.id,
        producto_id: null,
        nombre_producto: String(it.nombre).trim(),
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.cantidad * it.precio_unitario,
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
    const msg = logAndSanitize("minorista/pedidos", err, "Error procesando pedido")
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "Endpoint POST /api/minorista/pedidos activo. Ver README para el schema JSON.",
  })
}
