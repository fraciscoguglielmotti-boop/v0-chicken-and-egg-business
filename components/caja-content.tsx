"use client"

import { useMemo, useState } from "react"
import { Plus, Wallet, Banknote, Smartphone, CreditCard, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSupabase, insertRow, deleteRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Cobro {
  id: string
  fecha: string
  monto: number
  metodo_pago: string
  cuenta_destino?: string
}

interface Gasto {
  id: string
  fecha: string
  monto: number
  medio_pago?: string
  tarjeta?: string
}

interface Pago {
  id: string
  fecha: string
  monto: number
  metodo_pago?: string
}

interface PagoTarjeta {
  id: string
  fecha: string
  tarjeta: string
  monto: number
  cuenta_origen: string
  observaciones?: string
}

const TARJETAS_CAJA = ["Visa (empresa)", "Visa (personal Francisco)", "Visa (Damián)", "Master", "Tarjeta MP"]
const CUENTAS_ORIGEN = ["Cuenta Francisco", "Cuenta Diego", "MercadoPago"]

// ─── Bolsillo card ────────────────────────────────────────────────────────────

function BolsilloCard({ label, icon: Icon, color, saldo, detalle }: {
  label: string
  icon: React.ElementType
  color: string
  saldo: number
  detalle: { label: string; value: number; sign: "+" | "-" }[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="cursor-pointer" onClick={() => setOpen(o => !o)}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          {label}
        </CardTitle>
        <Badge variant={saldo >= 0 ? "default" : "destructive"} className="text-sm font-bold">
          {formatCurrency(saldo)}
        </Badge>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 space-y-1 border-t mt-2">
          {detalle.map((d) => (
            <div key={d.label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{d.label}</span>
              <span className={d.sign === "+" ? "text-green-600" : "text-red-500"}>
                {d.sign}{formatCurrency(d.value)}
              </span>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CajaContent() {
  const { data: cobros = [] } = useSupabase<Cobro>("cobros")
  const { data: gastos = [] } = useSupabase<Gasto>("gastos")
  const { data: pagos = [] } = useSupabase<Pago>("pagos")
  const { data: pagosTarjeta = [], mutate: mutatePagosTarjeta } = useSupabase<PagoTarjeta>("pagos_tarjeta")
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    tarjeta: "",
    monto: "",
    cuenta_origen: "",
    observaciones: "",
  })

  const handlePagarTarjeta = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await insertRow("pagos_tarjeta", {
        fecha: form.fecha,
        tarjeta: form.tarjeta,
        monto: parseFloat(form.monto),
        cuenta_origen: form.cuenta_origen,
        observaciones: form.observaciones || null,
      })
      await mutatePagosTarjeta()
      setDialogOpen(false)
      setForm({ fecha: new Date().toISOString().split("T")[0], tarjeta: "", monto: "", cuenta_origen: "", observaciones: "" })
      toast({ title: "Pago de tarjeta registrado" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleDeletePago = async (id: string) => {
    try {
      await deleteRow("pagos_tarjeta", id)
      await mutatePagosTarjeta()
      toast({ title: "Pago eliminado" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  // ─── Cálculos de saldo por bolsillo ────────────────────────────────────────

  const saldos = useMemo(() => {
    // Efectivo
    const cobrosEfectivo = cobros.filter(c => c.metodo_pago === "efectivo").reduce((s, c) => s + Number(c.monto), 0)
    const gastosEfectivo = gastos.filter(g => g.medio_pago === "Efectivo").reduce((s, g) => s + Number(g.monto), 0)
    const pagosEfectivo = pagos.filter(p => p.metodo_pago === "Efectivo").reduce((s, p) => s + Number(p.monto), 0)

    // Cuenta Francisco
    const cobrosFrancisco = cobros.filter(c => c.metodo_pago === "transferencia" && c.cuenta_destino === "Francisco").reduce((s, c) => s + Number(c.monto), 0)
    const gastosFrancisco = gastos.filter(g => g.medio_pago === "Cuenta Francisco").reduce((s, g) => s + Number(g.monto), 0)
    const pagosFrancisco = pagos.filter(p => p.metodo_pago === "Cuenta Francisco").reduce((s, p) => s + Number(p.monto), 0)
    const pagosTarjetaFrancisco = pagosTarjeta.filter(p => p.cuenta_origen === "Cuenta Francisco").reduce((s, p) => s + Number(p.monto), 0)

    // Cuenta Diego
    const cobrosDiego = cobros.filter(c => c.metodo_pago === "transferencia" && c.cuenta_destino === "Diego").reduce((s, c) => s + Number(c.monto), 0)
    const gastosDiego = gastos.filter(g => g.medio_pago === "Cuenta Diego").reduce((s, g) => s + Number(g.monto), 0)
    const pagosDiego = pagos.filter(p => p.metodo_pago === "Cuenta Diego").reduce((s, p) => s + Number(p.monto), 0)
    const pagosTarjetaDiego = pagosTarjeta.filter(p => p.cuenta_origen === "Cuenta Diego").reduce((s, p) => s + Number(p.monto), 0)

    // MercadoPago
    const cobrosMP = cobros.filter(c => c.metodo_pago === "transferencia" && c.cuenta_destino === "MercadoPago").reduce((s, c) => s + Number(c.monto), 0)
    const gastosMP = gastos.filter(g => g.medio_pago === "MercadoPago").reduce((s, g) => s + Number(g.monto), 0)
    const pagosMP = pagos.filter(p => p.metodo_pago === "MercadoPago").reduce((s, p) => s + Number(p.monto), 0)
    const pagosTarjetaMP = pagosTarjeta.filter(p => p.cuenta_origen === "MercadoPago").reduce((s, p) => s + Number(p.monto), 0)

    // Deuda tarjetas (gastos con tarjeta menos lo ya pagado)
    const deudaPorTarjeta = TARJETAS_CAJA.map(tarjeta => {
      const gastado = gastos.filter(g => g.medio_pago === "Tarjeta Credito" && g.tarjeta === tarjeta).reduce((s, g) => s + Number(g.monto), 0)
      const pagado = pagosTarjeta.filter(p => p.tarjeta === tarjeta).reduce((s, p) => s + Number(p.monto), 0)
      return { tarjeta, gastado, pagado, deuda: Math.max(0, gastado - pagado) }
    }).filter(d => d.gastado > 0)

    const totalDeudaTarjetas = deudaPorTarjeta.reduce((s, d) => s + d.deuda, 0)

    return {
      efectivo: { saldo: cobrosEfectivo - gastosEfectivo - pagosEfectivo, cobros: cobrosEfectivo, gastos: gastosEfectivo, pagos: pagosEfectivo },
      francisco: { saldo: cobrosFrancisco - gastosFrancisco - pagosFrancisco - pagosTarjetaFrancisco, cobros: cobrosFrancisco, gastos: gastosFrancisco, pagos: pagosFrancisco, tarjetas: pagosTarjetaFrancisco },
      diego: { saldo: cobrosDiego - gastosDiego - pagosDiego - pagosTarjetaDiego, cobros: cobrosDiego, gastos: gastosDiego, pagos: pagosDiego, tarjetas: pagosTarjetaDiego },
      mp: { saldo: cobrosMP - gastosMP - pagosMP - pagosTarjetaMP, cobros: cobrosMP, gastos: gastosMP, pagos: pagosMP, tarjetas: pagosTarjetaMP },
      deudaPorTarjeta,
      totalDeudaTarjetas,
      totalDisponible: (cobrosEfectivo - gastosEfectivo - pagosEfectivo) + (cobrosFrancisco - gastosFrancisco - pagosFrancisco - pagosTarjetaFrancisco) + (cobrosDiego - gastosDiego - pagosDiego - pagosTarjetaDiego) + (cobrosMP - gastosMP - pagosMP - pagosTarjetaMP),
    }
  }, [cobros, gastos, pagos, pagosTarjeta])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="saldos">
        <TabsList>
          <TabsTrigger value="saldos">Saldos</TabsTrigger>
          <TabsTrigger value="tarjetas">Tarjetas</TabsTrigger>
        </TabsList>

        {/* ── SALDOS ── */}
        <TabsContent value="saldos" className="space-y-6 mt-4">

          {/* Total general */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-sm text-muted-foreground">Total disponible</p>
                <p className="text-3xl font-bold">{formatCurrency(saldos.totalDisponible)}</p>
                <p className="text-xs text-muted-foreground mt-1">Efectivo + Francisco + Diego + MP (sin contar deuda tarjetas)</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Deuda tarjetas pendiente</p>
                <p className="text-xl font-bold text-destructive">{formatCurrency(saldos.totalDeudaTarjetas)}</p>
                <p className="text-sm font-semibold mt-1">
                  Neto real: <span className={saldos.totalDisponible - saldos.totalDeudaTarjetas >= 0 ? "text-green-600" : "text-destructive"}>
                    {formatCurrency(saldos.totalDisponible - saldos.totalDeudaTarjetas)}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bolsillos */}
          <div className="grid gap-4 sm:grid-cols-2">
            <BolsilloCard
              label="Efectivo"
              icon={Banknote}
              color="text-green-600"
              saldo={saldos.efectivo.saldo}
              detalle={[
                { label: "Cobros cobrados", value: saldos.efectivo.cobros, sign: "+" },
                { label: "Gastos en efectivo", value: saldos.efectivo.gastos, sign: "-" },
                { label: "Pagos a proveedores", value: saldos.efectivo.pagos, sign: "-" },
              ]}
            />
            <BolsilloCard
              label="Cuenta Francisco"
              icon={Wallet}
              color="text-blue-600"
              saldo={saldos.francisco.saldo}
              detalle={[
                { label: "Cobros recibidos", value: saldos.francisco.cobros, sign: "+" },
                { label: "Gastos cuenta", value: saldos.francisco.gastos, sign: "-" },
                { label: "Pagos a proveedores", value: saldos.francisco.pagos, sign: "-" },
                { label: "Pago de tarjetas", value: saldos.francisco.tarjetas, sign: "-" },
              ]}
            />
            <BolsilloCard
              label="Cuenta Diego"
              icon={Wallet}
              color="text-purple-600"
              saldo={saldos.diego.saldo}
              detalle={[
                { label: "Cobros recibidos", value: saldos.diego.cobros, sign: "+" },
                { label: "Gastos cuenta", value: saldos.diego.gastos, sign: "-" },
                { label: "Pagos a proveedores", value: saldos.diego.pagos, sign: "-" },
                { label: "Pago de tarjetas", value: saldos.diego.tarjetas, sign: "-" },
              ]}
            />
            <BolsilloCard
              label="MercadoPago"
              icon={Smartphone}
              color="text-cyan-600"
              saldo={saldos.mp.saldo}
              detalle={[
                { label: "Cobros recibidos", value: saldos.mp.cobros, sign: "+" },
                { label: "Gastos MP", value: saldos.mp.gastos, sign: "-" },
                { label: "Pagos a proveedores", value: saldos.mp.pagos, sign: "-" },
                { label: "Pago tarjeta MP", value: saldos.mp.tarjetas, sign: "-" },
              ]}
            />
          </div>
        </TabsContent>

        {/* ── TARJETAS ── */}
        <TabsContent value="tarjetas" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Registrá cuando pagás el resumen de cada tarjeta</p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Registrar pago
            </Button>
          </div>

          {/* Deuda por tarjeta */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {saldos.deudaPorTarjeta.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full py-4 text-center">No hay gastos de tarjeta registrados</p>
            ) : saldos.deudaPorTarjeta.map((d) => (
              <Card key={d.tarjeta}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    {d.tarjeta}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Gastado total</span>
                    <span>{formatCurrency(d.gastado)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Pagado</span>
                    <span>-{formatCurrency(d.pagado)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-1 border-t">
                    <span>Deuda pendiente</span>
                    <Badge variant={d.deuda > 0 ? "destructive" : "default"}>
                      {formatCurrency(d.deuda)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Historial de pagos de tarjeta */}
          {pagosTarjeta.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-semibold">Fecha</th>
                    <th className="text-left p-3 font-semibold">Tarjeta</th>
                    <th className="text-left p-3 font-semibold hidden sm:table-cell">Desde</th>
                    <th className="text-right p-3 font-semibold">Monto</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {pagosTarjeta.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-muted/20">
                      <td className="p-3 text-muted-foreground">{formatDate(new Date(p.fecha))}</td>
                      <td className="p-3 font-medium">{p.tarjeta}</td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">{p.cuenta_origen}</td>
                      <td className="p-3 text-right font-semibold text-destructive">{formatCurrency(p.monto)}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeletePago(p.id)}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: registrar pago de tarjeta */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago de tarjeta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePagarTarjeta} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input type="date" value={form.fecha} max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input type="number" step="0.01" placeholder="0" value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tarjeta</Label>
              <Select value={form.tarjeta} onValueChange={(v) => setForm({ ...form, tarjeta: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tarjeta" /></SelectTrigger>
                <SelectContent>
                  {TARJETAS_CAJA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pagado desde</Label>
              <Select value={form.cuenta_origen} onValueChange={(v) => setForm({ ...form, cuenta_origen: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                <SelectContent>
                  {CUENTAS_ORIGEN.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observaciones (opcional)</Label>
              <Input placeholder="Ej: Resumen marzo" value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={!form.tarjeta || !form.monto || !form.cuenta_origen}>
                Registrar pago
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
