"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { DataTable } from "./data-table"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Pago {
  id: string
  fecha: string
  proveedor_nombre: string
  monto: number
  metodo_pago?: string
  observaciones?: string
}

export function PagosContent() {
  const { data: pagos = [], isLoading } = useSupabase<Pago>("pagos")
  const [searchTerm, setSearchTerm] = useState("")

  const filteredPagos = pagos.filter((p) =>
    p.proveedor_nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns = [
    { key: "fecha", header: "Fecha", render: (p: Pago) => formatDate(new Date(p.fecha)) },
    { key: "proveedor_nombre", header: "Proveedor" },
    { key: "monto", header: "Monto", render: (p: Pago) => <span className="font-semibold text-destructive">{formatCurrency(Number(p.monto))}</span> },
    { key: "metodo_pago", header: "Metodo", render: (p: Pago) => p.metodo_pago || "-" },
  ]

  return (
    <div className="space-y-6">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar pagos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredPagos}
        emptyMessage={isLoading ? "Cargando..." : "No hay pagos registrados"}
      />
    </div>
  )
}
