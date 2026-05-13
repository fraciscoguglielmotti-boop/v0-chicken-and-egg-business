import type { SendTextParams, SendTemplateParams } from "./types"

const BASE_URL = "https://graph.facebook.com"

function getConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v21.0"
  if (!phoneNumberId || !accessToken) {
    throw new Error("Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN en las variables de entorno")
  }
  return { phoneNumberId, accessToken, apiVersion }
}

async function postToCloud(body: Record<string, unknown>): Promise<{ messageId: string }> {
  const { phoneNumberId, accessToken, apiVersion } = getConfig()
  const res = await fetch(`${BASE_URL}/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `WhatsApp Cloud API error ${res.status}`)
  }
  return { messageId: data.messages?.[0]?.id ?? "" }
}

export async function sendTextMessage({ to, body }: SendTextParams) {
  return postToCloud({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  })
}

export async function sendTemplateMessage({
  to,
  templateName,
  languageCode = "es_AR",
  components,
}: SendTemplateParams) {
  return postToCloud({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  })
}

// Marca un mensaje inbound como leído (actualiza el tilde azul en el cliente)
export async function markAsRead(waMessageId: string) {
  const { phoneNumberId, accessToken, apiVersion } = getConfig()
  await fetch(`${BASE_URL}/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: waMessageId,
    }),
  })
  // No lanzar error si falla — no es crítico
}
