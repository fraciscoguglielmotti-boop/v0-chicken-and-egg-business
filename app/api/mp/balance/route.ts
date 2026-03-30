import { NextResponse } from "next/server"

const MP_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Cache-Control": "no-store",
})

async function tryFetch(url: string, token: string) {
  try {
    const res = await fetch(url, { headers: MP_HEADERS(token), cache: "no-store" })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({ error: "MP_ACCESS_TOKEN no configurado" }, { status: 500 })
    }

    // Obtener user ID y ver si viene el saldo en /users/me
    const meData = await tryFetch("https://api.mercadopago.com/users/me", accessToken)
    if (!meData?.id) throw new Error("No se pudo obtener el usuario de MP")
    const userId = meData.id

    // Intentar múltiples endpoints de saldo en orden
    const endpoints = [
      `https://api.mercadopago.com/v1/users/${userId}/mercadopago_account/balance`,
      `https://api.mercadopago.com/v1/account/balance`,
      `https://api.mercadopago.com/users/${userId}/mercadopago_account/balance`,
    ]

    for (const url of endpoints) {
      const data = await tryFetch(url, accessToken)
      if (!data) continue

      // Intentar todos los campos conocidos donde puede venir el saldo
      const saldo =
        data.available_balance ??
        data.total_amount ??
        data.available ??
        data.balance ??
        data.total ??
        data.amount ??
        data.wallet?.available_balance ??
        null

      if (saldo !== null) {
        return NextResponse.json({ available_balance: saldo })
      }
    }

    // Último recurso: calcular saldo desde movimientos recientes
    return NextResponse.json({ available_balance: null, message: "Saldo no expuesto por la API de MP para esta cuenta" })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
