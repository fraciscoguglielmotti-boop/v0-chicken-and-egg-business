"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Download, WifiOff, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// ── Types ─────────────────────────────────────────────────────────────────────

interface OfflineCompra {
  _localId: string
  fecha: string
  proveedor_nombre: string
  producto: string
  cantidad: number
  precio_unitario: number
  total: number
  modalidad: "planta" | "envio"
  estado: string
  synced?: boolean
}

interface OfflinePago {
  _localId: string
  fecha: string
  proveedor_nombre: string
  monto: number
  metodo_pago: string
  observaciones: string
  synced?: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVEEDOR = "Agroaves"
const STORAGE_COMPRAS = "offline_compras_v1"
const STORAGE_PAGOS = "offline_pagos_v1"
const PRODUCTOS_AGROAVES = ["Pollo entero", "Pollo trozado", "Pechuga", "Muslos", "Alas", "Menudos", "Otro"]
const METODOS_PAGO = ["Efectivo", "Cuenta Francisco", "Cuenta Diego", "MercadoPago"]

const today = () => new Date().toISOString().split("T")[0]
const uid = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

function esc(v: string | null | undefined): string {
  if (v == null) return "NULL"
  return `'${String(v).replace(/'/g, "''")}'`
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function loadStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[]
  } catch {
    return []
  }
}

function saveStorage<T>(key: string, data: T[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(data))
}

// ── SQL export ────────────────────────────────────────────────────────────────

function buildComprasSQL(compras: OfflineCompra[]): string {
  if (compras.length === 0) return "-- No hay compras offline registradas\n"
  const rows = compras
    .map((c) => {
      const cols = [
        "fecha",
        "proveedor_nombre",
        "producto",
        "cantidad",
        "precio_unitario",
        "total",
        "modalidad",
        "estado",
        "verificado",
      ].join(", ")
      const vals = [
        esc(c.fecha),
        esc(c.proveedor_nombre),
        esc(c.producto),
        c.cantidad,
        c.precio_unitario,
        c.total,
        esc(c.modalidad),
        esc(c.estado),
        "false",
      ].join(", ")
      return `  (${vals})`
    })
    .join(",\n")

  return `-- Compras offline (${compras.length} registro${compras.length !== 1 ? "s" : ""}) — pegar en Supabase SQL Editor\nINSERT INTO compras (fecha, proveedor_nombre, producto, cantidad, precio_unitario, total, modalidad, estado, verificado)\nVALUES\n${rows};\n`
}

function buildPagosSQL(pagos: OfflinePago[]): string {
  if (pagos.length === 0) return "-- No hay pagos offline registrados\n"
  const rows = pagos
    .map((p) => {
      const vals = [
        esc(p.fecha),
        esc(p.proveedor_nombre),
        p.monto,
        esc(p.metodo_pago || null),
        esc(p.observaciones || null),
      ].join(", ")
      return `  (${vals})`
    })
    .join(",\n")

  return `-- Pagos offline (${pagos.length} registro${pagos.length !== 1 ? "s" : ""}) — pegar en Supabase SQL Editor\nINSERT INTO pagos (fecha, proveedor_nombre, monto, metodo_pago, observaciones)\nVALUES\n${rows};\n`
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement("textarea")
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand("copy")
    document.body.removeChild(ta)
  })
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatMonto(value: string): string {
  const nums = value.replace(/\D/g, "")
  return nums ? Number(nums).toLocaleString("es-AR") : ""
}

