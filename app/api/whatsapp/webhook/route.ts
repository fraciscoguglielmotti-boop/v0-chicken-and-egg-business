import { NextRequest, NextResponse } from "next/server"
import { parseInboundPayload, saveInboundMessage, upsertConversation } from "@/lib/whatsapp/persistence"

export const maxDuration = 30

// ─── GET: verificación del webhook por Meta ───────────────────────────────────
// Meta envía hub.mode=subscribe, hub.challenge y hub.verify_token.
// Respondemos con hub.challenge si el token coincide.

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode")
  const challenge = req.nextUrl.searchParams.get("hub.challenge")
  const token = req.nextUrl.searchParams.get("hub.verify_token")

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[whatsapp/webhook] Webhook verificado por Meta")
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn("[whatsapp/webhook] Verificación fallida — token incorrecto o mode inválido")
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// ─── POST: recepción de mensajes ──────────────────────────────────────────────
// Meta espera una respuesta 200 en menos de 20s.
// Procesamos de forma síncrona y respondemos rápido.
// TODO M2: validar HMAC en header x-hub-signature-256

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Meta envía eventos de status (sent, delivered, read) además de mensajes.
  // Solo procesamos mensajes nuevos — los status los ignoramos por ahora.
  const isMessageEvent =
    (payload?.entry as any[])?.[0]?.changes?.[0]?.value?.messages !== undefined

  if (!isMessageEvent) {
    return NextResponse.json({ status: "ignored" }, { status: 200 })
  }

  try {
    const messages = parseInboundPayload(payload)

    for (const msg of messages) {
      const conversation = await upsertConversation(msg.from, msg.displayName)
      await saveInboundMessage(conversation.id, msg)
      console.log(`[whatsapp/webhook] Mensaje guardado de ${msg.from}: "${msg.body ?? `[${msg.type}]`}"`)
    }
  } catch (err) {
    // No retornar 5xx a Meta — si lo hacemos, reintenta indefinidamente
    console.error("[whatsapp/webhook] Error procesando mensaje:", err)
  }

  // Siempre 200 para Meta
  return NextResponse.json({ status: "ok" }, { status: 200 })
}
