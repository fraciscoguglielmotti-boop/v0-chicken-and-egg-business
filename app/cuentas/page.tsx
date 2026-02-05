import { AppShell } from "@/components/app-shell"
import { CuentasContent } from "@/components/cuentas-content"

export default function CuentasPage() {
  return (
    <AppShell title="Cuentas Corrientes" subtitle="Saldos y movimientos de clientes y proveedores">
      <CuentasContent />
    </AppShell>
  )
}
