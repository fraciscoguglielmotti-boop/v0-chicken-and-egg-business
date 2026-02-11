"use client"

import { useState, useMemo } from "react"
import { Plus, Filter, Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "./data-table"
import { SheetsStatus } from "./sheets-status"
import { useSheet, addRow, type SheetRow } from "@/hooks/use-sheets"
import { ventasIniciales } from "@/lib/store"
import type { Venta, VentaConVendedor, VentaItem, ProductoTipo } from "@/lib/types"
import { NuevaVentaDialog } from "./nueva-venta-dialog"
import { formatCurrency, formatDate, formatDateForSheets, parseDate, parseSheetNumber, resolveEntityName, resolveVentaMonto } from "@/lib/utils"

function sheetRowToVenta(row: SheetRow, _index: number, clienteLookup: SheetRow[]): VentaConVendedor {
  // Debug: log first 3 rows to see exact data structure
  if (_index < 3) {
    console.log(`[v0] Ventas row ${_index} keys:`, Object.keys(row))
    console.log(`[v0] Ventas row ${_index} RAW values:`, {
      ID: row.ID,
      Cantidad: row.Cantidad,
      PrecioUnitario: row.PrecioUnitario,
      Precio: row.Precio,
      Total: row.Total,
      Cliente: row.Cliente,
    })
  }
  const { cantidad, precioUnitario: effectivePrecio, total } = resolveVentaMonto(row)

  // Parse Productos field
  const productosStr = row.Productos || ""
  const items: VentaItem[] = []

  if (productosStr.includes(",")) {
    const productParts = productosStr.split(",").map((p) => p.trim())
    productParts.forEach((part) => {
      const match = part.match(/^(\d+(?:\.\d+)?)\s*x?\s*(.+)$/i)
      if (match) {
        const qty = Number.parseFloat(match[1])
        const prodName = match[2].trim()
        items.push({
          productoId: prodName.toLowerCase().replace(/\s+/g, "_") as ProductoTipo,
          productoNombre: prodName,
          cantidad: qty,
          precioUnitario: effectivePrecio,
          subtotal: (qty / cantidad) * total,
        })
      }
    })
  } else if (productosStr) {
    const match = productosStr.match(/^(\d+(?:\.\d+)?)\s*x?\s*(.+)$/i)
    if (match) {
      items.push({
        productoId: match[2].trim().toLowerCase().replace(/\s+/g, "_") as ProductoTipo,
        productoNombre: match[2].trim(),
        cantidad: Number.parseFloat(match[1]),
        precioUnitario: effectivePrecio,
        subtotal: total,
      })
    } else {
      items.push({
        productoId: "producto" as ProductoTipo,
        productoNombre: productosStr,
        cantidad,
        precioUnitario: effectivePrecio,
        subtotal: total,
      })
    }
  }

  if (items.length === 0) {
    items.push({
      productoId: "producto" as ProductoTipo,
      productoNombre: "Producto",
      cantidad,
      precioUnitario: effectivePrecio,
      subtotal: total,
    })
  }

  // Only mark as "pagada" if total is 0 AND there's no quantity (truly empty)
  // Otherwise default to "pendiente" - the real estado is calculated from cobros
  const estado: Venta["estado"] = (total === 0 && cantidad === 0) ? "pagada" : "pendiente"

  // Resolve client name using lookup table (handles ID/name swaps from manual entry)
  const clienteNombre = resolveEntityName(row.Cliente || "", row.ClienteID || "", clienteLookup)
  const fecha = parseDate(row.Fecha || "")

  return {
    id: row.ID || `temp-${fecha.getTime()}-${clienteNombre.slice(0, 5)}-${total}`,
    fecha,
    clienteId: clienteNombre,
    clienteNombre,
    items,
    total,
    estado,
    createdAt: fecha,
    vendedor: row.Vendedor || "",
  }
}

export function VentasContent() {
  const { rows, isLoading, error, mutate } = useSheet("Ventas")
  const sheetsCobros = useSheet("Cobros")
  const sheetsClientes = useSheet("Clientes")
  const [localVentas, setLocalVentas] = useState(ventasIniciales)
  const [searchTerm, setSearchTerm] = useState("")
  const [estadoFilter, setEstadoFilter] = useState<string>("todos")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const isConnected = !error && !isLoading && rows.length >= 0

  // Calculate estado per client: compare total ventas vs total cobros
  const clienteEstados = useMemo(() => {
    const ventasPorCliente = new Map<string, number>()
    const cobrosPorCliente = new Map<string, number>()

    rows.forEach((r) => {
      const cliente = resolveEntityName(r.Cliente || "", r.ClienteID || "", sheetsClientes.rows).toLowerCase().trim()
      if (!cliente) return
      const { total: totalFila } = resolveVentaMonto(r)
      ventasPorCliente.set(cliente, (ventasPorCliente.get(cliente) || 0) + totalFila)
    })

    sheetsCobros.rows.forEach((r) => {
      const cliente = resolveEntityName(r.Cliente || "", r.ClienteID || "", sheetsClientes.rows).toLowerCase().trim()
      if (!cliente) return
      cobrosPorCliente.set(cliente, (cobrosPorCliente.get(cliente) || 0) + parseSheetNumber(r.Monto))
    })

    const estados = new Map<string, Venta["estado"]>()
    ventasPorCliente.forEach((totalVentas, cliente) => {
      const totalCobros = cobrosPorCliente.get(cliente) || 0
      if (totalCobros >= totalVentas) {
        estados.set(cliente, "pagada")
      } else if (totalCobros > 0) {
        estados.set(cliente, "parcial")
      } else {
        estados.set(cliente, "pendiente")
      }
    })
    return estados
  }, [rows, sheetsCobros.rows, sheetsClientes.rows])

  const ventas: VentaConVendedor[] = useMemo(() => {
    if (isConnected && rows.length > 0) {
      return rows.map((row, i) => {
        const venta = sheetRowToVenta(row, i, sheetsClientes.rows)
        // Override estado with calculated one
        const clienteKey = resolveEntityName(row.Cliente || "", row.ClienteID || "", sheetsClientes.rows).toLowerCase().trim()
        const calculatedEstado = clienteEstados.get(clienteKey)
        if (calculatedEstado) {
          venta.estado = calculatedEstado
        }
        return venta
      })
    }
    return localVentas.map((v) => ({ ...v, vendedor: "" }))
  }, [isConnected, rows, localVentas, sheetsClientes.rows, clienteEstados])

  const filteredVentas = ventas.filter((venta) => {
    const matchesSearch = venta.clienteNombre
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    const matchesEstado =
      estadoFilter === "todos" || venta.estado === estadoFilter
    return matchesSearch && matchesEstado
  })

  const handleExportar = () => {
    const headers = ["Fecha", "Cliente", "Productos", "Cantidad", "Precio Unitario", "Total", "Estado", "Vendedor"]
    const csvRows = [headers.join(",")]
    filteredVentas.forEach((v) => {
      const items = v.items.map((i) => `${i.cantidad} ${i.productoNombre}`).join(" / ")
      csvRows.push([
        formatDate(v.fecha),
        `"${v.clienteNombre}"`,
        `"${items}"`,
        String(v.items.reduce((a, i) => a + i.cantidad, 0)),
        String(v.items.length > 0 ? v.items[0].precioUnitario : 0),
        String(v.total),
        v.estado,
        v.vendedor || "",
      ].join(","))
    })
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ventas_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalVentas = filteredVentas.reduce((acc, v) => acc + v.total, 0)
  const ventasPendientes = filteredVentas.filter(
    (v) => v.estado === "pendiente"
  ).length

  const handleNuevaVenta = async (venta: Venta & { vendedor?: string }) => {
    setSaving(true)
    try {
      const productos = venta.items
        .map((i) => `${i.cantidad} ${i.productoNombre}`)
        .join(", ")

      const cantidadTotal = venta.items.reduce((a, i) => a + i.cantidad, 0)
      const precioPromedio = venta.items.length > 0 ? venta.items[0].precioUnitario : 0

      // Columns: ID, Fecha, ClienteID, Cliente, Productos, Cantidad, PrecioUnitario, Vendedor
      // Leave ID empty - Sheets will auto-generate sequential IDs (1, 2, 3...)
      // ClienteID = internal ID, Cliente = display name (NOMBRE)
      const sheetValues = [
        [
          "", // Empty ID - let Sheets auto-increment
          formatDateForSheets(venta.fecha),
          venta.clienteNombre, // Use nombre as ClienteID for consistency
          venta.clienteNombre, // Cliente name
          productos,
          String(cantidadTotal),
          String(precioPromedio),
          venta.vendedor || "",
        ],
      ]

      await addRow("Ventas", sheetValues)
      await mutate()
    } catch {
      setLocalVentas((prev) => [venta, ...prev])
    } finally {
      setSaving(false)
      setDialogOpen(false)
    }
  }

  const estadoColors = {
    pendiente: "bg-accent/20 text-accent-foreground border-accent/30",
    pagada: "bg-primary/20 text-primary border-primary/30",
    parcial: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  }

  const estadoLabels = {
    pendiente: "Pendiente",
    pagada: "Pagada",
    parcial: "Parcial",
  }

  const columns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (venta: VentaConVendedor) => (
        <span className="font-medium">{formatDate(venta.fecha)}</span>
      ),
    },
    {
      key: "clienteNombre",
      header: "Cliente",
      render: (venta: VentaConVendedor) => (
        <p className="font-medium text-foreground">{venta.clienteNombre}</p>
      ),
    },
    {
      key: "items",
      header: "Productos",
      render: (venta: VentaConVendedor) => {
        const totalProductos = venta.items.reduce((a, i) => a + i.cantidad, 0)
        return (
          <div className="max-w-xs space-y-0.5">
            {venta.items.slice(0, 2).map((item, idx) => (
              <p key={idx} className="text-sm text-foreground">
                {item.cantidad} x {item.productoNombre}
              </p>
            ))}
            {venta.items.length > 2 && (
              <p className="text-xs text-muted-foreground">+{venta.items.length - 2} más</p>
            )}
          </div>
        )
      },
    },
    {
      key: "cantidad",
      header: "Cant.",
      render: (venta: VentaConVendedor) => (
        <span className="text-sm">{venta.items.reduce((a, i) => a + i.cantidad, 0)}</span>
      ),
    },
    {
      key: "precio",
      header: "P. Unit.",
      render: (venta: VentaConVendedor) => (
        <span className="text-sm text-muted-foreground">
          {venta.items[0] ? formatCurrency(venta.items[0].precioUnitario) : "-"}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      render: (venta: VentaConVendedor) => (
        <span className="font-semibold text-foreground">
          {formatCurrency(venta.total)}
        </span>
      ),
    },
    {
      key: "vendedor",
      header: "Vendedor",
      render: (venta: VentaConVendedor) => (
        <span className="text-sm text-muted-foreground">{venta.vendedor || "-"}</span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (venta: VentaConVendedor) => (
        <Badge variant="outline" className={estadoColors[venta.estado]}>
          {estadoLabels[venta.estado]}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Ventas</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(totalVentas)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Cantidad</p>
          <p className="text-2xl font-bold text-foreground">
            {filteredVentas.length}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pendientes</p>
          <p className="text-2xl font-bold text-accent">{ventasPendientes}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-40">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="pagada">Pagada</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
            </SelectContent>
          </Select>
          <SheetsStatus isLoading={isLoading} error={error} isConnected={isConnected} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportar}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={saving}>
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Guardando..." : "Nueva Venta"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredVentas}
        emptyMessage={isLoading ? "Cargando ventas..." : "No hay ventas registradas"}
      />

      <NuevaVentaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleNuevaVenta}
      />
    </div>
  )
}
