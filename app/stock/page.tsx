import { AppShell } from "@/components/app-shell"
import { StockContent } from "@/components/stock-content"

export default function StockPage() {
  return (
    <AppShell title="Inventario" subtitle="Seguimiento de stock en tiempo real">
      <StockContent />
    </AppShell>
  )
}
