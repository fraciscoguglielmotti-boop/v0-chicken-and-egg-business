import { AppShell } from "@/components/app-shell"
import { GastosContent } from "@/components/gastos-content"

export default function GastosPage() {
  return (
    <AppShell title="Gastos" subtitle="Control de gastos en efectivo y tarjeta de credito">
      <GastosContent />
    </AppShell>
  )
}
