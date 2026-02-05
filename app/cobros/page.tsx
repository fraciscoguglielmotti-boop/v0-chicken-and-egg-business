import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { CobrosContent } from "@/components/cobros-content"

export default function CobrosPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="lg:pl-64">
        <AppHeader
          title="Cobros"
          subtitle="Registro y seguimiento de cobros"
        />
        <main className="p-6">
          <CobrosContent />
        </main>
      </div>
    </div>
  )
}
