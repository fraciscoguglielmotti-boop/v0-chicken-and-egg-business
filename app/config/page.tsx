import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { ConfigContent } from "@/components/config-content"

export default function ConfigPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="lg:pl-64">
        <AppHeader
          title="Configuracion"
          subtitle="Ajustes generales del sistema"
        />
        <main className="p-6">
          <ConfigContent />
        </main>
      </div>
    </div>
  )
}
