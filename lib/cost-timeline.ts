// Lógica unificada de costo de mercadería vendida (CMV).
// Regla única: cada venta usa el último precio de compra registrado
// en o antes de la fecha de esa venta. Sin promedios, sin FIFO de inventario.

export type CostTimeline = Record<string, { fecha: string; unitCost: number }[]>

export function normProdName(s?: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "")
}

export function buildCostTimeline(
  compras: { fecha: string; producto?: string; cantidad?: number; precio_unitario?: number; total?: number }[]
): CostTimeline {
  const timeline: CostTimeline = {}
  const sorted = [...compras].sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""))
  for (const c of sorted) {
    const qty = c.cantidad ?? 0
    if (qty <= 0 || !c.fecha) continue
    const prod = normProdName(c.producto)
    if (!prod) continue
    const uc = (c.total ?? 0) > 0 ? (c.total! / qty) : (c.precio_unitario ?? 0)
    if (uc <= 0) continue
    if (!timeline[prod]) timeline[prod] = []
    timeline[prod].push({ fecha: c.fecha.slice(0, 10), unitCost: uc })
  }
  return timeline
}

export function getCostAtDate(productoNombre: string, fecha: string, timeline: CostTimeline): number {
  const key = normProdName(productoNombre)
  if (!key) return 0
  let entries = timeline[key]
  if (!entries) {
    for (const [k, v] of Object.entries(timeline)) {
      if (k.includes(key) || key.includes(k)) { entries = v; break }
    }
  }
  if (!entries || entries.length === 0) return 0
  const day = fecha.slice(0, 10)
  let lastCost = 0
  for (const e of entries) {
    if (e.fecha <= day) lastCost = e.unitCost
    else break
  }
  return lastCost || entries[0].unitCost
}
