import { AppShell } from "@/components/app-shell"
import { VentasContent } from "@/components/ventas-content"

export default function VentasPage() {
  return (
    <AppShell title="Ventas" subtitle="Gestion de ventas y facturacion">
      <VentasContent />
    </AppShell>
  )
}
