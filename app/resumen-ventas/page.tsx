import { AppShell } from "@/components/app-shell"
import { ResumenVentasContent } from "@/components/resumen-ventas-content"

export default function ResumenVentasPage() {
  return (
    <AppShell title="Resumen de Ventas" subtitle="Ventas agrupadas por día">
      <ResumenVentasContent />
    </AppShell>
  )
}
