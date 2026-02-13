import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Google Sheets epoch: December 30, 1899 (serial day 0).
 * Serial number 1 = 1900-01-01. Sheets incorrectly treats 1900 as a leap year
 * (Lotus 1-2-3 bug), so serial 60 = Feb 29 1900 (fake). For dates >= 61, we
 * subtract 1 to correct. Modern dates (2020+) are ~43831+.
 */
const SHEETS_EPOCH = Date.UTC(1899, 11, 30, 12, 0, 0) // 1899-12-30 12:00 UTC
const MS_PER_DAY = 86400000

function fromSheetSerial(serial: number): Date {
  // Correct for the Lotus 1-2-3 leap year bug
  const corrected = serial > 60 ? serial - 1 : serial
  return new Date(SHEETS_EPOCH + corrected * MS_PER_DAY)
}

function isValidDateRange(d: Date): boolean {
  const y = d.getUTCFullYear()
  return y >= 1990 && y <= 2100
}

/**
 * Parse a date that could be in various formats:
 * - Number (Google Sheets serial date via UNFORMATTED_VALUE, e.g. 46067 = 10/02/2026)
 * - "dd/MM/yyyy" (from Google Sheets es-AR locale)
 * - "dd/MM/yy" (short year)
 * - ISO string "2025-01-15"
 * - Date object
 * Returns a Date object with correct date regardless of timezone.
 */
export function parseDate(date: Date | string | number): Date {
  if (!date && date !== 0) return new Date()
  if (date instanceof Date) return date

  // Handle numeric serial dates from Google Sheets (UNFORMATTED_VALUE)
  // Sheets serial dates for modern dates are typically 40000-60000
  const num = typeof date === "number" ? date : Number(date)
  if (!Number.isNaN(num) && num > 30000 && num < 80000) {
    const d = fromSheetSerial(num)
    if (isValidDateRange(d)) return d
  }

  const str = String(date).trim()

  // Handle dd/MM/yyyy or dd/MM/yy format from Sheets
  const ddmmyyyy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (ddmmyyyy) {
    const [, day, month, rawYear] = ddmmyyyy
    let year = Number(rawYear)
    if (year < 100) year += 2000 // "26" -> 2026
    const d = new Date(Date.UTC(year, Number(month) - 1, Number(day), 12, 0, 0))
    if (isValidDateRange(d)) return d
  }
  
  // Handle yyyy-MM-dd (ISO)
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const [, year, month, day] = iso
    const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0))
    if (isValidDateRange(d)) return d
  }
  
  // Fallback
  const d = new Date(str)
  if (!Number.isNaN(d.getTime()) && isValidDateRange(d)) return d
  return new Date()
}

// Centralized date formatting - handles all date input formats correctly
export function formatDate(date: Date | string): string {
  if (!date) return "-"
  try {
    const d = parseDate(date)
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(d)
  } catch {
    return String(date)
  }
}

// Centralized currency formatting
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

// Date for input fields (yyyy-MM-dd)
export function formatDateInput(date: Date | string | number): string {
  try {
    const d = parseDate(date)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  } catch {
    return new Date().toISOString().split("T")[0]
  }
}

// Date for Sheets (dd/MM/yyyy) - always outputs Argentine format
export function formatDateForSheets(date: Date | string | number): string {
  try {
    const d = parseDate(date)
    const day = String(d.getUTCDate()).padStart(2, "0")
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const y = d.getUTCFullYear()
    return `${day}/${m}/${y}`
  } catch {
    const now = new Date()
    return `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`
  }
}

/**
 * Parse a number from a Google Sheets cell that may have currency formatting.
 * Handles: "$68,500", "$70.000", "68500", "68,500.50", "$1.234,56", etc.
 *
 * Google Sheets currency format (es-AR): $70.000 or $70,000 depending on locale
 */
