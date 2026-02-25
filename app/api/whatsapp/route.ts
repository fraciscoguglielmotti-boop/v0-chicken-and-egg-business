import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { telefono, clienteNombre, saldo, totalVentas, totalCobrado } = await req.json()

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        { error: "WhatsApp credentials not configured" },
        { status: 500 }
      )
    }

    if (!telefono) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      )
    }

    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)

    const messageBody = `Hola ${clienteNombre}! 👋\n\nEstado de cuenta AviGest:\n• Total comprado: ${formatCurrency(totalVentas)}\n• Total pagado: ${formatCurrency(totalCobrado)}\n• Saldo pendiente: ${formatCurrency(saldo)}\n\nGracias por su preferencia!`

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: telefono,
          type: "text",
          text: { body: messageBody },
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Error sending WhatsApp message" },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true, messageId: data.messages?.[0]?.id })
  } catch (error) {
    console.error("[whatsapp] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
