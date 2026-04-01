import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const anthropic = new Anthropic()

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Faltan variables de entorno de Supabase")
  return createClient(url, key)
}

function extractJson(text: string): unknown {
  const clean = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, "$1").trim()
  try {
    return JSON.parse(clean)
  } catch { /* continuar */ }

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

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 })
    }

    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    if (!isPDF) {
      return NextResponse.json({ error: "El archivo debe ser un PDF" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")

    // ── Extraer movimientos con Claude ──
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
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
              text: `Este es un resumen de cuenta de MercadoPago Argentina.
Extraé TODOS los movimientos de TODAS las páginas.

Devolvé ÚNICAMENTE un JSON válido con este formato exacto, sin texto adicional:
{
  "movimientos": [
    {
      "fecha": "YYYY-MM-DD",
      "descripcion": "descripción exacta como aparece en el PDF",
      "id_operacion": "número de ID de la operación",
      "valor": 1234.56
    }
  ]
}

Reglas:
- El campo "valor" debe ser un número: positivo para ingresos (entradas), negativo para egresos (salidas/pagos)
- Incluí TODOS los movimientos de TODAS las páginas del documento
- "descripcion" debe ser el texto exacto del PDF (ej: "Pago AUSOL", "Transferencia recibida Juan Perez", "Rendimientos")
- "id_operacion" es el número largo de la columna "ID de la operación"
- Si la fecha tiene formato DD-MM-YYYY convertila a YYYY-MM-DD
- No omitas ningún movimiento`,
            },
          ],
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== "text") {
      throw new Error("Respuesta inesperada del modelo")
    }

    const parsed = extractJson(content.text) as Record<string, unknown>
    if (!parsed.movimientos || !Array.isArray(parsed.movimientos)) {
      throw new Error("El modelo no devolvió movimientos válidos")
    }

    const movimientosRaw = parsed.movimientos as Array<{
      fecha: string
      descripcion: string
      id_operacion: string
      valor: number
    }>

    if (movimientosRaw.length === 0) {
      return NextResponse.json({ error: "No se encontraron movimientos en el PDF" }, { status: 400 })
    }

    // ── Normalizar y preparar para upsert ──
    const movimientos = movimientosRaw.map((m) => ({
      id: `pdf_${m.id_operacion}`,
      fecha: m.fecha,
      tipo: m.valor >= 0 ? "ingreso" : "egreso",
      monto: Math.abs(m.valor),
      descripcion: m.descripcion,
      referencia: String(m.id_operacion),
      // Los campos de la API que no vienen en el PDF se dejan en null
      pagador_nombre: null,
      pagador_email: null,
      tipo_operacion: null,
      metodo_pago: null,
      estado: "sin_verificar",
    }))

    const supabase = getSupabase()

    // Upsert: si el movimiento ya existe (mismo id) se actualiza la descripción
    // pero NO se pisa la categoría ni el concepto que el usuario haya editado
    const { error: upsertError } = await supabase
      .from("movimientos_mp")
      .upsert(movimientos, { onConflict: "id", ignoreDuplicates: false })

    if (upsertError) throw upsertError

    // ── Auto-clasificar egresos sin categoria ──
    let clasificados = 0
    const egresosIds = movimientos
      .filter((m) => m.tipo === "egreso")
      .map((m) => m.id)

    if (egresosIds.length > 0) {
      const [{ data: reglas }, { data: sinCategoria }] = await Promise.all([
        supabase.from("reglas_categorias").select("texto_original, categoria"),
        supabase
          .from("movimientos_mp")
          .select("id, descripcion")
          .in("id", egresosIds)
          .is("categoria", null),
      ])

      if (reglas && reglas.length > 0 && sinCategoria && sinCategoria.length > 0) {
        const updates: Array<{ id: string; categoria: string }> = []
        for (const mov of sinCategoria) {
          const texto = (mov.descripcion ?? "").toLowerCase()
          const match = reglas.find((r) =>
            texto.includes(r.texto_original.toLowerCase())
          )
          if (match) updates.push({ id: mov.id, categoria: match.categoria })
        }
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

    const ingresos = movimientos.filter((m) => m.tipo === "ingreso").length
    const egresos = movimientos.filter((m) => m.tipo === "egreso").length

    return NextResponse.json({
      importados: movimientos.length,
      ingresos,
      egresos,
      clasificados,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: `Error al procesar el PDF: ${msg}` }, { status: 500 })
  }
}
