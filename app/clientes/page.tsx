import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { ClientesContent } from "@/components/clientes-content"

export default function ClientesPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="lg:pl-64">
        <AppHeader
          title="Clientes"
          subtitle="Gestion de clientes y cuentas corrientes"
        />
        <main className="p-6">
          <ClientesContent />
        </main>
      </div>
    </div>
  )
}
