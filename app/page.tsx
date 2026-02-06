import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { DashboardContent } from "@/components/dashboard-content"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="lg:pl-64">
        <AppHeader
          title="Dashboard"
          subtitle="Resumen general del negocio"
        />
        <main className="p-6">
          <DashboardContent />
        </main>
      </div>
    </div>
  )
}
