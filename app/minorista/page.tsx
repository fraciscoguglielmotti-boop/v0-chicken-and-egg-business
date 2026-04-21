import { AppShell } from "@/components/app-shell"
import { MinoristaContent } from "@/components/minorista-content"

export default function MinoristaPage() {
  return (
    <AppShell title="Minorista" subtitle="Venta retail y reparto a domicilio">
      <MinoristaContent />
    </AppShell>
  )
}
