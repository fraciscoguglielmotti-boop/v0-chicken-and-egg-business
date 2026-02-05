import { AppShell } from "@/components/app-shell"
import { PagosContent } from "@/components/pagos-content"

export default function PagosPage() {
  return (
    <AppShell title="Pagos" subtitle="Registro de pagos a proveedores">
      <PagosContent />
    </AppShell>
  )
}
