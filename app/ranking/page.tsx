import { AppShell } from "@/components/app-shell"
import { RankingClientesContent } from "@/components/ranking-clientes-content"

export default function RankingPage() {
  return (
    <AppShell
      title="Ranking de Clientes"
      subtitle="Análisis de desempeño y comportamiento de clientes"
    >
      <RankingClientesContent />
    </AppShell>
  )
}
