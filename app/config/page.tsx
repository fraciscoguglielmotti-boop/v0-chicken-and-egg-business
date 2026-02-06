import { AppShell } from "@/components/app-shell"
import { ConfigContent } from "@/components/config-content"

export default function ConfigPage() {
  return (
    <AppShell title="Configuracion" subtitle="Ajustes generales del sistema">
      <ConfigContent />
    </AppShell>
  )
}
