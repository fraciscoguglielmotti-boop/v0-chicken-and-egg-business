import { AppShell } from "@/components/app-shell"
import { RentabilidadContent } from "@/components/rentabilidad-content"

export default function RentabilidadPage() {
  return (
    <AppShell title="Rentabilidad" subtitle="Analisis de ganancias por producto, cliente y periodo">
      <RentabilidadContent />
    </AppShell>
  )
}
