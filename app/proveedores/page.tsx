import { AppShell } from "@/components/app-shell"
import { ProveedoresContent } from "@/components/proveedores-content"

export default function ProveedoresPage() {
  return (
    <AppShell title="Proveedores" subtitle="Gestion de proveedores">
      <ProveedoresContent />
    </AppShell>
  )
}
