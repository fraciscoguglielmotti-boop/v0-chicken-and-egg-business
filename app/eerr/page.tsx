"use client"

import { AppShell } from "@/components/app-shell"
import { ContabilidadContent } from "@/components/contabilidad-content"
import { RentabilidadContent } from "@/components/rentabilidad-content"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function EERRPage() {
  return (
    <AppShell title="EERR" subtitle="Estado de Resultados y rentabilidad por producto">
      <Tabs defaultValue="eerr">
        <TabsList className="mb-4">
          <TabsTrigger value="eerr">Estado de Resultados</TabsTrigger>
          <TabsTrigger value="rentabilidad">Rentabilidad por Producto</TabsTrigger>
        </TabsList>
        <TabsContent value="eerr">
          <ContabilidadContent />
        </TabsContent>
        <TabsContent value="rentabilidad">
          <RentabilidadContent />
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}
