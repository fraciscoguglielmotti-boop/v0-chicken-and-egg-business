"use client"

import { useState } from "react"
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
import { NuevoCobroDialog } from "./nuevo-cobro-dialog"
import { cobrosIniciales } from "@/lib/store"
import type { Cobro } from "@/lib/types"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

const metodoPagoColors = {
  efectivo: "bg-primary/20 text-primary border-primary/30",
  transferencia: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  cheque: "bg-accent/20 text-accent-foreground border-accent/30",
}

const metodoPagoLabels = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
}

export function CobrosContent() {
  const [cobros, setCobros] = useState(cobrosIniciales)
  const [searchTerm, setSearchTerm] = useState("")
  const [metodoFilter, setMetodoFilter] = useState<string>("todos")
  const [dialogOpen, setDialogOpen] = useState(false)

  const filteredCobros = cobros.filter((cobro) => {
    const matchesSearch = cobro.clienteNombre
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    const matchesMetodo =
      metodoFilter === "todos" || cobro.metodoPago === metodoFilter
    return matchesSearch && matchesMetodo
  })

  const totalCobros = filteredCobros.reduce((acc, c) => acc + c.monto, 0)
  
  const cobrosPorMetodo = {
    efectivo: filteredCobros
      .filter((c) => c.metodoPago === "efectivo")
      .reduce((acc, c) => acc + c.monto, 0),
    transferencia: filteredCobros
      .filter((c) => c.metodoPago === "transferencia")
      .reduce((acc, c) => acc + c.monto, 0),
    cheque: filteredCobros
      .filter((c) => c.metodoPago === "cheque")
      .reduce((acc, c) => acc + c.monto, 0),
  }

  const handleNuevoCobro = (cobro: Cobro) => {
    setCobros([cobro, ...cobros])
    setDialogOpen(false)
  }

  const columns = [
    {
      key: "fecha",
      header: "Fecha",
      render: (cobro: Cobro) => (
        <span className="font-medium">{formatDate(cobro.fecha)}</span>
      ),
    },
    {
      key: "clienteNombre",
      header: "Cliente",
      render: (cobro: Cobro) => (
        <div>
          <p className="font-medium text-foreground">{cobro.clienteNombre}</p>
          {cobro.observaciones && (
            <p className="text-xs text-muted-foreground truncate max-w-xs">
              {cobro.observaciones}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "monto",
      header: "Monto",
      render: (cobro: Cobro) => (
        <span className="font-semibold text-primary">
          {formatCurrency(cobro.monto)}
        </span>
      ),
    },
    {
      key: "metodoPago",
      header: "Metodo",
      render: (cobro: Cobro) => (
        <Badge variant="outline" className={metodoPagoColors[cobro.metodoPago]}>
          {metodoPagoLabels[cobro.metodoPago]}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Cobrado</p>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(totalCobros)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Efectivo</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(cobrosPorMetodo.efectivo)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Transferencias</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(cobrosPorMetodo.transferencia)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Cheques</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(cobrosPorMetodo.cheque)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={metodoFilter} onValueChange={setMetodoFilter}>
            <SelectTrigger className="w-44">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Metodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="efectivo">Efectivo</SelectItem>
              <SelectItem value="transferencia">Transferencia</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Cobro
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredCobros}
        emptyMessage="No hay cobros registrados"
      />

      {/* Dialog */}
      <NuevoCobroDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleNuevoCobro}
      />
    </div>
  )
}
