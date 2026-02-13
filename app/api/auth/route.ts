import { google } from "googleapis";
import { NextResponse } from "next/server";
import crypto from "crypto";

function getCredentials() {
  const b64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (b64) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      if (parsed.client_email && parsed.private_key) {
        return { client_email: parsed.client_email, private_key: parsed.private_key };
      }
    } catch { /* fall through */ }
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (email && key) {
    return { client_email: email, private_key: key.replace(/\\n/g, "\n") };
  }
  return null;
}

function getSheets() {
  const creds = getCredentials();
  if (!creds) throw new Error("Sin credenciales de Google");
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Ensure Usuarios and Configuracion sheets exist, creating them if needed
async function ensureAuthSheets(sheets: ReturnType<typeof getSheets>, spreadsheetId: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.map((s) => s.properties?.title) || [];

  const requests: unknown[] = [];

  if (!existing.includes("Usuarios")) {
    requests.push({ addSheet: { properties: { title: "Usuarios" } } });
  }
  if (!existing.includes("Configuracion")) {
    requests.push({ addSheet: { properties: { title: "Configuracion" } } });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }

  // Check if Usuarios has headers
  const headerCheck = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Usuarios!A1:F1",
  });

  if (!headerCheck.data.values || headerCheck.data.values.length === 0) {
    // Set headers and default admin user
    const adminHash = hashPassword("admin");
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Usuarios!A1:F2",
      valueInputOption: "RAW",
      requestBody: {
        values: [
          ["ID", "Nombre", "Usuario", "Password", "Rol", "Activo"],
          ["U001", "Administrador", "admin", adminHash, "admin", "TRUE"],
        ],
      },
    });
  }

  // Check if Configuracion has headers
  const configCheck = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Configuracion!A1:B1",
  });

  if (!configCheck.data.values || configCheck.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Configuracion!A1:B2",
      valueInputOption: "RAW",
      requestBody: {
        values: [
          ["Clave", "Valor"],
          ["login_activo", "TRUE"],
        ],
      },
    });
  }
}

// POST: Login
export async function POST(request: Request) {
  try {
    const { usuario, contrasena } = await request.json();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: "GOOGLE_SPREADSHEET_ID no configurado" }, { status: 500 });
    }

    const sheets = getSheets();
    await ensureAuthSheets(sheets, spreadsheetId);

    // Check if login is enabled
    const configRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Configuracion!A:B",
    });
    const configRows = configRes.data.values || [];
    const loginRow = configRows.find((r) => r[0] === "login_activo");
    const loginActivo = loginRow ? loginRow[1]?.toUpperCase() === "TRUE" : true;

    if (!loginActivo) {
      // Login disabled - auto-authenticate
      return NextResponse.json({
        success: true,
        user: { id: "auto", nombre: "Usuario", usuario: "auto", rol: "admin" },
        loginDisabled: true,
      });
    }

    if (!usuario || !contrasena) {
      return NextResponse.json({ error: "Faltan credenciales" }, { status: 400 });
    }

    // Read users
    const usersRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Usuarios!A:F",
    });
    const rows = usersRes.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ error: "No hay usuarios configurados" }, { status: 401 });
    }

    const headers = rows[0];
    const userIdx = headers.indexOf("Usuario");
    const passIdx = headers.indexOf("Password");
    const idIdx = headers.indexOf("ID");
    const nameIdx = headers.indexOf("Nombre");
    const rolIdx = headers.indexOf("Rol");
    const activoIdx = headers.indexOf("Activo");

    const inputHash = hashPassword(contrasena);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowUser = row[userIdx]?.trim();
      const rowPass = row[passIdx]?.trim();
      const rowActivo = activoIdx >= 0 ? row[activoIdx]?.toUpperCase() : "TRUE";

      if (rowActivo !== "TRUE") continue;

      if (rowUser === usuario && rowPass === inputHash) {
        return NextResponse.json({
          success: true,
          user: {
            id: row[idIdx] || "",
            nombre: row[nameIdx] || "",
            usuario: rowUser,
            rol: row[rolIdx] || "usuario",
          },
        });
      }
    }

    return NextResponse.json({ error: "Usuario o contrasena incorrectos" }, { status: 401 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error de autenticacion", detail: msg }, { status: 500 });
  }
}

