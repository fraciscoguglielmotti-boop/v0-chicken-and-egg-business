import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { CuentasContent } from "@/components/cuentas-content"

export default function CuentasPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="lg:pl-64">
        <AppHeader
          title="Cuentas Corrientes"
          subtitle="Saldos y movimientos de clientes y proveedores"
        />
        <main className="p-6">
          <CuentasContent />
        </main>
      </div>
    </div>
  )
}
