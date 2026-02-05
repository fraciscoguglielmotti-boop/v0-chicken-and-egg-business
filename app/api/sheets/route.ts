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
  let key = raw.trim();

  // Remove surrounding quotes (single, double, or backtick)
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'")) ||
    (key.startsWith("`") && key.endsWith("`"))
  ) {
    key = key.slice(1, -1);
  }

  // Replace literal \n with real newlines (handles both \\n and \n)
  key = key.replace(/\\n/g, "\n");

  // Also handle cases where the key was JSON-escaped twice
  key = key.replace(/\\\\n/g, "\n");

  // Remove any carriage returns
  key = key.replace(/\r/g, "");

  // If the key doesn't have PEM headers, try to reconstruct
  if (!key.includes("-----BEGIN")) {
    // Maybe the user pasted just the base64 content
    const cleanBase64 = key.replace(/\s+/g, "");
    key = `-----BEGIN PRIVATE KEY-----\n${cleanBase64}\n-----END PRIVATE KEY-----\n`;
  }

  // Ensure the key ends with a newline after END marker
  if (key.includes("-----END PRIVATE KEY-----") && !key.endsWith("\n")) {
    key = key + "\n";
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

    // Debug: analizar el estado de la clave
    const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
    const parsedKey = parsePrivateKey(rawKey);
    const keyDebug = {
      rawLength: rawKey.length,
      parsedLength: parsedKey.length,
      rawStartsWith: rawKey.substring(0, 30),
      rawEndsWith: rawKey.substring(rawKey.length - 30),
      parsedStartsWith: parsedKey.substring(0, 35),
      parsedHasBeginMarker: parsedKey.includes("-----BEGIN PRIVATE KEY-----"),
      parsedHasEndMarker: parsedKey.includes("-----END PRIVATE KEY-----"),
      parsedHasRealNewlines: parsedKey.includes("\n"),
      parsedNewlineCount: (parsedKey.match(/\n/g) || []).length,
    };
    console.log("[v0] Key debug info:", JSON.stringify(keyDebug, null, 2));

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

      if (errorMsg.includes("DECODER") || errorMsg.includes("unsupported") || errorMsg.includes("PEM") || errorMsg.includes("routines")) {
        return NextResponse.json({
          status: "key_format_error",
          message:
            "La GOOGLE_PRIVATE_KEY tiene formato incorrecto. Ve al sidebar > Vars, borra la variable GOOGLE_PRIVATE_KEY y volvela a pegar. Copia el valor del campo 'private_key' del JSON descargado de Google Cloud, SIN las comillas externas. Debe empezar con -----BEGIN PRIVATE KEY----- y terminar con -----END PRIVATE KEY-----",
          detail: errorMsg,
          keyDebug,
        });
      }
      if (errorMsg.includes("invalid_grant") || errorMsg.includes("JWT")) {
        return NextResponse.json({
          status: "auth_error",
          message:
            "Error de autenticacion. Verifica que GOOGLE_PRIVATE_KEY y GOOGLE_SERVICE_ACCOUNT_EMAIL sean correctos.",
          detail: errorMsg,
          keyDebug,
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
