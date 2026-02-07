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
