"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { DataTable } from "./data-table"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface Cobro {
  id: string
  fecha: string
  cliente_nombre: string
  monto: number
  metodo_pago?: string
  observaciones?: string
  verificado_agroaves: boolean
}

export function CobrosContent() {
  const { data: cobros = [], isLoading } = useSupabase<Cobro>("cobros")
  const [searchTerm, setSearchTerm] = useState("")

  const filteredCobros = cobros.filter((c) =>
    c.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns = [
    { key: "fecha", header: "Fecha", render: (c: Cobro) => formatDate(new Date(c.fecha)) },
    { key: "cliente_nombre", header: "Cliente" },
    { key: "monto", header: "Monto", render: (c: Cobro) => <span className="font-semibold text-primary">{formatCurrency(Number(c.monto))}</span> },
    { key: "metodo_pago", header: "Metodo", render: (c: Cobro) => <span className="capitalize">{c.metodo_pago || "-"}</span> },
    { key: "verificado_agroaves", header: "Verificado", render: (c: Cobro) => (
      <Badge variant={c.verificado_agroaves ? "default" : "outline"}>
        {c.verificado_agroaves ? "Si" : "No"}
      </Badge>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cobros..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredCobros}
        emptyMessage={isLoading ? "Cargando..." : "No hay cobros registrados"}
      />
    </div>
  )
}
