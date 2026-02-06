import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Centralized date formatting to prevent timezone issues
export function formatDate(date: Date | string): string {
  if (!date) return "-"
  try {
    const d = new Date(date)
    // Add timezone offset to prevent date shifting on mobile
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset())
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
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
