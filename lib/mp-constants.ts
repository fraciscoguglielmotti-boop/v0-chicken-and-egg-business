// Categorías de egreso de MP que indican un pago a proveedor/compra —
// deben excluirse de los gastos operativos.
export const MP_CATEGORIAS_NO_GASTO: readonly string[] = [
  "compra / proveedor",
  "compra",
  "pago a proveedor",
  "compra mercadería",
]

// Label ofrecido en el selector de egresos para marcar "no es gasto operativo"
export const MP_EGRESO_NO_GASTO_LABEL = "Compra / Proveedor"

// Categoría especial para ingresos de MP que NO son cobros de clientes.
export const MP_CATEGORIA_NO_COBRO = "No es cobro"

export function esMPGasto(m: {
  tipo?: string
  descripcion?: string
  categoria?: string
}): boolean {
  const tipo = (m.tipo ?? "").toLowerCase()
  const desc = (m.descripcion ?? "").toLowerCase()
  const cat = (m.categoria ?? "").toLowerCase().trim()
  if (tipo !== "egreso") return false
  if (desc.startsWith("retiro")) return false
  if (desc.includes("transferencia bancaria")) return false
  if (MP_CATEGORIAS_NO_GASTO.includes(cat)) return false
  return true
}
