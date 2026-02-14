import { AppShell } from "@/components/app-shell"
import { VehiculosContent } from "@/components/vehiculos-content"

export const metadata = {
  title: "Vehiculos | AviGest",
  description: "Historial de mantenimiento y gestion de flota vehicular",
}

export default function VehiculosPage() {
  return (
    <AppShell title="Vehiculos" subtitle="Gestion de flota y mantenimiento">
      <VehiculosContent />
    </AppShell>
  )
}
