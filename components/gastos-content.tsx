"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { DataTable } from "./data-table"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Gasto {
  id: string
  fecha: string
  tipo: string
  categoria: string
  descripcion?: string
  monto: number
  medio_pago?: string
}

export function GastosContent() {
  const { data: gastos = [], isLoading } = useSupabase<Gasto>("gastos")
  const [searchTerm, setSearchTerm] = useState("")

  const filteredGastos = gastos.filter((g) =>
    g.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.descripcion || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns = [
    { key: "fecha", header: "Fecha", render: (g: Gasto) => formatDate(new Date(g.fecha)) },
    { key: "categoria", header: "Categoria" },
    { key: "descripcion", header: "Descripcion", render: (g: Gasto) => g.descripcion || "-" },
    { key: "monto", header: "Monto", render: (g: Gasto) => <span className="font-semibold text-destructive">{formatCurrency(g.monto)}</span> },
    { key: "medio_pago", header: "Medio Pago", render: (g: Gasto) => g.medio_pago || "-" },
  ]

  return (
    <div className="space-y-6">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar gastos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredGastos}
        emptyMessage={isLoading ? "Cargando..." : "No hay gastos registrados"}
      />
    </div>
  )
}
