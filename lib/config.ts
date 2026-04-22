/**
 * Configuración del negocio — valores que cambian entre instalaciones.
 * Muchos de estos están hardcodeados en el código; centralizarlos acá
 * permite cambiarlos sin buscar en múltiples archivos.
 *
 * Los valores con NEXT_PUBLIC_ se leen en cliente Y servidor.
 * Los sin prefijo solo están disponibles en servidor (API routes, etc).
 */

/** Nombre del proveedor Agroaves tal como aparece en la tabla proveedores.
 *  Se usa en cobros para detectar transferencias directas y crear el pago automático. */
export const PROVEEDOR_AGROAVES =
  process.env.NEXT_PUBLIC_PROVEEDOR_AGROAVES ?? "Agroaves"

/** Cuentas destino disponibles en el formulario de cobros. */
export const CUENTAS_DESTINO_COBROS =
  (process.env.NEXT_PUBLIC_CUENTAS_DESTINO ?? "Agroaves,Francisco,Diego").split(",")

/** Receptores de efectivo disponibles en el formulario de cobros. */
export const RECEPTORES_EFECTIVO =
  (process.env.NEXT_PUBLIC_RECEPTORES_EFECTIVO ?? "Damián,Francisco,Diego").split(",")

/** Email al que se envían los reportes automáticos. */
export const REPORTES_EMAIL =
  process.env.REPORTES_EMAIL ?? ""

/** Nombre de la empresa (aparece en PDFs y reportes). */
export const EMPRESA_NOMBRE =
  process.env.NEXT_PUBLIC_EMPRESA_NOMBRE ?? "AviGest Distribuidora"
