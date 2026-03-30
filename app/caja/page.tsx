import { AppShell } from "@/components/app-shell"
import { CajaContent } from "@/components/caja-content"

export default function CajaPage() {
  return (
    <AppShell title="Caja" subtitle="Saldos por bolsillo y deuda de tarjetas">
      <CajaContent />
    </AppShell>
  )
}
