"use client"

import { AppShell } from "@/components/app-shell"
import { ContabilidadContent } from "@/components/contabilidad-content"

export default function ContabilidadPage() {
  return (
    <AppShell title="Contabilidad">
      <ContabilidadContent />
    </AppShell>
  )
}
