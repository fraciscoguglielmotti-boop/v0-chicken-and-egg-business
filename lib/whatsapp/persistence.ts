import { createServiceClient } from "@/lib/supabase/service"
import type { InboundMessage, WaConversation, WaMessage } from "./types"

// Crea o actualiza la conversación para un número dado.
// Retorna la conversación tal como quedó en la DB.
export async function upsertConversation(
  phoneNumber: string,
  displayName: string
): Promise<WaConversation> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("wa_conversations")
    .upsert(
      {
        phone_number: phoneNumber,
        display_name: displayName,
        last_message_at: now,
        last_inbound_at: now,
        updated_at: now,
      },
      {
        onConflict: "phone_number",
        ignoreDuplicates: false,
      }
    )
    .select()
    .single()

  if (error) throw error
  return data as WaConversation
}

// Incrementa el contador de mensajes no leídos de una conversación.
export async function incrementUnread(conversationId: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.rpc("increment_unread", { conv_id: conversationId })
  // Si el RPC no existe todavía, fallback manual:
  // await supabase
  //   .from("wa_conversations")
  //   .update({ unread_count: supabase.raw("unread_count + 1") })
  //   .eq("id", conversationId)
}

// Guarda un mensaje entrante del cliente.
export async function saveInboundMessage(
  conversationId: string,
  msg: InboundMessage
): Promise<WaMessage> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from("wa_messages")
    .insert({
      conversation_id: conversationId,
      wa_message_id: msg.waMessageId,
      direction: "inbound",
      sender_type: "customer",
      message_type: msg.type,
      body: msg.body,
      media_url: msg.mediaUrl ?? null,
      raw_payload: msg.rawPayload,
    })
    .select()
    .single()

  if (error) throw error
  return data as WaMessage
}

// Guarda un mensaje saliente (del bot o de un humano).
export async function saveOutboundMessage(
  conversationId: string,
  body: string,
  senderType: "bot" | "human",
  waMessageId?: string,
  senderUserId?: string
): Promise<WaMessage> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from("wa_messages")
    .insert({
      conversation_id: conversationId,
      wa_message_id: waMessageId ?? null,
      direction: "outbound",
      sender_type: senderType,
      sender_user_id: senderUserId ?? null,
      message_type: "text",
      body,
    })
    .select()
    .single()

  if (error) throw error
  return data as WaMessage
}

// Normaliza el payload crudo de Meta al tipo InboundMessage.
// Soporta mensajes de texto por ahora; los demás tipos se guardan igualmente
// para no perder datos, aunque el body puede quedar en null.
export function parseInboundPayload(payload: Record<string, unknown>): InboundMessage[] {
  const results: InboundMessage[] = []

  const entry = (payload.entry as any[])?.[0]
  const changes = (entry?.changes as any[])?.[0]
  const value = changes?.value

  if (!value?.messages) return results

  const contacts: any[] = value.contacts ?? []
  const messages: any[] = value.messages ?? []

  for (const msg of messages) {
    const contact = contacts.find((c: any) => c.wa_id === msg.from) ?? {}
    const displayName: string = contact?.profile?.name ?? msg.from

    let body: string | null = null
    let mediaUrl: string | null = null

    if (msg.type === "text") {
      body = msg.text?.body ?? null
    } else if (["image", "audio", "video", "document"].includes(msg.type)) {
      // En M2+ se procesarán media; por ahora solo guardamos el payload raw
      mediaUrl = msg[msg.type]?.link ?? null
    } else if (msg.type === "interactive") {
      // Botones / listas — extraemos la respuesta del usuario
      body =
        msg.interactive?.button_reply?.title ??
        msg.interactive?.list_reply?.title ??
        null
    }

    results.push({
      waMessageId: msg.id,
      from: msg.from,
      displayName,
      type: msg.type,
      body,
      mediaUrl: mediaUrl ?? undefined,
      timestamp: Number(msg.timestamp),
      rawPayload: msg,
    })
  }

  return results
}
