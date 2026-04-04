"use client"

import { useState, useMemo } from "react"
import { Copy, Check, FileText, Key, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface Cliente {
  id: string
  nombre: string
  cuit?: string
}

interface Cobro {
  id: string
  fecha: string
  cliente_nombre: string
  monto: number
  metodo_pago?: string
  cuenta_destino?: string
}

function getMesOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleString("es-AR", { month: "long", year: "numeric" })
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return options
}

export function FacturasContent() {
  const { data: clientes = [], isLoading: loadingClientes } = useSupabase<Cliente>("clientes")
  const { data: cobros = [], isLoading: loadingCobros } = useSupabase<Cobro>("cobros")
  const { toast } = useToast()

  const mesOptions = getMesOptions()
  const [mesSel, setMesSel] = useState(mesOptions[0].value)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [copiado, setCopiado] = useState(false)

  // Calcular monto por cliente: transferencias con destino Agroaves en el mes seleccionado
  const montosPorCliente = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of cobros) {
      if (
        c.fecha.startsWith(mesSel) &&
        c.metodo_pago?.toLowerCase() === "transferencia" &&
        c.cuenta_destino?.toLowerCase() === "agroaves"
      ) {
        map[c.cliente_nombre] = (map[c.cliente_nombre] ?? 0) + Number(c.monto)
      }
    }
    return map
  }, [cobros, mesSel])

  // Clientes que tienen al menos una transferencia Agroaves ese mes
  const clientesConMovimiento = useMemo(() => {
    return clientes.filter((c) => montosPorCliente[c.nombre] !== undefined)
  }, [clientes, montosPorCliente])

  // Clientes sin movimiento ese mes (para poder agregarlos igualmente)
  const clientesSinMovimiento = useMemo(() => {
    return clientes.filter((c) => montosPorCliente[c.nombre] === undefined)
  }, [clientes, montosPorCliente])

  const toggleCliente = (nombre: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(nombre)) next.delete(nombre)
      else next.add(nombre)
      return next
    })
  }

  const toggleTodos = () => {
    if (seleccionados.size === clientesConMovimiento.length && clientesConMovimiento.length > 0) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(clientesConMovimiento.map((c) => c.nombre)))
    }
  }

  // Listado final para mostrar y exportar
  const listado = useMemo(() => {
    return clientes
      .filter((c) => seleccionados.has(c.nombre))
      .map((c) => ({
        nombre: c.nombre,
        cuit: c.cuit ?? "Sin CUIT",
        monto: montosPorCliente[c.nombre] ?? 0,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [clientes, seleccionados, montosPorCliente])

  const totalGeneral = listado.reduce((s, r) => s + r.monto, 0)

  const [anioLabel, mesLabel] = (() => {
    const opt = mesOptions.find((o) => o.value === mesSel)
    return [mesSel.split("-")[0], opt?.label ?? mesSel]
  })()

  const textoWhatsApp = useMemo(() => {
    if (listado.length === 0) return ""
    const lineas = listado.map(
      (r) =>
        `• ${r.nombre}\n  CUIT: ${r.cuit}\n  Monto: ${formatCurrency(r.monto)}`
    )
    return (
      `📋 *PREPARACIÓN DE FACTURAS*\n` +
      `🗓️ Período: ${mesLabel}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      lineas.join("\n\n") +
      `\n\n━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 *TOTAL: ${formatCurrency(totalGeneral)}*`
    )
  }, [listado, mesLabel, totalGeneral])

  const copiarTexto = async () => {
    if (!textoWhatsApp) return
    await navigator.clipboard.writeText(textoWhatsApp)
    setCopiado(true)
    toast({ title: "Copiado", description: "Texto listo para pegar en WhatsApp" })
    setTimeout(() => setCopiado(false), 2000)
  }

  const isLoading = loadingClientes || loadingCobros

  // ── Monotributo ──────────────────────────────────────────────────────────
  const monotributo = useMemo(() => {
    const personas = ["Francisco", "Diego"] as const
    const result: Record<string, { total: number; clientes: Record<string, number> }> = {}
    for (const p of personas) result[p] = { total: 0, clientes: {} }

    for (const c of cobros) {
      if (!c.fecha.startsWith(mesSel)) continue
      if (c.metodo_pago?.toLowerCase() !== "transferencia") continue
      const dest = c.cuenta_destino ?? ""
      // Match flexible: "Francisco", "Francisco Guglielmotti", etc.
      const persona = dest.toLowerCase().startsWith("francisco") ? "Francisco"
        : dest.toLowerCase().startsWith("diego") ? "Diego"
        : null
      if (!persona) continue
      result[persona].total += Number(c.monto)
      result[persona].clientes[c.cliente_nombre] = (result[persona].clientes[c.cliente_nombre] ?? 0) + Number(c.monto)
    }
    return result
  }, [cobros, mesSel])

  return (
    <div className="space-y-6 max-w-4xl">
      <Tabs defaultValue="agroaves">
        <TabsList>
          <TabsTrigger value="agroaves">Facturas Agroaves</TabsTrigger>
          <TabsTrigger value="monotributo">Facturas Monotributo</TabsTrigger>
          <TabsTrigger value="acceso">Datos de Acceso</TabsTrigger>
        </TabsList>

        {/* ── Monotributo ─────────────────────────────────────────────── */}
        <TabsContent value="monotributo" className="space-y-4 mt-4">
          <div className="flex items-center gap-4">
            <Label className="shrink-0 text-sm font-medium">Período:</Label>
            <Select value={mesSel} onValueChange={(v) => { setMesSel(v); setSeleccionados(new Set()) }}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{mesOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(["Francisco", "Diego"] as const).map(persona => {
              const d = monotributo[persona]
              const clientesOrdenados = Object.entries(d.clientes).sort((a, b) => b[1] - a[1])
              return (
                <Card key={persona} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-semibold text-base">{persona}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total a facturar</p>
                      <p className="text-xl font-bold text-primary">{formatCurrency(d.total)}</p>
                    </div>
                  </div>

                  {clientesOrdenados.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Sin transferencias este mes.</p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Por cliente</p>
                      {clientesOrdenados.map(([nombre, monto], i) => (
                        <div key={nombre} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                          <div className="flex items-center gap-2">
                            {i === 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">★ Mayor</Badge>}
                            <span className="text-sm">{nombre}</span>
                          </div>
                          <span className="text-sm font-semibold tabular-nums">{formatCurrency(monto)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ── Datos de Acceso ─────────────────────────────────────────── */}
        <TabsContent value="acceso" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                persona: "Francisco Guglielmotti",
                items: [
                  { label: "Portal AFIP", value: "https://auth.afip.gob.ar/contribuyente_/login.xhtml", isLink: true },
                  { label: "CUIT", value: "Guardado en configuración" },
                  { label: "Clave fiscal", value: "Guardado en configuración" },
                ]
              },
              {
                persona: "Diego",
                items: [
                  { label: "Portal AFIP", value: "https://auth.afip.gob.ar/contribuyente_/login.xhtml", isLink: true },
                  { label: "CUIT", value: "Guardado en configuración" },
                  { label: "Clave fiscal", value: "Guardado en configuración" },
                ]
              }
            ].map(({ persona, items }) => (
              <Card key={persona} className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">{persona}</h3>
                </div>
                <div className="space-y-3">
                  {items.map(({ label, value, isLink }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                      {isLink ? (
                        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">{value}</a>
                      ) : (
                        <p className="text-sm font-medium">{value}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Para editar los datos de acceso, contactá al administrador del sistema.</p>
        </TabsContent>

        {/* ── Facturas Agroaves (contenido existente) ──────────────────── */}
        <TabsContent value="agroaves">
    <div className="space-y-6 max-w-3xl mt-4">
      {/* Selector de mes */}
      <div className="flex items-center gap-4">
        <Label className="shrink-0 text-sm font-medium">Período:</Label>
        <Select value={mesSel} onValueChange={(v) => { setMesSel(v); setSeleccionados(new Set()) }}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mesOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Panel izquierdo: selección de clientes */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Seleccionar clientes</h2>
            {clientesConMovimiento.length > 0 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={toggleTodos}
              >
                {seleccionados.size === clientesConMovimiento.length ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <>
              {clientesConMovimiento.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Con transferencias Agroaves</p>
                  {clientesConMovimiento.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer"
                      onClick={() => toggleCliente(c.nombre)}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={seleccionados.has(c.nombre)}
                          onCheckedChange={() => toggleCliente(c.nombre)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm">{c.nombre}</span>
                      </div>
                      <span className="text-xs font-semibold text-primary">
                        {formatCurrency(montosPorCliente[c.nombre])}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {clientesSinMovimiento.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mt-3">Sin movimiento este mes</p>
                  {clientesSinMovimiento.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer opacity-60"
                      onClick={() => toggleCliente(c.nombre)}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={seleccionados.has(c.nombre)}
                          onCheckedChange={() => toggleCliente(c.nombre)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm">{c.nombre}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">$0</span>
                    </div>
                  ))}
                </div>
              )}

              {clientes.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay clientes registrados.</p>
              )}
            </>
          )}
        </div>

        {/* Panel derecho: listado generado */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Listado para facturar</h2>
            {listado.length > 0 && (
              <Button size="sm" variant="outline" onClick={copiarTexto}>
                {copiado ? <Check className="h-4 w-4 mr-1 text-green-500" /> : <Copy className="h-4 w-4 mr-1" />}
                {copiado ? "Copiado" : "Copiar WhatsApp"}
              </Button>
            )}
          </div>

          {listado.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Seleccioná clientes para generar el listado</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {listado.map((r) => (
                  <div key={r.nombre} className="rounded-md border border-border bg-muted/30 px-3 py-2.5 space-y-0.5">
                    <p className="text-sm font-semibold">{r.nombre}</p>
                    <p className="text-xs text-muted-foreground">CUIT: {r.cuit}</p>
                    <p className="text-sm font-bold text-primary">{formatCurrency(r.monto)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-base font-bold text-primary">{formatCurrency(totalGeneral)}</span>
              </div>

              {/* Vista previa del texto */}
              <div className="rounded-md bg-muted p-3 mt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Vista previa WhatsApp</p>
                <pre className="text-xs whitespace-pre-wrap font-sans text-foreground">{textoWhatsApp}</pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
