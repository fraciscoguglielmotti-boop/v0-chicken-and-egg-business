import { AppShell } from "@/components/app-shell"
import { SheetsContent } from "@/components/sheets-content"

export default function SheetsPage() {
  return (
    <AppShell title="Google Sheets" subtitle="Configuracion y sincronizacion">
      <SheetsContent />
    </AppShell>
  )
}
