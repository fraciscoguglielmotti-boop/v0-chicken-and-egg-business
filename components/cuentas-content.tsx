"use client"

import { useState, useMemo } from "react"
import { ArrowUpRight, ArrowDownRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "./data-table"
import { SheetsStatus } from "./sheets-status"
import { useSheet, type SheetRow } from "@/hooks/use-sheets"
import {
  clientesIniciales,
  proveedoresIniciales,
} from "@/lib/store"
import type { Cliente, Proveedor } from "@/lib/types"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

function rowToCliente(row: SheetRow, index: number): Cliente {
  return {
    id: row.ID || String(index),
    nombre: row.Nombre || "",
    cuit: row.CUIT || undefined,
    saldoActual: Number(row.Saldo) || 0,
    createdAt: new Date(row.FechaAlta || Date.now()),
  }
}

function rowToProveedor(row: SheetRow, index: number): Proveedor {
  return {
    id: row.ID || String(index),
    nombre: row.Nombre || "",
    cuit: row.CUIT || undefined,
    saldoActual: Number(row.Saldo) || 0,
    createdAt: new Date(row.FechaAlta || Date.now()),
  }
}

interface Movimiento {
  id: string
  fecha: Date | string
  tipo: "venta" | "cobro" | "compra" | "pago"
  descripcion: string
  debe: number
  haber: number
}

export function CuentasContent() {
  const sheetsClientes = useSheet("Clientes")
  const sheetsProveedores = useSheet("Proveedores")
  const sheetsVentas = useSheet("Ventas")
  const sheetsCobros = useSheet("Cobros")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)

  const isLoading = sheetsClientes.isLoading || sheetsProveedores.isLoading
  const hasError = sheetsClientes.error || sheetsProveedores.error
  const isConnected = !hasError && !isLoading

  const clientes: Cliente[] = useMemo(() => {
    if (isConnected && sheetsClientes.rows.length > 0) {
      return sheetsClientes.rows.map(rowToCliente)
    }
    return clientesIniciales
  }, [isConnected, sheetsClientes.rows])

  const proveedores: Proveedor[] = useMemo(() => {
    if (isConnected && sheetsProveedores.rows.length > 0) {
      return sheetsProveedores.rows.map(rowToProveedor)
    }
    return proveedoresIniciales
  }, [isConnected, sheetsProveedores.rows])

  const totalPorCobrar = clientes.reduce((acc, c) => acc + c.saldoActual, 0)
  const totalPorPagar = proveedores.reduce((acc, p) => acc + p.saldoActual, 0)

  const filteredClientes = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const filteredProveedores = proveedores.filter((p) =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Build movements for selected client
  const movimientos: Movimiento[] = useMemo(() => {
    if (!selectedCliente) return []
    const ventas = sheetsVentas.rows
      .filter((r) => r.ClienteID === selectedCliente.id)
      .map((r, i) => ({
        id: `v-${i}`,
        fecha: r.Fecha || "",
        tipo: "venta" as const,
        descripcion: `Venta - ${r.Productos || "Productos"}`,
        debe: Number(r.Total) || 0,
        haber: 0,
      }))
    const cobros = sheetsCobros.rows
      .filter((r) => r.ClienteID === selectedCliente.id)
      .map((r, i) => ({
        id: `c-${i}`,
        fecha: r.Fecha || "",
        tipo: "cobro" as const,
        descripcion: `Cobro - ${r.MetodoPago || ""}`,
        debe: 0,
        haber: Number(r.Monto) || 0,
      }))
    return [...ventas, ...cobros].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    )
  }, [selectedCliente, sheetsVentas.rows, sheetsCobros.rows])

  const clienteColumns = [
    {
      key: "nombre",
      header: "Cliente",
      render: (c: Cliente) => <span className="font-medium">{c.nombre}</span>,
    },
    {
      key: "saldoActual",
      header: "Saldo",
      render: (c: Cliente) => (
        <span className={c.saldoActual > 0 ? "font-semibold text-primary" : "text-muted-foreground"}>
          {formatCurrency(c.saldoActual)}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (c: Cliente) =>
        c.saldoActual > 0 ? (
          <Badge variant="outline" className="bg-accent/20 text-accent-foreground border-accent/30">Deudor</Badge>
        ) : (
          <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">Al dia</Badge>
        ),
    },
    {
      key: "acciones",
      header: "",
      render: (c: Cliente) => (
        <Button variant="ghost" size="sm" onClick={() => setSelectedCliente(c)}>
          Ver movimientos
        </Button>
      ),
    },
  ]

  const proveedorColumns = [
    {
      key: "nombre",
      header: "Proveedor",
      render: (p: Proveedor) => <span className="font-medium">{p.nombre}</span>,
    },
    {
      key: "saldoActual",
      header: "Deuda",
      render: (p: Proveedor) => (
        <span className={p.saldoActual > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>
          {formatCurrency(p.saldoActual)}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (p: Proveedor) =>
        p.saldoActual > 0 ? (
          <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">Pendiente</Badge>
        ) : (
          <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">Pagado</Badge>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ArrowUpRight className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Por Cobrar</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(totalPorCobrar)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <ArrowDownRight className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">Por Pagar</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-destructive">{formatCurrency(totalPorPagar)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Clientes con Deuda</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{clientes.filter((c) => c.saldoActual > 0).length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Balance</p>
          <p className={`mt-2 text-2xl font-bold ${totalPorCobrar - totalPorPagar >= 0 ? "text-primary" : "text-destructive"}`}>
            {formatCurrency(totalPorCobrar - totalPorPagar)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar cuenta..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <SheetsStatus isLoading={isLoading} error={hasError} isConnected={isConnected} />
      </div>

      <Tabs defaultValue="clientes">
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-4">
          {selectedCliente ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selectedCliente.nombre}</h3>
                  <p className="text-sm text-muted-foreground">
                    Saldo actual: <span className="font-semibold text-primary">{formatCurrency(selectedCliente.saldoActual)}</span>
                  </p>
                </div>
                <Button variant="outline" onClick={() => setSelectedCliente(null)}>Volver</Button>
              </div>
              <div className="rounded-lg border">
                <div className="grid grid-cols-5 gap-2 border-b bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground">
                  <div>Fecha</div>
                  <div className="col-span-2">Descripcion</div>
                  <div className="text-right">Debe</div>
                  <div className="text-right">Haber</div>
                </div>
                {movimientos.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Sin movimientos registrados</div>
                ) : (
                  movimientos.map((mov) => (
                    <div key={mov.id} className="grid grid-cols-5 gap-2 items-center border-b last:border-0 px-4 py-3 text-sm">
                      <div>{formatDate(mov.fecha)}</div>
                      <div className="col-span-2">{mov.descripcion}</div>
                      <div className="text-right font-medium text-foreground">{mov.debe > 0 ? formatCurrency(mov.debe) : "-"}</div>
                      <div className="text-right font-medium text-primary">{mov.haber > 0 ? formatCurrency(mov.haber) : "-"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <DataTable columns={clienteColumns} data={filteredClientes} emptyMessage="No hay clientes" />
          )}
        </TabsContent>

        <TabsContent value="proveedores">
          <DataTable columns={proveedorColumns} data={filteredProveedores} emptyMessage="No hay proveedores" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
