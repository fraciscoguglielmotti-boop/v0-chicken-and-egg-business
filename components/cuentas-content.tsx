"use client"

import { useState, useMemo } from "react"
import { ArrowUpRight, ArrowDownRight, Search, Users, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { useSheet, type SheetRow } from "@/hooks/use-sheets"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-"
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

interface CuentaCliente {
  id: string
  nombre: string
  vendedor: string
  totalVentas: number
  totalCobros: number
  saldo: number
}

interface Movimiento {
  fecha: string
  tipo: "venta" | "cobro"
  descripcion: string
  debe: number
  haber: number
  saldoAcumulado: number
}

export function CuentasContent() {
  const sheetsVentas = useSheet("Ventas")
  const sheetsCobros = useSheet("Cobros")
  const sheetsCompras = useSheet("Compras")
  const [searchTerm, setSearchTerm] = useState("")
  const [vendedorFilter, setVendedorFilter] = useState<string>("todos")
  const [selectedCuenta, setSelectedCuenta] = useState<CuentaCliente | null>(null)
  const [tab, setTab] = useState("clientes")

  const isLoading = sheetsVentas.isLoading || sheetsCobros.isLoading
  const hasError = sheetsVentas.error || sheetsCobros.error
  const isConnected = !hasError && !isLoading

  // Extract unique vendors from sales
  const vendedores = useMemo(() => {
    const set = new Set<string>()
    sheetsVentas.rows.forEach((r) => {
      if (r.Vendedor) set.add(r.Vendedor)
    })
    sheetsCobros.rows.forEach((r) => {
      if (r.Vendedor) set.add(r.Vendedor)
    })
    return Array.from(set).sort()
  }, [sheetsVentas.rows, sheetsCobros.rows])

  // Calculate client balances from Ventas and Cobros
  const cuentasClientes: CuentaCliente[] = useMemo(() => {
    const map = new Map<string, CuentaCliente>()

    sheetsVentas.rows.forEach((r) => {
      const cliente = r.Cliente || r.ClienteID || ""
      if (!cliente || cliente === "-") return
      const key = cliente.toLowerCase().trim()
      const existing = map.get(key) || {
        id: r.ClienteID || cliente,
        nombre: cliente,
        vendedor: r.Vendedor || "",
        totalVentas: 0,
        totalCobros: 0,
        saldo: 0,
      }
      // Calculate total as Cantidad x PrecioUnitario
      const cant = Number(r.Cantidad) || 0
      const precio = Number(r.PrecioUnitario) || 0
      existing.totalVentas += cant * precio
      if (r.Vendedor && !existing.vendedor) existing.vendedor = r.Vendedor
      map.set(key, existing)
    })

    sheetsCobros.rows.forEach((r) => {
      const cliente = r.Cliente || r.ClienteID || ""
      if (!cliente || cliente === "-") return
      const key = cliente.toLowerCase().trim()
      const existing = map.get(key) || {
        id: r.ClienteID || cliente,
        nombre: cliente,
        vendedor: r.Vendedor || "",
        totalVentas: 0,
        totalCobros: 0,
        saldo: 0,
      }
      existing.totalCobros += Number(r.Monto) || 0
      if (r.Vendedor && !existing.vendedor) existing.vendedor = r.Vendedor
      map.set(key, existing)
    })

    return Array.from(map.values())
      .map((c) => ({ ...c, saldo: c.totalVentas - c.totalCobros }))
      .sort((a, b) => b.saldo - a.saldo)
  }, [sheetsVentas.rows, sheetsCobros.rows])

  // Calculate provider balances from Compras
  const cuentasProveedores = useMemo(() => {
    const map = new Map<string, { nombre: string; totalCompras: number; totalPagos: number; saldo: number }>()

    sheetsCompras.rows.forEach((r) => {
      const proveedor = r.Proveedor || r.ProveedorID || ""
      if (!proveedor) return
      const key = proveedor.toLowerCase().trim()
      const existing = map.get(key) || {
        nombre: proveedor,
        totalCompras: 0,
        totalPagos: 0,
        saldo: 0,
      }
      const cant = Number(r.Cantidad) || 0
      const precio = Number(r["Precio Unitario"] || r.PrecioUnitario) || 0
      existing.totalCompras += cant * precio
      map.set(key, existing)
    })

    return Array.from(map.values())
      .map((p) => ({ ...p, saldo: p.totalCompras - p.totalPagos }))
      .sort((a, b) => b.saldo - a.saldo)
  }, [sheetsCompras.rows])

  // Filter by search and vendor
  const filteredClientes = cuentasClientes.filter((c) => {
    const matchesSearch = c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesVendedor = vendedorFilter === "todos" || c.vendedor === vendedorFilter
    return matchesSearch && matchesVendedor
  })

  const filteredProveedores = cuentasProveedores.filter((p) =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPorCobrar = filteredClientes.reduce((acc, c) => acc + Math.max(c.saldo, 0), 0)
  const totalAFavor = filteredClientes.reduce((acc, c) => acc + Math.min(c.saldo, 0), 0)
  const totalPorPagar = filteredProveedores.reduce((acc, p) => acc + p.saldo, 0)

  // Build movements for selected client
  const movimientos: Movimiento[] = useMemo(() => {
    if (!selectedCuenta) return []
    const clienteKey = selectedCuenta.nombre.toLowerCase().trim()

    const entries: { fecha: string; tipo: "venta" | "cobro"; desc: string; monto: number }[] = []

    sheetsVentas.rows.forEach((r) => {
      const c = (r.Cliente || r.ClienteID || "").toLowerCase().trim()
      if (c === clienteKey) {
        const cant = Number(r.Cantidad) || 0
        const precio = Number(r.PrecioUnitario) || 0
        entries.push({
          fecha: r.Fecha || "",
          tipo: "venta",
          desc: `Venta - ${r.Productos || "Productos"} (${cant} x ${formatCurrency(precio)})`,
          monto: cant * precio,
        })
      }
    })

    sheetsCobros.rows.forEach((r) => {
      const c = (r.Cliente || r.ClienteID || "").toLowerCase().trim()
      if (c === clienteKey) {
        entries.push({
          fecha: r.Fecha || "",
          tipo: "cobro",
          desc: `Cobro - ${r.MetodoPago || "Pago"}`,
          monto: Number(r.Monto) || 0,
        })
      }
    })

    // Sort by date ascending for running balance
    entries.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

    let saldoAcum = 0
    return entries.map((e) => {
      const debe = e.tipo === "venta" ? e.monto : 0
      const haber = e.tipo === "cobro" ? e.monto : 0
      saldoAcum += debe - haber
      return {
        fecha: e.fecha,
        tipo: e.tipo,
        descripcion: e.desc,
        debe,
        haber,
        saldoAcumulado: saldoAcum,
      }
    })
  }, [selectedCuenta, sheetsVentas.rows, sheetsCobros.rows])

  const clienteColumns = [
    {
      key: "nombre",
      header: "Cliente",
      render: (c: CuentaCliente) => (
        <div>
          <p className="font-medium text-foreground">{c.nombre}</p>
          {c.vendedor && <p className="text-xs text-muted-foreground">Vendedor: {c.vendedor}</p>}
        </div>
      ),
    },
    {
      key: "totalVentas",
      header: "Ventas",
      render: (c: CuentaCliente) => <span className="text-sm">{formatCurrency(c.totalVentas)}</span>,
    },
    {
      key: "totalCobros",
      header: "Cobros",
      render: (c: CuentaCliente) => <span className="text-sm">{formatCurrency(c.totalCobros)}</span>,
    },
    {
      key: "saldo",
      header: "Saldo",
      render: (c: CuentaCliente) => (
        <span className={`font-bold ${c.saldo > 0 ? "text-destructive" : c.saldo < 0 ? "text-primary" : "text-muted-foreground"}`}>
          {formatCurrency(c.saldo)}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (c: CuentaCliente) =>
        c.saldo > 0 ? (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Debe</Badge>
        ) : c.saldo < 0 ? (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">A favor</Badge>
        ) : (
          <Badge variant="outline">Al dia</Badge>
        ),
    },
    {
      key: "acciones",
      header: "",
      render: (c: CuentaCliente) => (
        <Button variant="ghost" size="sm" onClick={() => setSelectedCuenta(c)}>
          Detalle
        </Button>
      ),
    },
  ]

  const proveedorColumns = [
    {
      key: "nombre",
      header: "Proveedor",
      render: (p: { nombre: string }) => <span className="font-medium">{p.nombre}</span>,
    },
    {
      key: "totalCompras",
      header: "Compras",
      render: (p: { totalCompras: number }) => <span className="text-sm">{formatCurrency(p.totalCompras)}</span>,
    },
    {
      key: "totalPagos",
      header: "Pagos",
      render: (p: { totalPagos: number }) => <span className="text-sm">{formatCurrency(p.totalPagos)}</span>,
    },
    {
      key: "saldo",
      header: "Saldo",
      render: (p: { saldo: number }) => (
        <span className={`font-bold ${p.saldo > 0 ? "text-destructive" : "text-muted-foreground"}`}>
          {formatCurrency(p.saldo)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <ArrowUpRight className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">Por Cobrar</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-destructive">{formatCurrency(totalPorCobrar)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ArrowDownRight className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">A Favor Clientes</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(Math.abs(totalAFavor))}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <ArrowDownRight className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">Por Pagar Proveedores</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-destructive">{formatCurrency(totalPorPagar)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Cuentas Activas</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{cuentasClientes.length}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar cuenta..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        {vendedores.length > 0 && (
          <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
            <SelectTrigger className="w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los vendedores</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <SheetsStatus isLoading={isLoading} error={hasError} isConnected={isConnected} />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => { setTab(v); setSelectedCuenta(null) }}>
        <TabsList>
          <TabsTrigger value="clientes">Clientes ({filteredClientes.length})</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores ({filteredProveedores.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-4">
          {selectedCuenta ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{selectedCuenta.nombre}</h3>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>Ventas: {formatCurrency(selectedCuenta.totalVentas)}</span>
                    <span>Cobros: {formatCurrency(selectedCuenta.totalCobros)}</span>
                    <span className={`font-semibold ${selectedCuenta.saldo > 0 ? "text-destructive" : "text-primary"}`}>
                      Saldo: {formatCurrency(selectedCuenta.saldo)}
                    </span>
                  </div>
                  {selectedCuenta.vendedor && (
                    <p className="text-xs text-muted-foreground">Vendedor: {selectedCuenta.vendedor}</p>
                  )}
                </div>
                <Button variant="outline" onClick={() => setSelectedCuenta(null)}>Volver al listado</Button>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fecha</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Descripcion</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Debe</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Haber</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          Sin movimientos registrados para este cliente
                        </td>
                      </tr>
                    ) : (
                      movimientos.map((mov, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-2.5">{formatDate(mov.fecha)}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className={mov.tipo === "venta" ? "bg-accent/10 text-accent-foreground" : "bg-primary/10 text-primary"}>
                              {mov.tipo === "venta" ? "Venta" : "Cobro"}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{mov.descripcion}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{mov.debe > 0 ? formatCurrency(mov.debe) : "-"}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-primary">{mov.haber > 0 ? formatCurrency(mov.haber) : "-"}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${mov.saldoAcumulado > 0 ? "text-destructive" : "text-primary"}`}>
                            {formatCurrency(mov.saldoAcumulado)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <DataTable columns={clienteColumns} data={filteredClientes} emptyMessage={isLoading ? "Cargando cuentas..." : "No hay cuentas corrientes. Registra ventas y cobros para ver los saldos."} />
          )}
        </TabsContent>

        <TabsContent value="proveedores">
          <DataTable columns={proveedorColumns} data={filteredProveedores} emptyMessage="No hay cuentas de proveedores" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
