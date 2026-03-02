import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const anthropic = new Anthropic()

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const PROMPT = `Este es un comprobante de pago o transferencia bancaria argentina.
Extraé los datos y respondé ÚNICAMENTE con un JSON válido, sin texto adicional:
{
  "monto": 1234.56,
  "fecha": "YYYY-MM-DD",
  "referencia": "número de operación, ID de transacción o comprobante",
  "remitente": "nombre completo del que envió el dinero",
  "destino_cvu": "CVU o CBU destino si aparece en el comprobante"
}
Si algún dato no está disponible usá null. El monto debe ser un número sin símbolo de moneda.`

async function extractComprobanteData(file: File) {
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString("base64")

  const isImage = file.type.startsWith("image/")
  const isPDF =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

  if (!isImage && !isPDF) {
    throw new Error("Formato no soportado. Subí una imagen (JPG/PNG) o PDF.")
  }

  const content: any[] = isImage
    ? [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: base64,
          },
        },
        { type: "text", text: PROMPT },
      ]
    : [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        },
        { type: "text", text: PROMPT },
      ]

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    messages: [{ role: "user", content }],
  })

  const text = message.content[0].type === "text" ? message.content[0].text : ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No se pudo extraer información del comprobante")

  return JSON.parse(jsonMatch[0]) as {
    monto: number | null
    fecha: string | null
    referencia: string | null
    remitente: string | null
    destino_cvu: string | null
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 })
    }

    // 1. Extract data from comprobante via Claude
    const extracted = await extractComprobanteData(file)

    if (!extracted.monto) {
      return NextResponse.json(
        { error: "No se pudo detectar el monto en el comprobante" },
        { status: 400 }
      )
    }

    // 2. Search for matching movement in movimientos_mp
    const supabase = getSupabase()

    const { data: movimientos } = await supabase
      .from("movimientos_mp")
      .select("*")
      .eq("tipo", "ingreso")
      .gte("monto", extracted.monto - 1)
      .lte("monto", extracted.monto + 1)
      .order("fecha", { ascending: false })
      .limit(10)

    let matched: any = null
    let estado: "verificado" | "sospechoso" | "sin_match" = "sin_match"
    let notas = ""

    if (movimientos && movimientos.length > 0) {
      if (extracted.fecha) {
        const compDate = new Date(extracted.fecha)
        const sameDayMatch = movimientos.find((m) => {
          const mpDate = new Date(m.fecha)
          const diffMs = Math.abs(mpDate.getTime() - compDate.getTime())
          return diffMs <= 2 * 24 * 60 * 60 * 1000 // ± 2 días
        })

        if (sameDayMatch) {
          matched = sameDayMatch
          estado = "verificado"
          notas = `Monto y fecha coinciden con movimiento MP del ${new Date(sameDayMatch.fecha).toLocaleDateString("es-AR")}`
        } else {
          matched = movimientos[0]
          estado = "sospechoso"
          notas = `El monto $${extracted.monto} existe en MP pero la fecha del comprobante (${extracted.fecha}) no coincide con el movimiento (${new Date(movimientos[0].fecha).toLocaleDateString("es-AR")}). Posible comprobante falso.`
        }
      } else {
        matched = movimientos[0]
        estado = "sospechoso"
        notas = `Se encontró un ingreso de $${extracted.monto} en MP pero no se pudo verificar la fecha del comprobante.`
      }
    } else {
      estado = "sin_match"
      notas = `No se encontró ningún ingreso de $${extracted.monto} en la cuenta de MercadoPago. El comprobante podría ser falso.`
    }

    // 3. Update movement status if verified
    if (matched && estado === "verificado") {
      await supabase
        .from("movimientos_mp")
        .update({ estado: "verificado" })
        .eq("id", matched.id)
    }

    // 4. Save comprobante result
    const { data: comprobante } = await supabase
      .from("comprobantes_mp")
      .insert({
        movimiento_id: matched?.id ?? null,
        monto_comprobante: extracted.monto,
        fecha_comprobante: extracted.fecha,
        referencia_comprobante: extracted.referencia,
        remitente: extracted.remitente,
        estado,
        notas,
      })
      .select()
      .single()

    return NextResponse.json({ extracted, matched, estado, notas, comprobante_id: comprobante?.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
