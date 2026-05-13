// Tipos compartidos para el módulo de WhatsApp

export interface WaConversation {
  id: string
  phone_number: string
  cliente_id: string | null
  display_name: string | null
  status: "active" | "escalated" | "closed"
  bot_enabled: boolean
  last_message_at: string | null
  last_inbound_at: string | null
  unread_count: number
  escalation_reason: string | null
  assigned_to: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface WaMessage {
  id: string
  conversation_id: string
  wa_message_id: string | null
  direction: "inbound" | "outbound"
  sender_type: "customer" | "bot" | "human"
  sender_user_id: string | null
  message_type: string
  body: string | null
  template_name: string | null
  template_components: unknown | null
  media_url: string | null
  raw_payload: unknown | null
  status: string | null
  created_at: string
}

export interface WaBotState {
  conversation_id: string
  current_state: string
  context: Record<string, unknown>
  updated_at: string
}

// Payload normalizado extraído del webhook de Meta
export interface InboundMessage {
  waMessageId: string
  from: string           // número E.164 sin +
  displayName: string
  type: string
  body: string | null
  mediaUrl?: string
  timestamp: number
  rawPayload: unknown
}

export interface SendTextParams {
  to: string
  body: string
}

export interface SendTemplateParams {
  to: string
  templateName: string
  languageCode?: string
  components?: unknown[]
}
