import { google } from "googleapis"
import { NextResponse } from "next/server"

function getCredentials() {
  const b64 = process.env.GOOGLE_CREDENTIALS_BASE64
  if (b64) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf-8")
      const parsed = JSON.parse(decoded)
      if (parsed.client_email && parsed.private_key) {
        return { client_email: parsed.client_email, private_key: parsed.private_key }
      }
    } catch { /* ignore */ }
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY
  if (email && key) {
    return { client_email: email, private_key: key.replace(/\\n/g, "\n") }
  }
  return null
}

function getSheets() {
  const creds = getCredentials()
  if (!creds) throw new Error("Sin credenciales")
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
  return google.sheets({ version: "v4", auth })
}

// Generates a prefix based on sheet name: Ventas -> "V", Cobros -> "C", Pagos -> "P", Compras -> "CO"
function getPrefix(sheetName: string): string {
  const prefixes: Record<string, string> = {
    Ventas: "V",
    Cobros: "C",
    Pagos: "P",
    Compras: "CO",
    Gastos: "G",
    Mantenimientos: "M",
  }
  return prefixes[sheetName] || sheetName.charAt(0).toUpperCase()
}

export async function POST(request: Request) {
  try {
    const { sheetName } = await request.json()
    if (!sheetName) {
      return NextResponse.json({ error: "Falta sheetName" }, { status: 400 })
    }

    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
    if (!spreadsheetId) {
      return NextResponse.json({ error: "Falta GOOGLE_SPREADSHEET_ID" }, { status: 500 })
    }

    const sheets = getSheets()

    // Read all data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    })

    const allRows = response.data.values || []
    if (allRows.length < 2) {
      return NextResponse.json({ updated: 0, message: "No hay filas para procesar" })
    }

    const headers = allRows[0]
    const idColIndex = headers.findIndex(
      (h: string) => h.toLowerCase().replace(/\s+/g, "") === "id"
    )

    if (idColIndex === -1) {
      return NextResponse.json({ error: "No se encontro columna ID en la hoja" }, { status: 400 })
    }

    // Find the highest existing numeric ID
    const prefix = getPrefix(sheetName)
    let maxNum = 0
    for (let i = 1; i < allRows.length; i++) {
      const cellValue = allRows[i][idColIndex] || ""
      if (cellValue) {
        // Try to extract number from IDs like "V001", "C023", or plain "15"
        const numMatch = cellValue.replace(/^[A-Z]+/i, "")
        const num = Number.parseInt(numMatch, 10)
        if (!Number.isNaN(num) && num > maxNum) {
          maxNum = num
        }
      }
    }

    // Find rows without ID and assign new ones
    const updates: { range: string; value: string }[] = []
    let nextNum = maxNum + 1

    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i]
      const currentId = row[idColIndex] || ""
      
      // Only assign ID if cell is empty AND the row has some data (not a blank row)
      const hasData = row.some((cell: string, idx: number) => idx !== idColIndex && cell && cell.trim() !== "")
      
      if (!currentId && hasData) {
        const newId = `${prefix}${String(nextNum).padStart(3, "0")}`
        const colLetter = String.fromCharCode(65 + idColIndex) // A, B, C...
        updates.push({
          range: `${sheetName}!${colLetter}${i + 1}`,
          value: newId,
        })
        nextNum++
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ updated: 0, message: "Todas las filas ya tienen ID" })
    }

    // Batch update all empty IDs
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates.map((u) => ({
          range: u.range,
          values: [[u.value]],
        })),
      },
    })

    return NextResponse.json({
      updated: updates.length,
      message: `Se asignaron ${updates.length} IDs nuevos (${updates[0].value} a ${updates[updates.length - 1].value})`,
      ids: updates.map((u) => u.value),
    })
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: "Error al generar IDs", detail: errorMsg },
      { status: 500 }
    )
  }
}