export function parseSheetNumber(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === "") return 0
  if (typeof val === "number") return val

  let str = String(val).trim()

  // Remove currency symbols and spaces
  str = str.replace(/[$\s]/g, "")

  // Detect format: if string has both . and , we need to figure out which is thousands/decimal
  const hasComma = str.includes(",")
  const hasDot = str.includes(".")

  if (hasComma && hasDot) {
    // Both present: determine which is last (that's the decimal separator)
    const lastComma = str.lastIndexOf(",")
    const lastDot = str.lastIndexOf(".")
    if (lastComma > lastDot) {
      // Format: 1.234,56 (European/AR) -> remove dots, replace comma with dot
      str = str.replace(/\./g, "").replace(",", ".")
    } else {
      // Format: 1,234.56 (US) -> remove commas
      str = str.replace(/,/g, "")
    }
  } else if (hasComma) {
    // Only commas: could be "1,234" (thousands) or "1,5" (decimal)
    // If there are multiple commas or the part after comma has 3 digits, it's thousands
    const parts = str.split(",")
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      // Thousands separator: 1,234 or 1,234,567
      str = str.replace(/,/g, "")
    } else {
      // Decimal separator: 1,5
      str = str.replace(",", ".")
    }
  } else if (hasDot) {
    // Only dots: could be "1.234" (thousands in AR) or "1.5" (decimal)
    const parts = str.split(".")
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      // Thousands separator: 1.234 or 1.234.567
      str = str.replace(/\./g, "")
    }
    // Otherwise it's a decimal: 1.5 -> leave as is
  }

  const num = Number(str)
  return Number.isNaN(num) ? 0 : num
}

/**
 * Resolve the total amount and unit price from a Ventas/Compras sheet row.
 * Handles all column name variants, currency-formatted values, and derives missing values.
 * This is the SINGLE SOURCE OF TRUTH for calculating sale amounts from sheet rows.
 */
export function resolveVentaMonto(row: { [key: string]: string }): {
  cantidad: number
  precioUnitario: number
  total: number
} {
  const cantidad = parseSheetNumber(row.Cantidad)

  // Try known canonical keys for price (all parsed with currency-aware parser)
  let precio =
    parseSheetNumber(row.PrecioUnitario) ||
    parseSheetNumber(row.Precio) ||
    0

  // Scan ALL keys for any price-like column we might have missed
  if (precio === 0) {
    const priceKeys = Object.keys(row).filter(k => {
      const lk = k.toLowerCase()
      return (lk.includes("precio") || lk.includes("price") || lk.includes("p.u") || lk.includes("punit")) &&
        !lk.includes("total")
    })
    for (const pk of priceKeys) {
      const v = parseSheetNumber(row[pk])
      if (v > 0) { precio = v; break }
    }
  }

  // Get total - try canonical then scan
  let totalDirecto = parseSheetNumber(row.Total)
  if (totalDirecto === 0) {
    const totalKeys = Object.keys(row).filter(k => {
      const lk = k.toLowerCase()
      return lk.includes("total") || lk === "monto" || lk === "importe" || lk === "subtotal"
    })
    for (const tk of totalKeys) {
      const v = parseSheetNumber(row[tk])
      if (v > 0) { totalDirecto = v; break }
    }
  }

  // Determine total: prefer direct total, otherwise calculate
  const total = totalDirecto > 0 ? totalDirecto : cantidad * precio
  // Derive unit price if missing but total exists
  const precioUnitario = precio > 0 ? precio : (cantidad > 0 ? total / cantidad : 0)

  return { cantidad, precioUnitario, total }
}

// Helper to check if a string looks like a numeric ID (not a name)
function looksLikeId(val: string): boolean {
  if (!val || val === "-") return true
  return /^\d+$/.test(val.trim())
}

/**
 * Resolve entity name from sheet row fields + lookup table.
 * Handles cases where data was manually entered with IDs in name columns or vice versa.
 * 
 * @param nameField - Value from the "Cliente" or "Proveedor" column  
 * @param idField - Value from the "ClienteID" or "ProveedorID" column
 * @param lookupRows - Rows from the Clientes/Proveedores sheet (with ID and Nombre keys)
 * @returns The resolved human-readable name
 */
export function resolveEntityName(
  nameField: string,
  idField: string,
  lookupRows: Array<{ [key: string]: string }>
): string {
  const name = (nameField || "").trim()
  const id = (idField || "").trim()

  // 1. If nameField is a real name (non-numeric, non-empty), use it
  if (name && !looksLikeId(name)) {
    return name
  }

  // 2. If idField is a real name (non-numeric), use it (columns were swapped)
  if (id && !looksLikeId(id)) {
    return id
  }

  // 3. Both are numeric or one is empty - look up in the entity table
  const lookupId = id || name // prefer idField for lookup
  if (lookupId && lookupRows.length > 0) {
    const found = lookupRows.find(
      (r) => (r.ID || "").trim() === lookupId || (r.Nombre || "").toLowerCase().trim() === lookupId.toLowerCase().trim()
    )
    if (found?.Nombre) return found.Nombre
  }

  // 4. Fallback: return whatever non-empty value we have
  return name || id || ""
}
