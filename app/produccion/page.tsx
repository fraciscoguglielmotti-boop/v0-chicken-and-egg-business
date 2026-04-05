import { AppShell } from "@/components/app-shell"
import { ProduccionContent } from "@/components/produccion-content"

export default function ProduccionPage() {
  return (
    <AppShell title="Producción" subtitle="Troceo, rendimiento y simulador de precios">
      <ProduccionContent />
    </AppShell>
  )
}
