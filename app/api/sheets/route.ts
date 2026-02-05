import { google } from "googleapis";
import { NextResponse } from "next/server";

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

function tryParseJSON(raw: string): Record<string, string> | null {
  // Attempt 1: Direct parse
  try {
    return JSON.parse(raw);
  } catch { /* continue */ }

  // Attempt 2: Trim whitespace and try again
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch { /* continue */ }

  // Attempt 3: Remove surrounding quotes that Vars might add
  let cleaned = trimmed;
  if ((cleaned.startsWith("'") && cleaned.endsWith("'")) ||
      (cleaned.startsWith("`") && cleaned.endsWith("`"))) {
    cleaned = cleaned.slice(1, -1);
    try {
      return JSON.parse(cleaned);
    } catch { /* continue */ }
  }

  // Attempt 4: The env var system may have double-escaped the JSON
  // e.g. \\\" instead of \"
  try {
    const unescaped = cleaned.replace(/\\\\"/g, '"').replace(/\\"/g, '"');
    if (unescaped.startsWith("{")) {
      return JSON.parse(unescaped);
    }
  } catch { /* continue */ }

  // Attempt 5: Extract client_email and private_key with regex as last resort
  const emailMatch = raw.match(/client_email["\s:]+([^"]*@[^"]*\.com)/);
  const keyMatch = raw.match(/-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/);
  if (emailMatch && keyMatch) {
    return {
      client_email: emailMatch[1],
      private_key: keyMatch[0].replace(/\\n/g, "\n"),
    };
  }

  return null;
}

function getCredentials(): {
  credentials: ServiceAccountCredentials | null;
  error: string | null;
  debug?: Record<string, unknown>;
} {
  // Method 1: Full JSON (recommended)
  const jsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonRaw) {
    const parsed = tryParseJSON(jsonRaw);
    if (parsed && parsed.client_email && parsed.private_key) {
      return { credentials: { client_email: parsed.client_email, private_key: parsed.private_key }, error: null };
    }
    // Return debug info about what we received
    return {
      credentials: null,
      error: "No se pudo leer GOOGLE_SERVICE_ACCOUNT_JSON correctamente.",
      debug: {
        length: jsonRaw.length,
        first50: jsonRaw.substring(0, 50),
        last50: jsonRaw.substring(jsonRaw.length - 50),
        startsWithBrace: jsonRaw.trimStart().startsWith("{"),
        endsWithBrace: jsonRaw.trimEnd().endsWith("}"),
        hasClientEmail: jsonRaw.includes("client_email"),
        hasPrivateKey: jsonRaw.includes("private_key"),
        parsedSomething: parsed !== null,
      },
    };
  }

  // Method 2: Individual vars (fallback)
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (email && key) {
    let privateKey = key.replace(/\\n/g, "\n");
    if (
      (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
      (privateKey.startsWith("'") && privateKey.endsWith("'"))
    ) {
      privateKey = privateKey.slice(1, -1);
      privateKey = privateKey.replace(/\\n/g, "\n");
    }
    return {
      credentials: { client_email: email, private_key: privateKey },
      error: null,
    };
  }

  return {
    credentials: null,
    error:
      "No se encontraron credenciales. Configura GOOGLE_SERVICE_ACCOUNT_JSON (recomendado) o GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY.",
  };
}

function getSheets() {
  const { credentials, error } = getCredentials();
  if (!credentials || error) {
    throw new Error(error || "Sin credenciales");
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const sheetName = searchParams.get("sheet");

  if (action === "diagnose") {
    // Step 1: Check spreadsheet ID
    if (!process.env.GOOGLE_SPREADSHEET_ID) {
      return NextResponse.json({
        status: "missing_vars",
        message: "Falta la variable GOOGLE_SPREADSHEET_ID.",
        missing: ["GOOGLE_SPREADSHEET_ID"],
      });
    }

    // Step 2: Check credentials
    const { credentials, error: credError, debug: credDebug } = getCredentials();
    if (!credentials) {
      return NextResponse.json({
        status: "missing_vars",
        message: credError,
        debug: credDebug,
      });
    }

    // Step 3: Try to connect
    try {
      const sheets = getSheets();
      const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
      const response = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetTitles =
        response.data.sheets?.map((s) => s.properties?.title) || [];

      return NextResponse.json({
        status: "connected",
        message: `Conectado exitosamente a: "${response.data.properties?.title}"`,
        spreadsheetTitle: response.data.properties?.title,
        availableSheets: sheetTitles,
        serviceAccountEmail: credentials.client_email,
      });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (
        errorMsg.includes("DECODER") ||
        errorMsg.includes("unsupported") ||
        errorMsg.includes("PEM") ||
        errorMsg.includes("routines")
      ) {
        return NextResponse.json({
          status: "key_format_error",
          message:
            "Error con la clave privada. Usa el metodo recomendado: en Vars, crea GOOGLE_SERVICE_ACCOUNT_JSON y pega el contenido COMPLETO del archivo JSON descargado de Google Cloud (todo el contenido, incluyendo las llaves { }).",
          detail: errorMsg,
        });
      }
      if (errorMsg.includes("invalid_grant") || errorMsg.includes("JWT")) {
        return NextResponse.json({
          status: "auth_error",
          message:
            "Error de autenticacion. Verifica que las credenciales sean correctas y que la cuenta de servicio este activa.",
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
            "No se encontro la hoja de calculo. Verifica el GOOGLE_SPREADSHEET_ID y que la hoja este compartida con: " +
            credentials.client_email,
          detail: errorMsg,
        });
      }
      if (errorMsg.includes("403") || errorMsg.includes("permission")) {
        return NextResponse.json({
          status: "permission_error",
          message:
            "Sin permisos. Comparti la hoja de calculo con: " +
            credentials.client_email +
            " como Editor.",
          detail: errorMsg,
        });
      }

      return NextResponse.json({
        status: "error",
        message: "Error inesperado al conectar.",
        detail: errorMsg,
      });
    }
  }

  // Read data
  try {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!sheetName) {
      return NextResponse.json(
        { error: "Falta el parametro 'sheet'" },
        { status: 400 },
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
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { sheetName, values } = await request.json();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!sheetName || !values) {
      return NextResponse.json(
        { error: "Faltan campos requeridos (sheetName, values)" },
        { status: 400 },
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
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { sheetName, rowIndex, values } = await request.json();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!sheetName || rowIndex === undefined || !values) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 },
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
      { status: 500 },
    );
  }
}
