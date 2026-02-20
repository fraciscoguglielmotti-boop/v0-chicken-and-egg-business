/**
 * Script de migracion de datos de Google Sheets a Supabase
 * 
 * Uso: node --loader tsx scripts/migrate-data-from-sheets.ts
 * 
 * Este script lee todos los datos de Google Sheets y los migra a Supabase.
 * IMPORTANTE: Ejecutar UNA SOLA VEZ después de crear las tablas en Supabase.
 */

import { createClient } from "@supabase/supabase-js"
import { google } from "googleapis"

// Configuración
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY! // Necesitas el service role key
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Helper para obtener Google Sheets client
function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}")
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
  return google.sheets({ version: "v4", auth })
}

// Helper para parsear fechas de Sheets (formato dd/mm/yyyy)
function parseSheetDate(dateStr: string): string | null {
  if (!dateStr) return null
  const [day, month, year] = dateStr.split("/")
  if (!day || !month || !year) return null
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

async function migrateClientes() {
  console.log("Migrando Clientes...")
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Clientes!A:G",
  })
  const rows = res.data.values || []
  if (rows.length === 0) return

  const [headers, ...data] = rows
  for (const row of data) {
    await supabase.from("clientes").insert({
      nombre: row[1] || "",
      cuit: row[2] || null,
      telefono: row[3] || null,
      direccion: row[4] || null,
      saldo_inicial: parseFloat(row[5] || "0"),
      fecha_alta: parseSheetDate(row[6]) || new Date().toISOString(),
    })
  }
  console.log(`✓ ${data.length} clientes migrados`)
}

async function migrateProveedores() {
  console.log("Migrando Proveedores...")
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Proveedores!A:B",
  })
  const rows = res.data.values || []
  if (rows.length === 0) return

  const [headers, ...data] = rows
  for (const row of data) {
    if (!row[1]) continue
    await supabase.from("proveedores").insert({
      nombre: row[1],
    })
  }
  console.log(`✓ ${data.length} proveedores migrados`)
}

async function migrateVendedores() {
  console.log("Migrando Vendedores...")
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Vendedores!A:D",
  })
  const rows = res.data.values || []
  if (rows.length === 0) return

  const [headers, ...data] = rows
  for (const row of data) {
    if (!row[1]) continue
    await supabase.from("vendedores").insert({
      nombre: row[1],
      comision: parseFloat(row[2] || "0"),
      fecha_alta: parseSheetDate(row[3]) || new Date().toISOString(),
    })
  }
  console.log(`✓ ${data.length} vendedores migrados`)
}

async function migrateVentas() {
  console.log("Migrando Ventas...")
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Ventas!A:H",
  })
  const rows = res.data.values || []
  if (rows.length === 0) return

  const [headers, ...data] = rows
  for (const row of data) {
    // Buscar cliente_id por nombre
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("nombre", row[2])
      .single()

    await supabase.from("ventas").insert({
      fecha: parseSheetDate(row[1]) || new Date().toISOString().split("T")[0],
      cliente_id: cliente?.id || null,
      cliente_nombre: row[2] || "",
      productos: { items: row[4] || "" }, // Convertir a JSONB
      cantidad: parseFloat(row[5] || "0"),
      precio_unitario: parseFloat(row[6] || "0"),
      vendedor: row[7] || null,
    })
  }
  console.log(`✓ ${data.length} ventas migradas`)
}

async function migrateCobros() {
  console.log("Migrando Cobros...")
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Cobros!A:H",
  })
  const rows = res.data.values || []
  if (rows.length === 0) return

  const [headers, ...data] = rows
  for (const row of data) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("nombre", row[2])
      .single()

    await supabase.from("cobros").insert({
      fecha: parseSheetDate(row[1]) || new Date().toISOString().split("T")[0],
      cliente_id: cliente?.id || null,
      cliente_nombre: row[2] || "",
      monto: parseFloat(row[4] || "0"),
      metodo_pago: row[5] || null,
      observaciones: row[6] || null,
      verificado_agroaves: row[7]?.toUpperCase() === "TRUE",
    })
  }
  console.log(`✓ ${data.length} cobros migrados`)
}

// Ejecutar migración
async function main() {
  console.log("🚀 Iniciando migración de Google Sheets a Supabase...\n")

  try {
    await migrateClientes()
    await migrateProveedores()
    await migrateVendedores()
    await migrateVentas()
    await migrateCobros()
    // TODO: Agregar resto de tablas (pagos, compras, gastos, vehiculos, etc)

    console.log("\n✅ Migración completada exitosamente!")
  } catch (error) {
    console.error("\n❌ Error durante la migración:", error)
    process.exit(1)
  }
}

main()
