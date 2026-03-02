import { AppShell } from "@/components/app-shell"
import { MercadoPagoContent } from "@/components/mercadopago-content"

export default function MercadoPagoPage() {
  return (
    <AppShell
      title="MercadoPago"
      subtitle="Movimientos de la cuenta y verificación de comprobantes"
    >
      <MercadoPagoContent />
    </AppShell>
  )
}
