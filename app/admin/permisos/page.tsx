import { AppShell } from "@/components/app-shell"
import { PermisosContent } from "@/components/admin/permisos-content"

export default function PermisosPage() {
  return (
    <AppShell title="Permisos de Usuarios" subtitle="Configurá a qué secciones puede acceder cada usuario">
      <PermisosContent />
    </AppShell>
  )
}
