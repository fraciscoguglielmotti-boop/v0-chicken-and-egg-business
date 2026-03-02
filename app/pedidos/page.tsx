import { AppShell } from "@/components/app-shell"
import { PedidosContent } from "@/components/pedidos-content"

export default function PedidosPage() {
  return (
    <AppShell title="Toma de Pedidos" subtitle="Anotá los pedidos del día y generá el PDF al finalizar">
      <PedidosContent />
    </AppShell>
  )
}
