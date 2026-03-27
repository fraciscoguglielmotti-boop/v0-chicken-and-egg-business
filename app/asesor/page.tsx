import { AppShell } from "@/components/app-shell"
import { AsesorContent } from "@/components/asesor-content"

export default function AsesorPage() {
  return (
    <AppShell title="Asesor" subtitle="Temas y objetivos para reuniones con Federico">
      <AsesorContent />
    </AppShell>
  )
}
