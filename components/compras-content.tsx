"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { DataTable } from "./data-table"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface Compra {
  id: string
  fecha: string
  proveedor_nombre: string
  producto: string
  cantidad: number
  precio_unitario: number
  total: number
  estado: string
}

export function ComprasContent() {
  const { data: compras = [], isLoading } = useSupabase<Compra>("compras")
  const [searchTerm, setSearchTerm] = useState("")

  const filteredCompras = compras.filter((c) =>
    c.proveedor_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.producto.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns = [
    { key: "fecha", header: "Fecha", render: (c: Compra) => formatDate(new Date(c.fecha)) },
    { key: "proveedor_nombre", header: "Proveedor" },
    { key: "producto", header: "Producto" },
    { key: "cantidad", header: "Cantidad" },
    { key: "precio_unitario", header: "Precio Unit.", render: (c: Compra) => formatCurrency(c.precio_unitario) },
    { key: "total", header: "Total", render: (c: Compra) => <span className="font-semibold">{formatCurrency(c.total)}</span> },
    { key: "estado", header: "Estado", render: (c: Compra) => (
      <Badge variant={c.estado === "pagado" ? "default" : "outline"}>
        {c.estado}
      </Badge>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar compras..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredCompras}
        emptyMessage={isLoading ? "Cargando..." : "No hay compras registradas"}
      />
    </div>
  )
}
