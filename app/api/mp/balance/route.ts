import { NextResponse } from "next/server"

export async function GET() {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({ error: "MP_ACCESS_TOKEN no configurado" }, { status: 500 })
    }

    // Obtener user ID
    const meRes = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
    if (!meRes.ok) throw new Error(`Error al obtener usuario: ${meRes.status}`)
    const meData = await meRes.json()
    const userId = meData.id

    // Obtener saldo disponible
    const balRes = await fetch(
      `https://api.mercadopago.com/v1/users/${userId}/mercadopago_account/balance`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    )

    if (!balRes.ok) {
      // Fallback: algunos endpoints alternativos
      const balRes2 = await fetch(
        `https://api.mercadopago.com/v1/account/balance`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }
      )
      if (!balRes2.ok) throw new Error(`Saldo no disponible: ${balRes.status}`)
      const bal2 = await balRes2.json()
      return NextResponse.json({ available_balance: bal2.available_balance ?? bal2.total ?? 0 })
    }

    const bal = await balRes.json()
    // La respuesta puede tener distintos campos según la versión
    const disponible =
      bal.available_balance ??
      bal.total_amount ??
      bal.available ??
      bal.balance ??
      0

    return NextResponse.json({ available_balance: disponible, raw: bal })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
