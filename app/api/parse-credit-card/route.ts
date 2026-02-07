import { NextResponse } from "next/server"

interface ParsedGasto {
  descripcion: string
  monto: number
  cuotas: string
  fecha?: string
}

interface ParsedResult {
  gastos: ParsedGasto[]
  tarjeta: string
  banco: string
  periodo: string
  total: number
}

// Detect card type from text
function detectCardType(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes("mastercard")) return "Mastercard"
  if (lower.includes("visa")) return "Visa"
  if (lower.includes("american express") || lower.includes("amex")) return "American Express"
  return "Otra"
}

// Detect bank from text
function detectBank(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes("nacion") || lower.includes("nación")) return "Banco Nacion"
  if (lower.includes("galicia")) return "Banco Galicia"
  if (lower.includes("macro")) return "Banco Macro"
  if (lower.includes("provincia")) return "Banco Provincia"
  if (lower.includes("santander")) return "Santander"
  if (lower.includes("bbva") || lower.includes("francés") || lower.includes("frances")) return "BBVA"
  if (lower.includes("hsbc")) return "HSBC"
  if (lower.includes("icbc")) return "ICBC"
  if (lower.includes("patagonia")) return "Banco Patagonia"
  if (lower.includes("ciudad")) return "Banco Ciudad"
  if (lower.includes("supervielle")) return "Banco Supervielle"
  return "Otro"
}

// Detect period from text
function detectPeriod(text: string): string {
  // Look for patterns like "Cierre: 15/01/2025" or "Periodo: Enero 2025"
  const cierreMatch = text.match(/cierre[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})/i)
  if (cierreMatch) return cierreMatch[1]

  const periodoMatch = text.match(/per[ií]odo[:\s]*([\w\s]+\d{4})/i)
  if (periodoMatch) return periodoMatch[1].trim()

  // Look for month/year pattern
  const monthYear = text.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})/i)
  if (monthYear) return `${monthYear[1]} ${monthYear[2]}`

  return new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

// Parse consumptions from raw text - handles various AR bank formats
function parseConsumptions(text: string): ParsedGasto[] {
  const gastos: ParsedGasto[] = []
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)

  // Common patterns in AR credit card statements:
  // 1. "DESCRIPCION       CUOTA X/Y       $1.234,56"
  // 2. "DD/MM DESCRIPCION  1.234,56"
  // 3. "DESCRIPCION  CUOTA 01/06  $ 1.234,56"

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip header/footer lines
    if (
      /^(fecha|concepto|detalle|total|saldo|pago|minimo|vencimiento|n[uú]mero|resumen|cierre|apertura)/i.test(line) ||
      line.length < 10
    ) {
      continue
    }

    // Pattern: Look for a monetary amount at the end of the line
    // Argentine format: 1.234,56 or $1.234,56 or $ 1.234,56
    const montoMatch = line.match(/\$?\s*(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*$/);
    if (!montoMatch) continue

    const montoStr = montoMatch[1].replace(/\./g, "").replace(",", ".")
    const monto = Math.abs(Number.parseFloat(montoStr))
    if (Number.isNaN(monto) || monto < 1) continue

    // Extract description (everything before the amount)
    let descripcion = line.substring(0, montoMatch.index || 0).trim()

    // Remove leading date if present (DD/MM or DD/MM/YY)
    descripcion = descripcion.replace(/^\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?\s*/, "")

    // Extract cuotas pattern
    let cuotas = "1/1"
    const cuotasMatch = descripcion.match(/\b(?:cuota\s*)?(\d{1,2})\s*[/de]+\s*(\d{1,2})\b/i)
    if (cuotasMatch) {
      cuotas = `${cuotasMatch[1]}/${cuotasMatch[2]}`
      // Remove cuotas text from description
      descripcion = descripcion.replace(cuotasMatch[0], "").trim()
    }

    // Clean up description
    descripcion = descripcion.replace(/\s{2,}/g, " ").replace(/[-_]+$/, "").trim()

    if (descripcion.length < 3) continue

    // Skip known non-consumption lines
    if (/^(impuesto|iva|interes|seguro de vida|cargo por)/i.test(descripcion)) continue

    gastos.push({
      descripcion,
      monto,
      cuotas,
    })
  }

  return gastos
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No se recibio ningun archivo" }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "El archivo debe ser un PDF" }, { status: 400 })
    }

    // Read file as ArrayBuffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Extract text from PDF using a simple text extraction approach
    // We convert to string and look for readable text patterns
    let extractedText = ""

    try {
      // Try to extract text from the PDF binary
      // PDF text is often between BT and ET markers, or in parentheses after Tj/TJ operators
      const pdfString = buffer.toString("latin1")

      // Method 1: Extract text from PDF streams
      const textMatches = pdfString.match(/\(([^)]+)\)/g) || []
      const streamText = textMatches
        .map((m) => m.slice(1, -1))
        .filter((t) => t.length > 1 && /[a-zA-Z0-9]/.test(t))
        .join(" ")

      // Method 2: Look for decoded stream content
      const streamRegex = /stream\r?\n([\s\S]*?)endstream/g
      let streamMatch: RegExpExecArray | null = null
      const streamTexts: string[] = []

      while ((streamMatch = streamRegex.exec(pdfString)) !== null) {
        const content = streamMatch[1]
        // Extract readable text from stream
        const readable = content.replace(/[^\x20-\x7E\n\r]/g, " ").replace(/\s+/g, " ").trim()
        if (readable.length > 20) {
          streamTexts.push(readable)
        }
      }

      extractedText = [streamText, ...streamTexts].join("\n")

      // If we couldn't extract meaningful text, try another approach
      if (extractedText.replace(/\s/g, "").length < 50) {
        // Try to find text between brackets in the raw PDF
        const bracketText = pdfString.match(/\[([^\]]+)\]/g) || []
        const additionalText = bracketText
          .map((m) => {
            const inner = m.slice(1, -1)
            const parts = inner.match(/\(([^)]+)\)/g) || []
            return parts.map((p) => p.slice(1, -1)).join("")
          })
          .filter((t) => t.length > 0)
          .join("\n")

        extractedText = [extractedText, additionalText].join("\n")
      }
    } catch {
      return NextResponse.json({
        error: "No se pudo leer el contenido del PDF. Asegurate de que el archivo no este protegido con contrasena.",
      }, { status: 400 })
    }

    if (extractedText.replace(/\s/g, "").length < 30) {
      return NextResponse.json({
        error: "No se pudo extraer texto del PDF. El archivo puede ser una imagen escaneada. Proba con un resumen digital (no escaneado).",
      }, { status: 400 })
    }

    // Detect card info
    const tarjeta = detectCardType(extractedText)
    const banco = detectBank(extractedText)
    const periodo = detectPeriod(extractedText)

    // Parse consumptions
    const gastos = parseConsumptions(extractedText)
    const total = gastos.reduce((a, g) => a + g.monto, 0)

    if (gastos.length === 0) {
      return NextResponse.json({
        error: "No se pudieron detectar consumos en el resumen. El formato del PDF puede no ser compatible. Podes cargar los gastos manualmente.",
      }, { status: 400 })
    }

    return NextResponse.json({
      gastos,
      tarjeta,
      banco,
      periodo,
      total,
    } satisfies ParsedResult)
  } catch (err) {
    return NextResponse.json({
      error: `Error interno: ${err instanceof Error ? err.message : "desconocido"}`,
    }, { status: 500 })
  }
}
