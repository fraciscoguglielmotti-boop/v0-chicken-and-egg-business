import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

// ── POST: registrar un mensaje saliente y opcionalmente disparar Make.com ─────
// El envío real al WhatsApp Cloud API lo hace Make.com:
//   - Opción A: Make watchea inserts en mn_mensajes_whatsapp con direccion='outbound'
//   - Opción B: configurar MAKE_OUTBOUND_WEBHOOK_URL y este endpoint lo llama

export async function POST(req: NextRequest) {
  let payload: { telefono?: string; contenido?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { telefono, contenido } = payload
  if (!telefono || !contenido?.trim()) {
    return NextResponse.json({ error: "telefono y contenido son requeridos" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 1. Registrar en Supabase (historial)
  const { data: inserted, error } = await supabase
    .from("mn_mensajes_whatsapp")
    .insert({
      telefono,
      direccion: "outbound",
      tipo: "text",
      contenido: contenido.trim(),
      metadata: { sent_from: "avigest_inbox" },
    })
    .select()
    .single()

  if (error) {
    console.error("[whatsapp/send] Error al guardar mensaje:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 2. Disparar Make.com (si está configurado)
  const makeWebhook = process.env.MAKE_OUTBOUND_WEBHOOK_URL
  if (makeWebhook) {
    try {
      await fetch(makeWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono, contenido: contenido.trim() }),
      })
    } catch (err) {
      console.error("[whatsapp/send] Make.com webhook falló (mensaje guardado igualmente):", err)
    }
  }

  return NextResponse.json({ success: true, message: inserted })
}
