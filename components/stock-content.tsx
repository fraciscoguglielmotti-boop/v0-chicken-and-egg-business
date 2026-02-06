"use client"

import { useState, useMemo } from "react"
import { Package, TrendingUp, TrendingDown, AlertTriangle, Plus, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DataTable } from "./data-table"
import { SheetsStatus } from "./sheets-status"
import { useSheet, addRow, type SheetRow } from "@/hooks/use-sheets"
import { PRODUCTOS, type ProductoTipo, type StockActual, type StockMovement } from "@/lib/types"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: Date | string): string {
  if (!date) return "-"
  try {
    const d = new Date(date)
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset())
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d)
  } catch {
    return String(date)
  }
}

export function StockContent() {
  const sheetsVentas = useSheet("Ventas")
  const sheetsCompras = useSheet("Compras")
  const sheetsStock = useSheet("Stock")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ajusteForm, setAjusteForm] = useState({
    productoId: "" as ProductoTipo | "",
    cantidad: "",
    tipo: "entrada" as "entrada" | "salida",
    observaciones: "",
  })

  const isConnected = !sheetsStock.error && !sheetsStock.isLoading

  // Calculate current stock from movements
  const stockActual: StockActual[] = useMemo(() => {
    const stockMap = new Map<ProductoTipo, number>()

    // Initialize with current stock from Sheets if exists
    sheetsStock.rows.forEach((row) => {
      const productoId = row.ProductoID as ProductoTipo
      if (productoId) {
        stockMap.set(productoId, Number(row.Cantidad) || 0)
      }
    })

    // Add from purchases (entrada)
    sheetsCompras.rows.forEach((row) => {
      const productoId = (row.ProductoID || "pollo_a") as ProductoTipo
      const cantidad = Number(row.Cantidad) || 0
      const current = stockMap.get(productoId) || 0
      stockMap.set(productoId, current + cantidad)
    })

    // Subtract from sales (salida)
    sheetsVentas.rows.forEach((row) => {
      // Parse productos to extract quantities
      const productosStr = row.Productos || ""
      if (productosStr.includes(",")) {
        const parts = productosStr.split(",")
        parts.forEach((part) => {
          const match = part.trim().match(/^(\d+(?:\.\d+)?)\s*x?\s*(.+)$/i)
          if (match) {
            const qty = Number.parseFloat(match[1])
            const prodName = match[2].trim()
            const producto = PRODUCTOS.find((p) => p.nombre === prodName)
            if (producto) {
              const current = stockMap.get(producto.id) || 0
              stockMap.set(producto.id, current - qty)
            }
          }
        })
      } else {
        const cantidad = Number(row.Cantidad) || 0
        const match = productosStr.match(/^(\d+(?:\.\d+)?)\s*x?\s*(.+)$/i)
        if (match) {
          const prodName = match[2].trim()
          const producto = PRODUCTOS.find((p) => p.nombre === prodName)
          if (producto) {
            const current = stockMap.get(producto.id) || 0
            stockMap.set(producto.id, current - Number.parseFloat(match[1]))
          }
        }
      }
    })

    return PRODUCTOS.map((producto) => {
      const cantidad = stockMap.get(producto.id) || 0
      const stockMinimo = producto.id.includes("pollo") ? 50 : 200
      return {
        productoId: producto.id,
        productoNombre: producto.nombre,
        cantidad,
        unidad: producto.unidad,
        ultimaActualizacion: new Date(),
        stockMinimo,
        alertaBajo: cantidad < stockMinimo,
      }
    })
  }, [sheetsStock.rows, sheetsCompras.rows, sheetsVentas.rows])

  const handleAjusteManual = async () => {
    if (!ajusteForm.productoId || !ajusteForm.cantidad) return

    setSaving(true)
    try {
      const producto = PRODUCTOS.find((p) => p.id === ajusteForm.productoId)
      if (!producto) return

      const cantidadAjuste = Number.parseFloat(ajusteForm.cantidad)
      const stockItem = stockActual.find((s) => s.productoId === ajusteForm.productoId)
      const cantidadAnterior = stockItem?.cantidad || 0
      const cantidadFinal = ajusteForm.tipo === "entrada" 
        ? cantidadAnterior + cantidadAjuste 
        : cantidadAnterior - cantidadAjuste

      // Update Stock sheet
      const stockRow = sheetsStock.rows.find((r) => r.ProductoID === ajusteForm.productoId)
      if (stockRow) {
        // Would need update functionality - for now just add movement
      }

      // Add movement to StockMovimientos
      const movementValues = [
        [
          `ajuste-${Date.now()}`,
          new Date().toLocaleDateString("es-AR"),
          ajusteForm.productoId,
          producto.nombre,
          "ajuste",
          ajusteForm.tipo === "entrada" ? String(cantidadAjuste) : String(-cantidadAjuste),
          String(cantidadAnterior),
          String(cantidadFinal),
          "Ajuste manual",
          ajusteForm.observaciones || "",
        ],
      ]

      await addRow("StockMovimientos", movementValues)
      await sheetsStock.mutate()

      setAjusteForm({
        productoId: "",
        cantidad: "",
        tipo: "entrada",
        observaciones: "",
      })
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleExport = () => {
    const headers = ["Producto", "Cantidad", "Unidad", "Estado"]
    const csvRows = [headers.join(",")]
    stockActual.forEach((s) => {
      csvRows.push([
        s.productoNombre,
        String(s.cantidad),
        s.unidad,
        s.alertaBajo ? "Bajo" : "OK",
      ].join(","))
    })
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `stock_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Calculate analytics
  const totalStock = stockActual.reduce((acc, s) => acc + s.cantidad, 0)
  const productosAlerta = stockActual.filter((s) => s.alertaBajo).length

  // Calculate stock velocity (ventas por día últimos 7 días)
  const stockAnalytics = useMemo(() => {
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    
    const ventasRecientes = sheetsVentas.rows.filter((row) => {
      const fecha = new Date(row.Fecha || "")
      return fecha.getTime() >= sevenDaysAgo
    })

    const ventasPorProducto = new Map<ProductoTipo, number>()
    ventasRecientes.forEach((row) => {
      const productosStr = row.Productos || ""
      if (productosStr.includes(",")) {
        const parts = productosStr.split(",")
        parts.forEach((part) => {
          const match = part.trim().match(/^(\d+(?:\.\d+)?)\s*x?\s*(.+)$/i)
          if (match) {
            const qty = Number.parseFloat(match[1])
            const prodName = match[2].trim()
            const producto = PRODUCTOS.find((p) => p.nombre === prodName)
            if (producto) {
              const current = ventasPorProducto.get(producto.id) || 0
              ventasPorProducto.set(producto.id, current + qty)
            }
          }
        })
      } else {
        const match = productosStr.match(/^(\d+(?:\.\d+)?)\s*x?\s*(.+)$/i)
        if (match) {
          const qty = Number.parseFloat(match[1])
          const prodName = match[2].trim()
          const producto = PRODUCTOS.find((p) => p.nombre === prodName)
          if (producto) {
            const current = ventasPorProducto.get(producto.id) || 0
            ventasPorProducto.set(producto.id, current + qty)
          }
        }
      }
    })

    return PRODUCTOS.map((producto) => {
      const ventasSemana = ventasPorProducto.get(producto.id) || 0
      const ventasDiarias = ventasSemana / 7
      const stockItem = stockActual.find((s) => s.productoId === producto.id)
      const stockDisponible = stockItem?.cantidad || 0
      const diasRestantes = ventasDiarias > 0 ? stockDisponible / ventasDiarias : 999
      
      return {
        productoId: producto.id,
        productoNombre: producto.nombre,
        ventasSemana,
        ventasDiarias: ventasDiarias.toFixed(1),
        diasRestantes: Math.floor(diasRestantes),
        alerta: diasRestantes < 3 && diasRestantes > 0,
      }
    })
  }, [sheetsVentas.rows, stockActual])

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Inventario</h2>
          <p className="text-muted-foreground">Seguimiento de stock en tiempo real</p>
        </div>
        <SheetsStatus 
          isLoading={sheetsStock.isLoading} 
          error={sheetsStock.error} 
          isConnected={isConnected} 
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stock Total</p>
              <p className="text-2xl font-bold text-foreground">{totalStock.toFixed(0)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Productos</p>
              <p className="text-2xl font-bold text-foreground">{PRODUCTOS.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stock Bajo</p>
              <p className="text-2xl font-bold text-destructive">{productosAlerta}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <TrendingDown className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rotacion</p>
              <p className="text-2xl font-bold text-foreground">-</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ajuste Manual
        </Button>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Analytics & Alerts */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Proyección de Stock</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stockAnalytics.map((analytic) => (
            <div
              key={analytic.productoId}
              className={`rounded-lg border p-4 ${
                analytic.alerta ? "border-destructive/50 bg-destructive/5" : "bg-background"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">{analytic.productoNombre}</p>
                {analytic.alerta && (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Ventas/día</span>
                  <span className="font-medium">{analytic.ventasDiarias}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Días restantes</span>
                  <span className={`font-bold ${analytic.diasRestantes < 3 ? "text-destructive" : "text-foreground"}`}>
                    {analytic.diasRestantes > 99 ? "99+" : analytic.diasRestantes}
                  </span>
                </div>
              </div>
              {analytic.alerta && (
                <p className="mt-2 text-xs font-medium text-destructive">
                  ¡Reabastecer pronto!
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stock Table */}
      <div className="rounded-xl border bg-card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Stock Actual</h3>
          <div className="space-y-3">
            {stockActual.map((stock) => (
              <div
                key={stock.productoId}
                className={`flex items-center justify-between rounded-lg border p-4 ${
                  stock.alertaBajo ? "border-destructive/50 bg-destructive/5" : "bg-background"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{stock.productoNombre}</p>
                    <p className="text-sm text-muted-foreground">
                      Min: {stock.stockMinimo} {stock.unidad}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">
                      {stock.cantidad.toFixed(1)}
                    </p>
                    <p className="text-sm text-muted-foreground">{stock.unidad}</p>
                  </div>
                  {stock.alertaBajo && (
                    <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Bajo
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ajuste Manual Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste Manual de Stock</DialogTitle>
            <DialogDescription>Ajuste la cantidad de stock manualmente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Producto</Label>
              <Select
                value={ajusteForm.productoId}
                onValueChange={(v) => setAjusteForm({ ...ajusteForm, productoId: v as ProductoTipo })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTOS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} ({stockActual.find((s) => s.productoId === p.id)?.cantidad || 0} {p.unidad})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={ajusteForm.tipo}
                  onValueChange={(v) => setAjusteForm({ ...ajusteForm, tipo: v as "entrada" | "salida" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada (+)</SelectItem>
                    <SelectItem value="salida">Salida (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  value={ajusteForm.cantidad}
                  onChange={(e) => setAjusteForm({ ...ajusteForm, cantidad: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                value={ajusteForm.observaciones}
                onChange={(e) => setAjusteForm({ ...ajusteForm, observaciones: e.target.value })}
                placeholder="Motivo del ajuste..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAjusteManual}
              disabled={saving || !ajusteForm.productoId || !ajusteForm.cantidad}
            >
              {saving ? "Guardando..." : "Guardar Ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
