import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logAndSanitize } from "@/lib/api-errors"

export const maxDuration = 30

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Faltan variables de entorno de Supabase")
  return createClient(url, key)
}

/**
 * POST /api/minorista/pedidos
 *
 * Webhook para crear pedidos minoristas desde Make u otro origen externo.
 * Escribe en las tablas mn_clientes, mn_pedidos y mn_items_pedido.
 *
 * Body JSON esperado:
 * {
 *   cliente: {
 *     nombre: string,              // requerido
 *     apellido?: string,           // se concatena a nombre si está presente
 *     telefono?: string,
 *     direccion?: string,          // se guarda como direccion_entrega en el pedido
 *     notas?: string
 *   },
 *   items: [
 *     { nombre: string, cantidad: number, precio_unitario: number }
 *   ],
 *   forma_pago?: "efectivo" | "mercadopago" | "transferencia",
 *   notas?: string,
 *   total?: number                 // opcional, si no se calcula de items
 * }
 *
 * Seguridad: header X-Webhook-Secret debe coincidir con
 * MINORISTA_WEBHOOK_SECRET (env). Si la variable NO está configurada, se
 * rechazan todas las requests.
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
    if (!cli.nombre) {
      return NextResponse.json(
        { error: "cliente.nombre es requerido" },
        { status: 400 }
      )
    }

    // Combine nombre + apellido if both provided
    const nombreCompleto = cli.apellido
      ? `${String(cli.nombre).trim()} ${String(cli.apellido).trim()}`
      : String(cli.nombre).trim()

    // 1. Buscar o crear cliente en mn_clientes
    let clienteId: number | null = null

    if (cli.telefono) {
      const { data } = await supabase
        .from("mn_clientes")
        .select("id")
        .eq("telefono", String(cli.telefono).trim())
        .maybeSingle()
      if (data?.id) clienteId = data.id
    }

    if (!clienteId) {
      const { data: inserted, error } = await supabase
        .from("mn_clientes")
        .insert({
          nombre: nombreCompleto,
          telefono: cli.telefono ? String(cli.telefono).trim() : "",
          activo: true,
        })
        .select("id")
        .single()
      if (error) throw error
      clienteId = inserted.id
    }

    // 2. Validar items
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
    const sanitizedItems: SanitizedItem[] = items.map((it: any) => ({
      nombre: String(it.nombre || "").trim(),
      cantidad: Math.max(0, Number(it.cantidad) || 0),
      precio_unitario: Math.max(0, Number(it.precio_unitario) || 0),
    }))

    if (!sanitizedItems.some((it) => it.nombre && it.cantidad > 0)) {
      return NextResponse.json(
        { error: "items debe contener al menos un item con nombre y cantidad > 0" },
        { status: 400 }
      )
    }

    // 3. Buscar producto_ids en mn_productos por nombre
    const nombresBuscados = [...new Set(sanitizedItems.map((it) => it.nombre))]
    const { data: productosMatch } = await supabase
      .from("mn_productos")
      .select("id, nombre")
      .in("nombre", nombresBuscados)
    const productoIdByNombre = new Map<string, number>()
    ;(productosMatch || []).forEach((p: { id: number; nombre: string }) => {
      productoIdByNombre.set(p.nombre, p.id)
    })

    // 4. Calcular totales
    const subtotal = sanitizedItems.reduce(
      (s, it) => s + it.cantidad * it.precio_unitario,
      0
    )
    const totalRaw = body.total != null ? Number(body.total) : subtotal
    const total = Number.isFinite(totalRaw) && totalRaw >= 0 ? totalRaw : subtotal

    // Normalizar metodo_pago
    const rawPago = String(body.forma_pago || "efectivo").toLowerCase()
    const metodoPago =
      rawPago === "mercadopago" || rawPago === "mp" ? "mercadopago"
      : rawPago === "transferencia" ? "transferencia"
      : "efectivo"

    // 5. Crear pedido en mn_pedidos
    const { data: pedido, error: pedidoErr } = await supabase
      .from("mn_pedidos")
      .insert({
        cliente_id: clienteId,
        estado: "confirmado",
        direccion_entrega: cli.direccion ? String(cli.direccion).trim() : null,
        notas_direccion: cli.notas ? String(cli.notas).trim() : null,
        subtotal,
        costo_envio: null,
        total,
        metodo_pago: metodoPago,
        pago_status: "pendiente",
        notas: body.notas ? String(body.notas).trim() : null,
        canal: "whatsapp",
        confirmado_at: new Date().toISOString(),
      })
      .select("id")
      .single()
    if (pedidoErr) throw pedidoErr

    // 6. Crear items en mn_items_pedido
    // Cuando no hay producto_id, guardamos el nombre en notas como fallback
    const itemRows = sanitizedItems
      .filter((it) => it.nombre && it.cantidad > 0)
      .map((it) => {
        const productoId = productoIdByNombre.get(it.nombre) ?? null
        return {
          pedido_id: pedido.id,
          producto_id: productoId,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          subtotal: it.cantidad * it.precio_unitario,
          notas: productoId ? null : it.nombre,
        }
      })

    if (itemRows.length > 0) {
      const { error: itemsErr } = await supabase
        .from("mn_items_pedido")
        .insert(itemRows)
      if (itemsErr) throw itemsErr
    }

    return NextResponse.json({
      ok: true,
      pedido_id: pedido.id,
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
