import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { ComprasContent } from "@/components/compras-content"

export default function ComprasPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="lg:pl-64">
        <AppHeader
          title="Compras"
          subtitle="Registro de compras a proveedores"
        />
        <main className="p-6">
          <ComprasContent />
        </main>
      </div>
    </div>
  )
}
