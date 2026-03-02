import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "El archivo debe ser un PDF" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Extraé todos los consumos/gastos de este resumen de tarjeta de crédito argentina.

Devolvé ÚNICAMENTE un JSON válido con este formato exacto, sin texto adicional ni bloques de código markdown:
{
  "gastos": [
    {
      "descripcion_original": "descripcion exacta del consumo tal como aparece en el resumen",
      "monto": 1234.56,
      "fecha": "YYYY-MM-DD"
    }
  ]
}

Instrucciones:
- Incluí TODOS los consumos y compras
- No incluyas: pagos de la tarjeta, saldo anterior, intereses, seguros, impuesto PAIS, percepciones, cargos por mora ni ajustes
- El monto debe ser un número positivo sin símbolo de moneda (formato: 1234.56)
- Si hay cuotas (ej: "3/6"), incluí el gasto con el monto de esa cuota, no el total
- Si la fecha exacta del consumo no está disponible usá null
- La descripcion_original debe ser el texto exacto del resumen, sin modificaciones`,
            },
          ],
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== "text") {
      throw new Error("Respuesta inesperada del modelo")
    }

    // Extract JSON — handle potential stray text around the object
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("No se encontró JSON en la respuesta del modelo")
    }

    const result = JSON.parse(jsonMatch[0])

    if (!result.gastos || !Array.isArray(result.gastos)) {
      throw new Error("Formato de respuesta inválido")
    }

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: `Error al procesar el PDF: ${msg}` }, { status: 500 })
  }
}
