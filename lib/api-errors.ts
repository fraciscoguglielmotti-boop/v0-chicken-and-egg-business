/**
 * Helpers para devolver errores en rutas API sin filtrar detalles internos
 * (mensajes de Postgres, stack traces, etc.) hacia clientes anónimos.
 *
 * Reglas:
 *  - En `process.env.NODE_ENV !== "production"` se devuelve el mensaje real
 *    para facilitar debug.
 *  - En producción se devuelve el mensaje genérico provisto, y el error
 *    original se loguea via `console.error`.
 */

export function sanitizeError(err: unknown, fallback = "Error interno"): string {
  if (process.env.NODE_ENV !== "production") {
    if (err instanceof Error && err.message) return err.message
    if (typeof err === "string") return err
  }
  return fallback
}

export function logAndSanitize(
  tag: string,
  err: unknown,
  fallback = "Error interno"
): string {
  console.error(`[${tag}]`, err)
  return sanitizeError(err, fallback)
}
