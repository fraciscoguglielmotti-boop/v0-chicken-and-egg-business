import { google } from "googleapis";
import { NextResponse } from "next/server";

function checkEnvVars() {
  const missing: string[] = [];
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
    missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  if (!process.env.GOOGLE_PRIVATE_KEY) missing.push("GOOGLE_PRIVATE_KEY");
  if (!process.env.GOOGLE_SPREADSHEET_ID)
    missing.push("GOOGLE_SPREADSHEET_ID");
  return missing;
}

function parsePrivateKey(raw: string | undefined): string {
  if (!raw) return "";
  // Remove surrounding quotes if present (single or double)
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // Replace all literal \n sequences with actual newlines
  key = key.replace(/\\n/g, "\n");
  // Ensure proper PEM format
  if (!key.includes("-----BEGIN")) {
    key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----\n`;
  }
  return key;
}

function getAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = parsePrivateKey(process.env.GOOGLE_PRIVATE_KEY);

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

// GET - Diagnostico o leer datos
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const sheetName = searchParams.get("sheet");

  // Endpoint de diagnostico
  if (action === "diagnose") {
    const missing = checkEnvVars();
    if (missing.length > 0) {
      return NextResponse.json({
        status: "missing_vars",
        message: `Faltan variables de entorno: ${missing.join(", ")}`,
        missing,
      });
    }

    // Intentar conectar
    try {
      const sheets = getSheets();
      const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
      const response = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetTitles =
        response.data.sheets?.map((s) => s.properties?.title) || [];

      return NextResponse.json({
        status: "connected",
        message: `Conectado a: "${response.data.properties?.title}"`,
        spreadsheetTitle: response.data.properties?.title,
        availableSheets: sheetTitles,
      });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg.includes("DECODER") || errorMsg.includes("unsupported") || errorMsg.includes("PEM")) {
        return NextResponse.json({
          status: "key_format_error",
          message:
            "La GOOGLE_PRIVATE_KEY tiene un formato incorrecto. Asegurate de copiar la clave COMPLETA del archivo JSON incluyendo '-----BEGIN PRIVATE KEY-----' y '-----END PRIVATE KEY-----'. No agregues comillas alrededor del valor en la variable de entorno.",
          detail: errorMsg,
        });
      }
      if (errorMsg.includes("invalid_grant") || errorMsg.includes("JWT")) {
        return NextResponse.json({
          status: "auth_error",
          message:
            "Error de autenticacion. Verifica que GOOGLE_PRIVATE_KEY y GOOGLE_SERVICE_ACCOUNT_EMAIL sean correctos.",
          detail: errorMsg,
        });
      }
      if (
        errorMsg.includes("not found") ||
        errorMsg.includes("404") ||
        errorMsg.includes("Requested entity was not found")
      ) {
        return NextResponse.json({
          status: "not_found",
          message:
            "No se encontro la hoja de calculo. Verifica el GOOGLE_SPREADSHEET_ID y que la hoja este compartida con la cuenta de servicio.",
          detail: errorMsg,
        });
      }
      if (errorMsg.includes("403") || errorMsg.includes("permission")) {
        return NextResponse.json({
          status: "permission_error",
          message:
            "Sin permisos. Asegurate de compartir la hoja con el email de la cuenta de servicio como Editor.",
          detail: errorMsg,
        });
      }

      return NextResponse.json({
        status: "error",
        message: "Error inesperado al conectar con Google Sheets.",
        detail: errorMsg,
      });
    }
  }

  // Leer datos de una hoja
  try {
    const missing = checkEnvVars();
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Faltan variables: ${missing.join(", ")}`,
          missing,
        },
        { status: 400 }
      );
    }

    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!sheetName) {
      return NextResponse.json(
        { error: "Falta el parametro 'sheet'" },
        { status: 400 }
      );
    }

    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values || [];
    const headers = rows.length > 0 ? rows[0] : [];
    const data = rows.length > 1 ? rows.slice(1) : [];

    return NextResponse.json({ headers, data });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Error al leer Google Sheets", detail: errorMsg },
      { status: 500 }
    );
  }
}

// POST - Agregar filas
export async function POST(request: Request) {
  try {
    const missing = checkEnvVars();
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Faltan variables: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const { sheetName, values } = await request.json();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!sheetName || !values) {
      return NextResponse.json(
        { error: "Faltan campos requeridos (sheetName, values)" },
        { status: 400 }
      );
    }

    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Error al escribir en Google Sheets", detail: errorMsg },
      { status: 500 }
    );
  }
}

// PUT - Actualizar fila
export async function PUT(request: Request) {
  try {
    const missing = checkEnvVars();
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Faltan variables: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const { sheetName, rowIndex, values } = await request.json();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!sheetName || rowIndex === undefined || !values) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    const sheets = getSheets();
    const range = `${sheetName}!A${rowIndex + 2}:Z${rowIndex + 2}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Error al actualizar Google Sheets", detail: errorMsg },
      { status: 500 }
    );
  }
}
