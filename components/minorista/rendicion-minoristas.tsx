"use client"

import { useState, useMemo, useEffect } from "react"
import { Wallet, Save, Trash2, TrendingUp, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/stat-card"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
import { useConfirm } from "@/components/confirm-dialog"
import {
  ClienteMinorista,
  PedidoMinorista,
  RepartoMinorista,
  RendicionMinorista,
} from "./types"

interface Props {
  repartos: RepartoMinorista[]
  pedidos: PedidoMinorista[]
  clientes: ClienteMinorista[]
  rendiciones: RendicionMinorista[]
  mutateRendiciones: () => Promise<any>
}

export function RendicionMinoristas({
  repartos,
  pedidos,
  clientes,
  rendiciones,
  mutateRendiciones,
}: Props) {
  const { toast } = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
  const [repartoId, setRepartoId] = useState<string>("")
  const [efectivo, setEfectivo] = useState("0")
  const [mp, setMp] = useState("0")
  const [notas, setNotas] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const clientesById = useMemo(() => {
    const m = new Map<string, ClienteMinorista>()
    clientes.forEach((c) => m.set(c.id, c))
    return m
  }, [clientes])

  const rendicionDelReparto = useMemo(
    () => rendiciones.find((r) => r.reparto_id === repartoId) || null,
    [rendiciones, repartoId]
  )

  const repartoSelected = useMemo(
    () => repartos.find((r) => r.id === repartoId) || null,
    [repartos, repartoId]
  )

  const pedidosDelReparto = useMemo(() => {
    if (!repartoSelected) return []
    return (repartoSelected.orden_pedidos || [])
      .map((id) => pedidos.find((p) => p.id === id))
      .filter(Boolean) as PedidoMinorista[]
  }, [repartoSelected, pedidos])

  const entregados = pedidosDelReparto.filter((p) => p.estado === "entregado")
  const noEntregados = pedidosDelReparto.filter(
    (p) => p.estado === "intento_fallido"
  )
  const pendientes = pedidosDelReparto.filter(
    (p) => !["entregado", "intento_fallido"].includes(p.estado)
  )

  const esperadoEfectivo = entregados
    .filter((p) => p.forma_pago === "efectivo")
    .reduce((s, p) => s + (p.total || 0), 0)
  const esperadoMP = entregados
    .filter((p) => p.forma_pago === "mercadopago")
    .reduce((s, p) => s + (p.total || 0), 0)
  const esperadoTotal = esperadoEfectivo + esperadoMP

  const cobradoTotal = (Number(efectivo) || 0) + (Number(mp) || 0)
  const diferencia = cobradoTotal - esperadoTotal
  const coincide = Math.abs(diferencia) < 0.01

  useEffect(() => {
    if (rendicionDelReparto) {
      setEfectivo(String(rendicionDelReparto.efectivo_cobrado || 0))
      setMp(String(rendicionDelReparto.mp_cobrado || 0))
      setNotas(rendicionDelReparto.notas || "")
      return
    }
    if (!repartoSelected) return
    const entregadosLocal = (repartoSelected.orden_pedidos || [])
      .map((id) => pedidos.find((p) => p.id === id))
      .filter((p): p is PedidoMinorista => !!p && p.estado === "entregado")
    const efLocal = entregadosLocal
      .filter((p) => p.forma_pago === "efectivo")
      .reduce((s, p) => s + (p.total || 0), 0)
    const mpLocal = entregadosLocal
      .filter((p) => p.forma_pago === "mercadopago")
      .reduce((s, p) => s + (p.total || 0), 0)
    setEfectivo(efLocal.toFixed(2))
    setMp(mpLocal.toFixed(2))
    setNotas("")
  }, [rendicionDelReparto?.id, repartoSelected?.id, pedidos])

  const handleGuardar = async () => {
    if (!repartoSelected) return
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const payload = {
        reparto_id: repartoSelected.id,
        fecha: repartoSelected.fecha,
        repartidor: repartoSelected.repartidor || null,
        efectivo_cobrado: Number(efectivo) || 0,
        mp_cobrado: Number(mp) || 0,
        total_cobrado: cobradoTotal,
        entregados: entregados.length,
        no_entregados: noEntregados.length,
        notas: notas.trim() || null,
      }
      if (rendicionDelReparto) {
        await updateRow("rendiciones_minoristas", rendicionDelReparto.id, payload)
        toast({ title: "Rendición actualizada" })
      } else {
        await insertRow("rendiciones_minoristas", payload)
        toast({ title: "Rendición guardada" })
      }
      await mutateRendiciones()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!rendicionDelReparto) return
    const ok = await confirm({
      title: "Borrar rendición?",
      destructive: true,
      confirmLabel: "Borrar",
    })
    if (!ok) return
    try {
      await deleteRow("rendiciones_minoristas", rendicionDelReparto.id)
      await mutateRendiciones()
      toast({ title: "Rendición borrada" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <Label>Reparto a rendir</Label>
        <Select value={repartoId} onValueChange={setRepartoId}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar reparto" />
          </SelectTrigger>
          <SelectContent>
            {repartos
              .slice()
              .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
              .map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.fecha} · {r.nombre}
                  {r.repartidor ? ` · ${r.repartidor}` : ""}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {!repartoSelected ? (
        <div className="py-16 text-center text-muted-foreground text-sm border-2 border-dashed rounded-lg">
          <Wallet className="h-12 w-12 mx-auto mb-2 opacity-30" />
          Seleccioná un reparto para rendirlo
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              title="Entregados"
              value={String(entregados.length)}
              icon={TrendingUp}
            />
            <StatCard
              title="Fallidos"
              value={String(noEntregados.length)}
              icon={AlertTriangle}
            />
            <StatCard
              title="Esperado"
              value={formatCurrency(esperadoTotal)}
              icon={Wallet}
            />
            <StatCard
              title="Cobrado"
              value={formatCurrency(cobradoTotal)}
              subtitle={
                coincide
                  ? "Coincide con esperado"
                  : `Diferencia: ${diferencia >= 0 ? "+" : ""}${formatCurrency(diferencia)}`
              }
              icon={Wallet}
              variant={coincide ? "default" : diferencia > 0 ? "success" : "destructive"}
            />
          </div>

          {pendientes.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-3 flex items-center gap-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Hay {pendientes.length} pedido(s) aún sin cerrar. Marcalos como
                "Entregado" o "Intento fallido" en la pestaña Pedidos antes de rendir.
              </CardContent>
            </Card>
          )}

          {/* Inputs */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Efectivo cobrado</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={efectivo}
                    onChange={(e) => setEfectivo(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Esperado: {formatCurrency(esperadoEfectivo)}
                  </p>
                </div>
                <div>
                  <Label>MercadoPago cobrado</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={mp}
                    onChange={(e) => setMp(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Esperado: {formatCurrency(esperadoMP)}
                  </p>
                </div>
              </div>
              <div>
                <Label>Notas de la rendición</Label>
                <Textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  placeholder="Incidencias, diferencias, devoluciones, etc."
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <span className="text-sm font-medium">Diferencia</span>
                <span
                  className={`text-lg font-bold ${
                    coincide
                      ? "text-foreground"
                      : diferencia > 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {diferencia >= 0 ? "+" : ""}
                  {formatCurrency(diferencia)}
                </span>
              </div>
              <div className="flex gap-2 justify-end">
                {rendicionDelReparto && (
                  <Button
                    variant="ghost"
                    className="text-rose-600"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Borrar
                  </Button>
                )}
                <Button onClick={handleGuardar} disabled={isSubmitting}>
                  <Save className="h-4 w-4 mr-1.5" />
                  {isSubmitting
                    ? "Guardando…"
                    : `${rendicionDelReparto ? "Actualizar" : "Guardar"} rendición`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Detalle por pedido */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Detalle del reparto</h3>
            <div className="space-y-1.5">
              {pedidosDelReparto.map((p) => {
                const cli = clientesById.get(p.cliente_id || "")
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 p-2 rounded border bg-card"
                  >
                    <Badge variant="outline" className="text-[10px]">
                      {p.numero}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {cli ? `${cli.nombre} ${cli.apellido}` : "Sin cliente"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.forma_pago.toUpperCase()} · {formatCurrency(p.total)}
                      </div>
                    </div>
                    <Badge
                      className={`text-[10px] ${
                        p.estado === "entregado"
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : p.estado === "intento_fallido"
                          ? "bg-rose-100 text-rose-700 border-rose-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      } border`}
                    >
                      {p.estado === "entregado"
                        ? "Entregado"
                        : p.estado === "intento_fallido"
                        ? "Fallido"
                        : p.estado === "en_reparto"
                        ? "En reparto"
                        : "Pendiente"}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
      <ConfirmDialog />
    </div>
  )
}
