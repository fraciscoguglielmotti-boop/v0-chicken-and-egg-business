"use client"

import { useRef, useCallback } from "react"
import { Printer, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Movimiento {
  fecha: string
  tipo: "venta" | "cobro"
  descripcion: string
  debe: number
  haber: number
  saldoAcumulado: number
}

interface ClientStatementProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clienteNombre: string
  vendedor?: string
  movimientos: Movimiento[]
  saldoAnterior: number
  saldoActual: number
  periodoDesde: string
  periodoHasta: string
}

export function ClientStatement({
  open,
  onOpenChange,
  clienteNombre,
  vendedor,
  movimientos,
  saldoAnterior,
  saldoActual,
  periodoDesde,
  periodoHasta,
}: ClientStatementProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const totalVentas = movimientos.filter((m) => m.tipo === "venta").reduce((a, m) => a + m.debe, 0)
  const totalCobros = movimientos.filter((m) => m.tipo === "cobro").reduce((a, m) => a + m.haber, 0)

  const handlePrint = useCallback(() => {
    if (!printRef.current) return
    const content = printRef.current.innerHTML
    const win = window.open("", "_blank", "width=600,height=800")
    if (!win) return

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Estado de Cuenta - ${clienteNombre}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #1a1a2e; }
          .statement { max-width: 520px; margin: 0 auto; padding: 24px; }
          .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 20px; }
          .header h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
          .header .subtitle { font-size: 12px; opacity: 0.7; }
          .header .client { font-size: 20px; font-weight: 700; margin-top: 16px; }
          .header .period { font-size: 12px; opacity: 0.8; margin-top: 4px; }
          .balance-cards { display: flex; gap: 8px; margin-bottom: 16px; }
          .balance-card { flex: 1; padding: 12px; border-radius: 10px; text-align: center; }
          .balance-card.anterior { background: #f1f5f9; }
          .balance-card.ventas { background: #fef2f2; }
          .balance-card.cobros { background: #f0fdf4; }
          .balance-card.actual { background: #1a1a2e; color: white; }
          .balance-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7; }
          .balance-card .value { font-size: 16px; font-weight: 700; margin-top: 2px; }
          .balance-card.ventas .value { color: #dc2626; }
          .balance-card.cobros .value { color: #16a34a; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
          thead th { background: #f8fafc; padding: 8px; text-align: left; font-weight: 600; color: #64748b; border-bottom: 2px solid #e2e8f0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
          thead th:last-child, thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
          tbody td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
          tbody td:last-child, tbody td:nth-child(3), tbody td:nth-child(4) { text-align: right; }
          .tipo-venta { background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
          .tipo-cobro { background: #f0fdf4; color: #16a34a; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
          .monto-debe { color: #dc2626; font-weight: 600; }
          .monto-haber { color: #16a34a; font-weight: 600; }
          .saldo-pos { color: #dc2626; font-weight: 700; }
          .saldo-neg { color: #16a34a; font-weight: 700; }
          .footer { text-align: center; padding: 12px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 8px; }
          .footer strong { color: #1a1a2e; }
          .empty { text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }, [clienteNombre])

  const handleShare = useCallback(async () => {
    if (!printRef.current) return

    // Try to use the canvas approach for sharing as image
    try {
      const { default: html2canvas } = await import("html2canvas").catch(() => ({ default: null }))
      if (html2canvas) {
        const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: "#ffffff" })
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
        if (blob && navigator.share) {
          const file = new File([blob], `estado_cuenta_${clienteNombre}.png`, { type: "image/png" })
          await navigator.share({ files: [file], title: `Estado de Cuenta - ${clienteNombre}` })
          return
        }
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `estado_cuenta_${clienteNombre}.png`
          a.click()
          URL.revokeObjectURL(url)
          return
        }
      }
    } catch {
      // Fallback to print
    }

    handlePrint()
  }, [clienteNombre, handlePrint])

  const hoy = new Date().toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estado de Cuenta - {clienteNombre}</DialogTitle>
        </DialogHeader>

        {/* Printable content */}
        <div ref={printRef} className="statement" style={{ maxWidth: 520, margin: "0 auto" }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(var(--foreground) / 0.85) 100%)", color: "hsl(var(--background))", padding: 24, borderRadius: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>AviGest</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Estado de Cuenta Corriente</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 16 }}>{clienteNombre}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              Periodo: {formatDate(periodoDesde)} al {formatDate(periodoHasta)}
            </div>
            {vendedor && <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>Vendedor: {vendedor}</div>}
          </div>

          {/* Balance cards */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, padding: 12, borderRadius: 10, textAlign: "center", background: "hsl(var(--muted))" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "hsl(var(--muted-foreground))" }}>Saldo Anterior</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: "hsl(var(--foreground))" }}>{formatCurrency(saldoAnterior)}</div>
            </div>
            <div style={{ flex: 1, padding: 12, borderRadius: 10, textAlign: "center", background: "hsl(var(--destructive) / 0.08)" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "hsl(var(--destructive))" }}>Ventas</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: "hsl(var(--destructive))" }}>+{formatCurrency(totalVentas)}</div>
            </div>
            <div style={{ flex: 1, padding: 12, borderRadius: 10, textAlign: "center", background: "hsl(var(--primary) / 0.08)" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "hsl(var(--primary))" }}>Cobros</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: "hsl(var(--primary))" }}>-{formatCurrency(totalCobros)}</div>
            </div>
          </div>

          {/* Big current balance */}
          <div style={{
            background: "hsl(var(--foreground))",
            color: "hsl(var(--background))",
            padding: 16,
            borderRadius: 10,
            textAlign: "center",
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.7 }}>Saldo Actual</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{formatCurrency(saldoActual)}</div>
          </div>

          {/* Movements table */}
          {movimientos.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ background: "hsl(var(--muted))", padding: 8, textAlign: "left", fontWeight: 600, color: "hsl(var(--muted-foreground))", borderBottom: "2px solid hsl(var(--border))", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Fecha</th>
                    <th style={{ background: "hsl(var(--muted))", padding: 8, textAlign: "left", fontWeight: 600, color: "hsl(var(--muted-foreground))", borderBottom: "2px solid hsl(var(--border))", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Detalle</th>
                    <th style={{ background: "hsl(var(--muted))", padding: 8, textAlign: "right", fontWeight: 600, color: "hsl(var(--muted-foreground))", borderBottom: "2px solid hsl(var(--border))", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Debe</th>
                    <th style={{ background: "hsl(var(--muted))", padding: 8, textAlign: "right", fontWeight: 600, color: "hsl(var(--muted-foreground))", borderBottom: "2px solid hsl(var(--border))", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((mov, i) => (
                    <tr key={i}>
                      <td style={{ padding: 8, borderBottom: "1px solid hsl(var(--border) / 0.5)", color: "hsl(var(--foreground))", whiteSpace: "nowrap" }}>{formatDate(mov.fecha)}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid hsl(var(--border) / 0.5)", color: "hsl(var(--muted-foreground))" }}>{mov.descripcion}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid hsl(var(--border) / 0.5)", textAlign: "right", fontWeight: 600, color: mov.debe > 0 ? "hsl(var(--destructive))" : "transparent" }}>
                        {mov.debe > 0 ? formatCurrency(mov.debe) : ""}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid hsl(var(--border) / 0.5)", textAlign: "right", fontWeight: 600, color: mov.haber > 0 ? "hsl(var(--primary))" : "transparent" }}>
                        {mov.haber > 0 ? formatCurrency(mov.haber) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 24, color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
              Sin movimientos en el periodo seleccionado
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", padding: 12, fontSize: 11, color: "hsl(var(--muted-foreground))", borderTop: "1px solid hsl(var(--border))", marginTop: 8 }}>
            Generado el {hoy} por <strong style={{ color: "hsl(var(--foreground))" }}>AviGest</strong>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Compartir
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
