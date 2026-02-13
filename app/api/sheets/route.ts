import { google } from "googleapis";
import { NextResponse } from "next/server";

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

function getCredentials(): {
  credentials: ServiceAccountCredentials | null;
  error: string | null;
  method?: string;
} {
  // Method 1 (recommended): Base64-encoded JSON
  const b64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (b64) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      if (parsed.client_email && parsed.private_key) {
        return {
          credentials: {
            client_email: parsed.client_email,
            private_key: parsed.private_key,
          },
          error: null,
          method: "base64",
        };
      }
      return {
        credentials: null,
        error:
          "El JSON decodificado no contiene client_email o private_key.",
      };
    } catch (e) {
      return {
        credentials: null,
        error: `Error al decodificar GOOGLE_CREDENTIALS_BASE64: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // Method 2: Individual vars
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (email && key) {
    const privateKey = key.replace(/\\n/g, "\n");
    return {
      credentials: { client_email: email, private_key: privateKey },
      error: null,
      method: "individual",
    };
  }

  return {
    credentials: null,
    error:
      "No se encontraron credenciales. Configura GOOGLE_CREDENTIALS_BASE64 desde la seccion Google Sheets de la app.",
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
    if (!process.env.GOOGLE_SPREADSHEET_ID) {
      return NextResponse.json({
        status: "missing_vars",
        message:
          "Falta la variable GOOGLE_SPREADSHEET_ID. Agregala en Vars del sidebar.",
        missing: ["GOOGLE_SPREADSHEET_ID"],
      });
    }

    const { credentials, error: credError, method } = getCredentials();
    if (!credentials) {
      return NextResponse.json({
        status: "missing_vars",
        message: credError,
      });
    }

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
        method,
      });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (
        errorMsg.includes("DECODER") ||
        errorMsg.includes("unsupported") ||
        errorMsg.includes("routines")
      ) {
        return NextResponse.json({
          status: "key_format_error",
          message:
            "Error con la clave privada. Usa la herramienta de la seccion Google Sheets para generar la variable correctamente.",
          detail: errorMsg,
        });
      }
      if (errorMsg.includes("invalid_grant") || errorMsg.includes("JWT")) {
        return NextResponse.json({
          status: "auth_error",
          message:
            "Error de autenticacion. Verifica que las credenciales sean correctas y que la cuenta de servicio este activa en Google Cloud.",
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
          message: `No se encontro la hoja. Verifica el GOOGLE_SPREADSHEET_ID y que la hoja este compartida con: ${credentials.client_email}`,
          detail: errorMsg,
        });
      }
      if (errorMsg.includes("403") || errorMsg.includes("permission")) {
        return NextResponse.json({
          status: "permission_error",
          message: `Sin permisos. Comparti la hoja con: ${credentials.client_email} como Editor.`,
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

    // Get headers as formatted text (column names)
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const headers = headerRes.data.values?.[0] || [];

    // Get data rows as unformatted values (raw numbers, not "$68,500")
    const dataRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:Z`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rawData = dataRes.data.values || [];
    // Convert all values to strings for consistent handling downstream
    const data = rawData.map((row: unknown[]) =>
      row.map((cell) => (cell === null || cell === undefined) ? "" : String(cell))
    );

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

function colIndexToLetter(idx: number): string {
  let letter = "";
  let n = idx;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

export async function PATCH(request: Request) {
  try {
    const { sheetName, rowIndex, column, value } = await request.json();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!sheetName || rowIndex === undefined || !column) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 },
      );
    }
    const sheets = getSheets();

    // Get headers to find the target column
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const headers = headerRes.data.values?.[0] || [];
    const normalizeCol = (s: string) => s.trim().toLowerCase().replace(/[\s_]/g, "");

    // Find column index (case-insensitive, normalized)
    let colIdx = headers.findIndex(
      (h: string) => normalizeCol(h) === normalizeCol(column),
    );

    // If column doesn't exist, append it as a new header
    if (colIdx === -1) {
      colIdx = headers.length;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!${colIndexToLetter(colIdx)}1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[column]] },
      });
    }

    // Update the specific cell
    const cellRange = `${sheetName}!${colIndexToLetter(colIdx)}${rowIndex + 2}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellRange,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[value]] },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Error al actualizar celda", detail: errorMsg },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { sheetName, rowIndex } = await request.json();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!sheetName || rowIndex === undefined) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 },
      );
    }
    const sheets = getSheets();

    // Get the sheetId (numeric) for the given sheet name
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetMeta = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === sheetName,
    );
    if (!sheetMeta?.properties?.sheetId && sheetMeta?.properties?.sheetId !== 0) {
      return NextResponse.json(
        { error: `Hoja "${sheetName}" no encontrada` },
        { status: 404 },
      );
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetMeta.properties.sheetId,
                dimension: "ROWS",
                startIndex: rowIndex + 1, // +1 for header row
                endIndex: rowIndex + 2,
              },
            },
          },
        ],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Error al eliminar fila", detail: errorMsg },
      { status: 500 },
    );
  }
}
