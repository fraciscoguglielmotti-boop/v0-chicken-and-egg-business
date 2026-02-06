"use client"

import { AppShell } from "@/components/app-shell"
import { VendedoresContent } from "@/components/vendedores-content"

export default function VendedoresPage() {
  return (
    <AppShell title="Vendedores y Comisiones">
      <VendedoresContent />
    </AppShell>
  )
}
