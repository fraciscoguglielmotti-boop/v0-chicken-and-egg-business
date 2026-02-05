import { AppShell } from "@/components/app-shell"
import { ComprasContent } from "@/components/compras-content"

export default function ComprasPage() {
  return (
    <AppShell title="Compras" subtitle="Registro de compras a proveedores">
      <ComprasContent />
    </AppShell>
  )
}
