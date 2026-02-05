import { AppShell } from "@/components/app-shell"
import { CobrosContent } from "@/components/cobros-content"

export default function CobrosPage() {
  return (
    <AppShell title="Cobros" subtitle="Registro y seguimiento de cobros">
      <CobrosContent />
    </AppShell>
  )
}
