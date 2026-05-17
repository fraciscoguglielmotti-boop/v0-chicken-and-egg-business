import { NextRequest, NextResponse } from "next/server"
import { sendTextMessage } from "@/lib/whatsapp/client"
import { saveOutboundMessage } from "@/lib/whatsapp/persistence"

export async function POST(req: NextRequest) {
  let body: { conversationId?: string; to?: string; body?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { conversationId, to, body: text } = body
  if (!conversationId || !to || !text?.trim()) {
    return NextResponse.json({ error: "conversationId, to y body son requeridos" }, { status: 400 })
  }

  try {
    const { messageId } = await sendTextMessage({ to, body: text.trim() })
    const msg = await saveOutboundMessage(conversationId, text.trim(), "human", messageId)
    return NextResponse.json({ success: true, message: msg })
  } catch (err: any) {
    console.error("[whatsapp/send] Error:", err)
    return NextResponse.json({ error: err?.message ?? "Error al enviar mensaje" }, { status: 500 })
  }
}
