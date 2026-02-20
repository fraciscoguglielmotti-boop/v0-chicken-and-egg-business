"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { DataTable } from "./data-table"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Venta {
  id: string
  fecha: string
  cliente_nombre: string
  productos: any
  cantidad: number
  precio_unitario: number
  vendedor?: string
}

export function VentasContent() {
  const { data: ventas = [], isLoading } = useSupabase<Venta>("ventas")
  const [searchTerm, setSearchTerm] = useState("")

  const filteredVentas = ventas.filter((v) =>
    v.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns = [
    { key: "fecha", header: "Fecha", render: (v: Venta) => formatDate(new Date(v.fecha)) },
    { key: "cliente_nombre", header: "Cliente" },
    { key: "cantidad", header: "Cantidad" },
    { key: "precio_unitario", header: "Precio Unit.", render: (v: Venta) => formatCurrency(v.precio_unitario) },
    { key: "total", header: "Total", render: (v: Venta) => <span className="font-semibold">{formatCurrency(v.cantidad * v.precio_unitario)}</span> },
    { key: "vendedor", header: "Vendedor", render: (v: Venta) => v.vendedor || "-" },
  ]

  return (
    <div className="space-y-6">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar ventas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredVentas}
        emptyMessage={isLoading ? "Cargando..." : "No hay ventas registradas"}
      />
    </div>
  )
}
