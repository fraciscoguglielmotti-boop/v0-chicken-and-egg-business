import { AppShell } from "@/components/app-shell"
import { PresupuestosContent } from "@/components/presupuestos-content"

export const metadata = {
  title: "Presupuestos Mensuales | AviGest",
  description: "Control de presupuestos y limites de gasto por categoria",
}

export default function PresupuestosPage() {
  return (
    <AppShell title="Presupuestos" subtitle="Control de presupuestos mensuales por categoria">
      <PresupuestosContent />
    </AppShell>
  )
}