// GET: Check login status (is login enabled?) + list users for admin
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ loginActivo: true, users: [] });
    }

    const sheets = getSheets();
    await ensureAuthSheets(sheets, spreadsheetId);

    if (action === "check") {
      // Just check if login is active
      const configRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Configuracion!A:B",
      });
      const configRows = configRes.data.values || [];
      const loginRow = configRows.find((r) => r[0] === "login_activo");
      const loginActivo = loginRow ? loginRow[1]?.toUpperCase() === "TRUE" : true;
      return NextResponse.json({ loginActivo });
    }

    if (action === "users") {
      // Return user list (without passwords)
      const usersRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Usuarios!A:F",
      });
      const rows = usersRes.data.values || [];
      if (rows.length < 2) return NextResponse.json({ users: [] });

      const headers = rows[0];
      const users = rows.slice(1).map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          if (h !== "Password") obj[h] = row[i] || "";
        });
        return obj;
      });
      return NextResponse.json({ users });
    }

    return NextResponse.json({ error: "Accion no reconocida" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT: Update config or users
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ error: "Sin spreadsheet ID" }, { status: 500 });
    }
    const sheets = getSheets();

    if (body.action === "toggle_login") {
      const newValue = body.loginActivo ? "TRUE" : "FALSE";
      // Find the row with login_activo
      const configRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Configuracion!A:B",
      });
      const configRows = configRes.data.values || [];
      let rowIdx = configRows.findIndex((r) => r[0] === "login_activo");

      if (rowIdx < 0) {
        // Append
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "Configuracion!A:B",
          valueInputOption: "RAW",
          requestBody: { values: [["login_activo", newValue]] },
        });
      } else {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Configuracion!B${rowIdx + 1}`,
          valueInputOption: "RAW",
          requestBody: { values: [[newValue]] },
        });
      }
      return NextResponse.json({ success: true, loginActivo: body.loginActivo });
    }

    if (body.action === "add_user") {
      const { nombre, usuario, contrasena, rol } = body;
      if (!nombre || !usuario || !contrasena) {
        return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
      }

      // Check duplicate username
      const usersRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Usuarios!A:F",
      });
      const rows = usersRes.data.values || [];
      const headers = rows[0] || [];
      const userIdx = headers.indexOf("Usuario");
      const duplicate = rows.slice(1).some((r) => r[userIdx]?.trim().toLowerCase() === usuario.toLowerCase());
      if (duplicate) {
        return NextResponse.json({ error: "El usuario ya existe" }, { status: 400 });
      }

      // Generate next ID
      const lastId = rows.length > 1 ? rows[rows.length - 1][0] : "U000";
      const num = parseInt(lastId?.replace("U", "") || "0") + 1;
      const newId = `U${String(num).padStart(3, "0")}`;

      const passHash = hashPassword(contrasena);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Usuarios!A:F",
        valueInputOption: "RAW",
        requestBody: {
          values: [[newId, nombre, usuario, passHash, rol || "usuario", "TRUE"]],
        },
      });
      return NextResponse.json({ success: true, id: newId });
    }

    if (body.action === "update_user") {
      const { rowIndex, nombre, usuario, contrasena, rol, activo } = body;
      if (rowIndex === undefined) {
        return NextResponse.json({ error: "Falta rowIndex" }, { status: 400 });
      }

      const usersRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Usuarios!A:F",
      });
      const rows = usersRes.data.values || [];
      const currentRow = rows[rowIndex + 1]; // +1 for header
      if (!currentRow) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
      }

      const newRow = [
        currentRow[0], // Keep ID
        nombre ?? currentRow[1],
        usuario ?? currentRow[2],
        contrasena ? hashPassword(contrasena) : currentRow[3], // Only hash if new password
        rol ?? currentRow[4],
        activo !== undefined ? (activo ? "TRUE" : "FALSE") : currentRow[5],
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Usuarios!A${rowIndex + 2}:F${rowIndex + 2}`,
        valueInputOption: "RAW",
        requestBody: { values: [newRow] },
      });
      return NextResponse.json({ success: true });
    }

    if (body.action === "reset_password") {
      const { rowIndex, nuevaContrasena } = body;
      if (rowIndex === undefined || !nuevaContrasena) {
        return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
      }

      const passHash = hashPassword(nuevaContrasena);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Usuarios!D${rowIndex + 2}`,
        valueInputOption: "RAW",
        requestBody: { values: [[passHash]] },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Accion no reconocida" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
