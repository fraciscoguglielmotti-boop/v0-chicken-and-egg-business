import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { sendTextMessage } from "@/lib/whatsapp/client"

export async function POST(req: NextRequest) {
  let payload: { conversacion_id?: number; telefono?: string; contenido?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { conversacion_id, telefono, contenido } = payload
  if (!conversacion_id || !telefono || !contenido?.trim()) {
    return NextResponse.json({ error: "conversacion_id, telefono y contenido son requeridos" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 1. Enviar via WhatsApp Cloud API
  try {
    await sendTextMessage({ to: telefono, body: contenido.trim() })
  } catch (err: any) {
    console.error("[whatsapp/send] Error enviando mensaje:", err)
    return NextResponse.json({ error: err?.message ?? "Error al enviar WhatsApp" }, { status: 500 })
  }

  // 2. Guardar en wa_mensajes como saliente
  const { data, error } = await supabase
    .from("wa_mensajes")
    .insert({
      conversacion_id,
      telefono,
      tipo: "text",
      contenido: contenido.trim(),
      direccion: "saliente",
    })
    .select()
    .single()

  if (error) {
    console.error("[whatsapp/send] Error guardando en wa_mensajes:", error)
    // No falla — el mensaje ya fue enviado
  }

  // 3. Actualizar ultimo_mensaje_at en wa_conversaciones
  await supabase
    .from("wa_conversaciones")
    .update({ ultimo_mensaje_at: new Date().toISOString() })
    .eq("id", conversacion_id)

  return NextResponse.json({ success: true, message: data ?? null })
}
