import { AppShell } from "@/components/app-shell"
import { KpisContent } from "@/components/kpis-content"

export default function KpisPage() {
  return (
    <AppShell title="KPIs Ejecutivos" subtitle="Métricas clave de desempeño del negocio">
      <KpisContent />
    </AppShell>
  )
}
