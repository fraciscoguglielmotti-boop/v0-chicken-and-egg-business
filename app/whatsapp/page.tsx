import { AppShell } from "@/components/app-shell"
import { WhatsappInboxContent } from "@/components/whatsapp-inbox-content"

export default function WhatsappPage() {
  return (
    <AppShell title="WhatsApp Minorista" subtitle="Conversaciones de venta retail">
      <WhatsappInboxContent />
    </AppShell>
  )
}