function parseMonto(value: string): number {
  return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 0 })}`
}

// ── Compras tab ───────────────────────────────────────────────────────────────

function ComprasTab() {
  const [compras, setCompras] = useState<OfflineCompra[]>([])
  const [form, setForm] = useState({
    fecha: today(),
    producto: "",
    cantidad: "",
    precio_unitario: "",
    modalidad: "planta" as "planta" | "envio",
  })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCompras(loadStorage<OfflineCompra>(STORAGE_COMPRAS))
  }, [])

  const persist = useCallback((next: OfflineCompra[]) => {
    setCompras(next)
    saveStorage(STORAGE_COMPRAS, next)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cantidad = parseFloat(form.cantidad.replace(",", ".")) || 0
    const precio = parseFloat(form.precio_unitario.replace(",", ".")) || 0
    if (!form.producto || cantidad <= 0 || precio <= 0) return

    const nueva: OfflineCompra = {
      _localId: uid(),
      fecha: form.fecha,
      proveedor_nombre: PROVEEDOR,
      producto: form.producto,
      cantidad,
      precio_unitario: precio,
      total: cantidad * precio,
      modalidad: form.modalidad,
      estado: "pendiente",
    }
    persist([nueva, ...compras])
    setForm({ fecha: today(), producto: "", cantidad: "", precio_unitario: "", modalidad: "planta" })
  }

  function handleDelete(id: string) {
    persist(compras.filter((c) => c._localId !== id))
  }

  function handleExport() {
    const sql = buildComprasSQL(compras)
    copyToClipboard(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const totalGeneral = compras.reduce((s, c) => s + c.total, 0)

  return (
    <div className="space-y-6">
      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nueva compra — {PROVEEDOR}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={form.fecha}
                max={today()}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Producto</Label>
              <Select value={form.producto} onValueChange={(v) => setForm({ ...form, producto: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTOS_AGROAVES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad (kg)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Precio unitario</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.precio_unitario}
                onChange={(e) => setForm({ ...form, precio_unitario: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Modalidad</Label>
              <Select
                value={form.modalidad}
                onValueChange={(v) => setForm({ ...form, modalidad: v as "planta" | "envio" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planta">Planta</SelectItem>
                  <SelectItem value="envio">Envío</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              {form.cantidad && form.precio_unitario ? (
                <p className="text-sm text-muted-foreground mb-2">
                  Total estimado:{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(
                      (parseFloat(form.cantidad.replace(",", ".")) || 0) *
                        (parseFloat(form.precio_unitario.replace(",", ".")) || 0)
                    )}
                  </span>
                </p>
              ) : (
                <div />
              )}
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">
                <Plus className="h-4 w-4 mr-1" />
                Agregar compra
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      {compras.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {compras.length} compra{compras.length !== 1 ? "s" : ""} guardada{compras.length !== 1 ? "s" : ""} —
              total:{" "}
              <span className="font-semibold text-foreground">{formatCurrency(totalGeneral)}</span>
            </p>
            <Button variant="outline" size="sm" onClick={handleExport}>
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" />
                  Copiado
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-1" />
                  Exportar SQL
                </>
              )}
            </Button>
          </div>
          <div className="space-y-2">
            {compras.map((c) => (
              <div
                key={c._localId}
                className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
              >
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {c.producto}{" "}
                    <Badge variant="outline" className="text-xs ml-1">
                      {c.modalidad}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground">
                    {c.fecha} — {c.cantidad} kg × {formatCurrency(c.precio_unitario)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatCurrency(c.total)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(c._localId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {compras.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No hay compras guardadas todavía
        </p>
      )}
    </div>
  )
}

// ── Pagos tab ─────────────────────────────────────────────────────────────────

function PagosTab() {
  const [pagos, setPagos] = useState<OfflinePago[]>([])
  const [form, setForm] = useState({
    fecha: today(),
    monto: "",
    metodo_pago: "",
    observaciones: "",
  })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setPagos(loadStorage<OfflinePago>(STORAGE_PAGOS))
  }, [])

  const persist = useCallback((next: OfflinePago[]) => {
    setPagos(next)
    saveStorage(STORAGE_PAGOS, next)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const monto = parseMonto(form.monto)
    if (monto <= 0) return

    const nuevo: OfflinePago = {
      _localId: uid(),
      fecha: form.fecha,
      proveedor_nombre: PROVEEDOR,
      monto,
      metodo_pago: form.metodo_pago,
      observaciones: form.observaciones,
    }
    persist([nuevo, ...pagos])
    setForm({ fecha: today(), monto: "", metodo_pago: "", observaciones: "" })
  }

  function handleDelete(id: string) {
    persist(pagos.filter((p) => p._localId !== id))
  }

  function handleExport() {
    const sql = buildPagosSQL(pagos)
    copyToClipboard(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const totalGeneral = pagos.reduce((s, p) => s + p.monto, 0)

  return (
    <div className="space-y-6">
      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nuevo pago — {PROVEEDOR}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={form.fecha}
                max={today()}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Monto</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: formatMonto(e.target.value) })}
                required
              />
            </div>
            <div>
              <Label>Método de pago</Label>
              <Select value={form.metodo_pago} onValueChange={(v) => setForm({ ...form, metodo_pago: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  {METODOS_PAGO.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Input
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">
                <Plus className="h-4 w-4 mr-1" />
                Agregar pago
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      {pagos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {pagos.length} pago{pagos.length !== 1 ? "s" : ""} guardado{pagos.length !== 1 ? "s" : ""} —
              total:{" "}
              <span className="font-semibold text-foreground">{formatCurrency(totalGeneral)}</span>
            </p>
            <Button variant="outline" size="sm" onClick={handleExport}>
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" />
                  Copiado
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-1" />
                  Exportar SQL
                </>
              )}
            </Button>
          </div>
          <div className="space-y-2">
            {pagos.map((p) => (
              <div
                key={p._localId}
                className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
              >
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {p.metodo_pago || "Sin método"}{" "}
                    {p.observaciones && (
                      <span className="text-muted-foreground font-normal">— {p.observaciones}</span>
                    )}
                  </p>
                  <p className="text-muted-foreground">{p.fecha}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-destructive">{formatCurrency(p.monto)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(p._localId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pagos.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No hay pagos guardados todavía
        </p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-amber-50 dark:bg-amber-950/30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <WifiOff className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <h1 className="font-semibold text-lg leading-tight">Modo Offline — {PROVEEDOR}</h1>
            <p className="text-sm text-muted-foreground">
              Los datos se guardan en este dispositivo. Usá{" "}
              <strong>Exportar SQL</strong> para sincronizar cuando tengas conexión.
            </p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-sm space-y-1">
          <p className="font-medium text-amber-800 dark:text-amber-200">Cómo sincronizar</p>
          <ol className="list-decimal list-inside text-amber-700 dark:text-amber-300 space-y-0.5">
            <li>Cargá las compras y pagos acá abajo</li>
            <li>Cuando tengas WiFi, hacé clic en <strong>Exportar SQL</strong> en cada tab</li>
            <li>Pegá el SQL en <strong>Supabase → SQL Editor</strong> y ejecutá</li>
            <li>Los registros aparecerán en el sistema normalmente</li>
          </ol>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Tabs defaultValue="compras">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="compras" className="flex-1">
              Compras
            </TabsTrigger>
            <TabsTrigger value="pagos" className="flex-1">
              Pagos / Transferencias
            </TabsTrigger>
          </TabsList>
          <TabsContent value="compras">
            <ComprasTab />
          </TabsContent>
          <TabsContent value="pagos">
            <PagosTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
