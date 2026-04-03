import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 300

const anthropic = new Anthropic()

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Faltan variables de entorno de Supabase")
  return createClient(url, key)
}

function extractJson(text: string): unknown {
  const clean = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, "$1").trim()
  try { return JSON.parse(clean) } catch { /* continuar */ }
  let depth = 0, start = -1
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === "{") { if (depth === 0) start = i; depth++ }
    else if (clean[i] === "}") {
      depth--
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(clean.slice(start, i + 1)) } catch { start = -1 }
      }
    }
  }
  throw new Error("No se encontró JSON válido en la respuesta del modelo")
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 })

    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    if (!isPDF) return NextResponse.json({ error: "El archivo debe ser un PDF" }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            {
              type: "text",
              text: `Este es un "Resumen de Cuenta" de MercadoPago Argentina. Tiene 15 páginas.

Extraé ÚNICAMENTE las filas de la tabla "DETALLE DE MOVIMIENTOS" de TODAS las páginas.
Ignorá el encabezado (Saldo Inicial, Entradas, Salidas, Saldo Final).

Devolvé ÚNICAMENTE este JSON, sin texto adicional:
{
  "movimientos": [
    {
      "fecha": "YYYY-MM-DD",
      "descripcion": "texto exacto de la columna Descripción",
      "id_operacion": "número de la columna ID de la operación",
      "valor": 1234.56
    }
  ]
}

CONVERSIÓN DE NÚMEROS (formato argentino: punto=miles, coma=decimal):
  "$ 200.000,00"    →  200000.0   (positivo = ingreso)
  "$ 4.883,52"      →  4883.52    (positivo = ingreso)
  "$ -43.888,00"    →  -43888.0   (negativo = egreso)
  "$ -600.000,00"   →  -600000.0  (negativo = egreso)
  "$ -699,09"       →  -699.09    (negativo = egreso)

CONVERSIÓN DE FECHA: DD-MM-YYYY → YYYY-MM-DD
  "01-03-2026" → "2026-03-01"
  "02-03-2026" → "2026-03-02"

Incluí absolutamente todos los movimientos de todas las páginas, sin omitir ninguno.`,
            },
          ],
        },
      ],
    })

    const message = await stream.finalMessage()
    const content = message.content[0]
    if (content.type !== "text") throw new Error("Respuesta inesperada del modelo")

    const parsed = extractJson(content.text) as Record<string, unknown>
    if (!parsed.movimientos || !Array.isArray(parsed.movimientos)) {
      throw new Error("El modelo no devolvió movimientos válidos")
    }

    const raw = parsed.movimientos as Array<{
      fecha: string
      descripcion: string
      id_operacion: string
      valor: number
    }>

    if (raw.length === 0) {
      return NextResponse.json({ error: "No se encontraron movimientos en el PDF" }, { status: 400 })
    }

    const movimientos = raw.map((m) => ({
      id: `pdf_${m.id_operacion}`,
      fecha: m.fecha,
      tipo: m.valor >= 0 ? "ingreso" : "egreso",
      monto: Math.abs(m.valor),
      descripcion: m.descripcion,
      referencia: String(m.id_operacion),
      pagador_nombre: null,
      pagador_email: null,
      tipo_operacion: null,
      metodo_pago: null,
      estado: "sin_verificar",
    }))

    const supabase = getSupabase()
    const { error: upsertError } = await supabase
      .from("movimientos_mp")
      .upsert(movimientos, { onConflict: "id", ignoreDuplicates: false })
    if (upsertError) throw upsertError

    // Auto-clasificar egresos sin categoría usando reglas guardadas
    let clasificados = 0
    const egresosIds = movimientos.filter((m) => m.tipo === "egreso").map((m) => m.id)
    if (egresosIds.length > 0) {
      const [{ data: reglas }, { data: sinCat }] = await Promise.all([
        supabase.from("reglas_categorias").select("texto_original, categoria"),
        supabase.from("movimientos_mp").select("id, descripcion").in("id", egresosIds).is("categoria", null),
      ])
      if (reglas?.length && sinCat?.length) {
        const updates = sinCat.flatMap((mov) => {
          const texto = (mov.descripcion ?? "").toLowerCase()
          const match = reglas.find((r) => texto.includes(r.texto_original.toLowerCase()))
          return match ? [{ id: mov.id, categoria: match.categoria }] : []
        })
        if (updates.length > 0) {
          await Promise.all(
            updates.map((u) =>
              supabase.from("movimientos_mp").update({ categoria: u.categoria }).eq("id", u.id)
            )
          )
          clasificados = updates.length
        }
      }
    }

    return NextResponse.json({
      importados: movimientos.length,
      ingresos: movimientos.filter((m) => m.tipo === "ingreso").length,
      egresos: movimientos.filter((m) => m.tipo === "egreso").length,
      clasificados,
    })
  } catch (err) {
    let msg = "Error desconocido"
    if (err instanceof Error) {
      msg = err.message
    } else if (typeof err === "string") {
      msg = err
    } else if (err && typeof err === "object") {
      msg = JSON.stringify(err)
    }
    return NextResponse.json({ error: `Error al procesar el PDF: ${msg}` }, { status: 500 })
  }
}
