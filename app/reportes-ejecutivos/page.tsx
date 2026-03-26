import { AppShell } from "@/components/app-shell"
import { ReportesEjecutivosContent } from "@/components/reportes-ejecutivos-content"

export default function ReportesEjecutivosPage() {
  return (
    <AppShell title="Reportes Ejecutivos" subtitle="Resúmenes automáticos con datos reales">
      <ReportesEjecutivosContent />
    </AppShell>
  )
}
