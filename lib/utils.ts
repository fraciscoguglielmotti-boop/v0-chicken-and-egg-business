import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a date that could be in various formats:
 * - "dd/MM/yyyy" (from Google Sheets es-AR locale)
 * - ISO string "2025-01-15"
 * - Date object
 * Returns a Date object with correct date regardless of timezone.
 */
export function parseDate(date: Date | string): Date {
  if (!date) return new Date()
  if (date instanceof Date) return date
  const str = String(date).trim()
  
  // Handle dd/MM/yyyy format from Sheets
  const ddmmyyyy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy
    // Use UTC to avoid timezone shifts
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0))
  }
  
  // Handle yyyy-MM-dd (ISO)
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const [, year, month, day] = iso
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0))
  }
  
  // Fallback
  const d = new Date(str)
  return Number.isNaN(d.getTime()) ? new Date() : d
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
export function formatDateInput(date: Date | string): string {
  try {
    const d = new Date(date)
    return d.toISOString().split("T")[0]
  } catch {
    return new Date().toISOString().split("T")[0]
  }
}

// Date for Sheets (dd/MM/yyyy)
export function formatDateForSheets(date: Date | string): string {
  try {
    const d = new Date(date)
    return d.toLocaleDateString("es-AR")
  } catch {
    return new Date().toLocaleDateString("es-AR")
  }
}

/**
 * Resolve the total amount and unit price from a Ventas/Compras sheet row.
 * Handles all column name variants and derives missing values.
 * This is the SINGLE SOURCE OF TRUTH for calculating sale amounts from sheet rows.
 *
 * Strategy: First try known column names, then scan ALL keys for price/total patterns.
 */
export function resolveVentaMonto(row: { [key: string]: string }): {
  cantidad: number
  precioUnitario: number
  total: number
} {
  const cantidad = Number(row.Cantidad) || 0

  // 1. Try known canonical keys
  let precio =
    Number(row.PrecioUnitario) ||
    Number(row.Precio) ||
    0

  // 2. Try known non-canonical variants (pre-canonicalization names)
  if (precio === 0) {
    precio =
      Number(row["Precio Unitario"]) ||
      Number(row["P. Unit."]) ||
      Number(row["PU"]) ||
      Number(row["Precio x Kg"]) ||
      Number(row["PrecioXKg"]) ||
      0
  }

  // 3. Scan ALL keys for any price-like column we might have missed
  if (precio === 0) {
    const priceKeys = Object.keys(row).filter(k => {
      const lk = k.toLowerCase()
      return (lk.includes("precio") || lk.includes("price") || lk.includes("p.u") || lk.includes("punit")) &&
        !lk.includes("total")
    })
    for (const pk of priceKeys) {
      const v = Number(row[pk])
      if (v > 0) { precio = v; break }
    }
  }

  // 4. Get total - try canonical then scan
  let totalDirecto = Number(row.Total) || 0
  if (totalDirecto === 0) {
    const totalKeys = Object.keys(row).filter(k => {
      const lk = k.toLowerCase()
      return lk.includes("total") || lk === "monto" || lk === "importe" || lk === "subtotal"
    })
    for (const tk of totalKeys) {
      const v = Number(row[tk])
      if (v > 0) { totalDirecto = v; break }
    }
  }

  // 5. Determine total: prefer direct total, otherwise calculate
  const total = totalDirecto > 0 ? totalDirecto : cantidad * precio
  // 6. Derive unit price if missing but total exists
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
