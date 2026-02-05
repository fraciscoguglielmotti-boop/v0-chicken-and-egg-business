import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { SheetsContent } from "@/components/sheets-content"

export default function SheetsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="lg:pl-64">
        <AppHeader
          title="Google Sheets"
          subtitle="Configuracion y sincronizacion"
        />
        <main className="p-6">
          <SheetsContent />
        </main>
      </div>
    </div>
  )
}
