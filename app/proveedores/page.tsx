import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { ProveedoresContent } from "@/components/proveedores-content"

export default function ProveedoresPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="lg:pl-64">
        <AppHeader
          title="Proveedores"
          subtitle="Gestion de proveedores"
        />
        <main className="p-6">
          <ProveedoresContent />
        </main>
      </div>
    </div>
  )
}
