import { google } from "googleapis";

function getCredentials() {
  const b64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (b64) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      if (parsed.client_email && parsed.private_key) {
        return { client_email: parsed.client_email, private_key: parsed.private_key };
      }
    } catch { /* ignore */ }
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (email && key) {
    return { client_email: email, private_key: key.replace(/\\n/g, "\n") };
  }
  return null;
}

async function main() {
  const creds = getCredentials();
  if (!creds) {
    console.error("No se encontraron credenciales de Google.");
    process.exit(1);
  }

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.error("Falta GOOGLE_SPREADSHEET_ID.");
    process.exit(1);
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Check existing sheets
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];

  // Create "Usuarios" sheet if it doesn't exist
  if (!existingSheets.includes("Usuarios")) {
    console.log('Creating "Usuarios" sheet...');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Usuarios" } } }],
      },
    });

    // Add headers and default admin user
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Usuarios!A1:F2",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          ["ID", "Nombre", "Usuario", "Contrasena", "Rol", "Activo"],
          ["U001", "Administrador", "admin", "admin", "admin", "TRUE"],
        ],
      },
    });
    console.log('Sheet "Usuarios" created with default admin user (admin/admin).');
  } else {
    console.log('Sheet "Usuarios" already exists, skipping.');
  }

  // Create "Configuracion" sheet if it doesn't exist
  if (!existingSheets.includes("Configuracion")) {
    console.log('Creating "Configuracion" sheet...');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Configuracion" } } }],
      },
    });

    // Add headers and default config
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Configuracion!A1:B2",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          ["Clave", "Valor"],
          ["login_activo", "TRUE"],
        ],
      },
    });
    console.log('Sheet "Configuracion" created with login_activo = TRUE.');
  } else {
    console.log('Sheet "Configuracion" already exists, skipping.');
  }

  console.log("\nSetup complete!");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
