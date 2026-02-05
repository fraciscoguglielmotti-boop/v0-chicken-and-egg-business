import { google } from "googleapis"
import { NextResponse } from "next/server"

// Configuración de autenticación con Google Sheets
function getAuth() {
  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Google Sheets credentials not configured")
  }

  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
}

function getSheets() {
  const auth = getAuth()
  return google.sheets({ version: "v4", auth })
}

// GET - Leer datos de una hoja
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sheetName = searchParams.get("sheet")
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

    if (!sheetName || !spreadsheetId) {
      return NextResponse.json(
        { error: "Missing sheet name or spreadsheet ID" },
        { status: 400 }
      )
    }

    const sheets = getSheets()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    })

    const rows = response.data.values || []
    
    // Remover header row si existe
    const data = rows.length > 1 ? rows.slice(1) : []

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error reading from Google Sheets:", error)
    return NextResponse.json(
      { error: "Failed to read from Google Sheets", details: String(error) },
      { status: 500 }
    )
  }
}

// POST - Agregar filas a una hoja
export async function POST(request: Request) {
  try {
    const { sheetName, values } = await request.json()
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

    if (!sheetName || !values || !spreadsheetId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const sheets = getSheets()
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error writing to Google Sheets:", error)
    return NextResponse.json(
      { error: "Failed to write to Google Sheets", details: String(error) },
      { status: 500 }
    )
  }
}

// PUT - Actualizar una fila específica
export async function PUT(request: Request) {
  try {
    const { sheetName, rowIndex, values } = await request.json()
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

    if (!sheetName || rowIndex === undefined || !values || !spreadsheetId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const sheets = getSheets()
    // +2 porque las filas empiezan en 1 y hay header
    const range = `${sheetName}!A${rowIndex + 2}:Z${rowIndex + 2}`
    
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [values],
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating Google Sheets:", error)
    return NextResponse.json(
      { error: "Failed to update Google Sheets", details: String(error) },
      { status: 500 }
    )
  }
}
