import { AppShell } from "@/components/app-shell"
import { FacturasContent } from "@/components/facturas-content"

export default function FacturasPage() {
  return (
    <AppShell title="Preparación de Facturas" subtitle="Generación de listado de facturas por transferencias a Agroaves">
      <FacturasContent />
    </AppShell>
  )
}
