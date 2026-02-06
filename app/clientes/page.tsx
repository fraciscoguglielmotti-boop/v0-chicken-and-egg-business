import { AppShell } from "@/components/app-shell"
import { ClientesContent } from "@/components/clientes-content"

export default function ClientesPage() {
  return (
    <AppShell title="Clientes" subtitle="Gestion de clientes y cuentas corrientes">
      <ClientesContent />
    </AppShell>
  )
}
