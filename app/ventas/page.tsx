import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { VentasContent } from "@/components/ventas-content"

export default function VentasPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="lg:pl-64">
        <AppHeader
          title="Ventas"
          subtitle="Gestion de ventas y facturacion"
        />
        <main className="p-6">
          <VentasContent />
        </main>
      </div>
    </div>
  )
}
