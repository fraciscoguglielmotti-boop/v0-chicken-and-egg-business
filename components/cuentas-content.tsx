"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface Cliente {
  id: string
  nombre: string
  saldo_inicial: number
}

interface Venta {
  id: string
  fecha: string
  cliente_nombre: string
  cantidad: number
  precio_unitario: number
  productos: any
}

interface Cobro {
  id: string
  fecha: string
  cliente_nombre: string
  monto: number
}

type Movimiento = {
  fecha: string
  tipo: 'venta' | 'cobro' | 'saldo_inicial'
  descripcion: string
  debe: number
  haber: number
}

export function CuentasContent() {
  const { data: clientes = [] } = useSupabase<Cliente>("clientes")
  const { data: ventas = [] } = useSupabase<Venta>("ventas")
  const { data: cobros = [] } = useSupabase<Cobro>("cobros")
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())

  const clientesConMovimientos = useMemo(() => {
    const clientesMap = new Map<string, { nombre: string; saldo: number; movimientos: Movimiento[] }>()

    // Inicializar clientes con saldo inicial
    clientes.forEach((c) => {
      const key = c.nombre.toLowerCase().trim()
      const movimientos: Movimiento[] = []
      
      if (c.saldo_inicial && c.saldo_inicial !== 0) {
        movimientos.push({
          fecha: new Date().toISOString(),
          tipo: 'saldo_inicial',
          descripcion: 'Saldo inicial',
          debe: c.saldo_inicial > 0 ? c.saldo_inicial : 0,
          haber: c.saldo_inicial < 0 ? Math.abs(c.saldo_inicial) : 0
        })
      }

      clientesMap.set(key, { 
        nombre: c.nombre, 
        saldo: c.saldo_inicial || 0,
        movimientos
      })
    })

    // Agregar ventas
    ventas.forEach((v) => {
      const key = v.cliente_nombre.toLowerCase().trim()
      const total = v.cantidad * v.precio_unitario
      const producto = v.productos?.nombre || v.productos?.descripcion || 'Producto'
      
      if (!clientesMap.has(key)) {
        clientesMap.set(key, { nombre: v.cliente_nombre, saldo: 0, movimientos: [] })
      }
      
      const cliente = clientesMap.get(key)!
      cliente.saldo += total
      cliente.movimientos.push({
        fecha: v.fecha,
        tipo: 'venta',
        descripcion: `Venta: ${producto} (${v.cantidad} x ${formatCurrency(v.precio_unitario)})`,
        debe: total,
        haber: 0
      })
    })

    // Agregar cobros
    cobros.forEach((c) => {
      const key = c.cliente_nombre.toLowerCase().trim()
      const cliente = clientesMap.get(key)
      
      if (cliente) {
        cliente.saldo -= Number(c.monto)
        cliente.movimientos.push({
          fecha: c.fecha,
          tipo: 'cobro',
          descripcion: 'Cobro',
          debe: 0,
          haber: Number(c.monto)
        })
      }
    })

    // Ordenar movimientos por fecha
    clientesMap.forEach((cliente) => {
      cliente.movimientos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    })

    return Array.from(clientesMap.values()).sort((a, b) => b.saldo - a.saldo)
  }, [ventas, cobros, clientes])

  const toggleClient = (nombre: string) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nombre)) {
        newSet.delete(nombre)
      } else {
        newSet.add(nombre)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Cuentas Corrientes</h2>
      
      <div className="space-y-2">
        {clientesConMovimientos.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            No hay datos de cuentas corrientes
          </div>
        ) : (
          clientesConMovimientos.map((cliente) => (
            <Collapsible key={cliente.nombre} open={expandedClients.has(cliente.nombre)}>
              <div className="rounded-lg border bg-card">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-4 h-auto hover:bg-muted/50"
                    onClick={() => toggleClient(cliente.nombre)}
                  >
                    <div className="flex items-center gap-4">
                      {expandedClients.has(cliente.nombre) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{cliente.nombre}</span>
                    </div>
                    <Badge variant={cliente.saldo > 0 ? "destructive" : cliente.saldo < 0 ? "default" : "outline"}>
                      {formatCurrency(cliente.saldo)}
                    </Badge>
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="border-t">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr className="text-xs">
                          <th className="text-left p-2 font-medium">Fecha</th>
                          <th className="text-left p-2 font-medium">Descripción</th>
                          <th className="text-right p-2 font-medium">Debe</th>
                          <th className="text-right p-2 font-medium">Haber</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cliente.movimientos.map((mov, idx) => (
                          <tr key={idx} className="border-t text-sm">
                            <td className="p-2 text-muted-foreground">{formatDate(new Date(mov.fecha))}</td>
                            <td className="p-2">{mov.descripcion}</td>
                            <td className="p-2 text-right text-destructive">{mov.debe > 0 ? formatCurrency(mov.debe) : '-'}</td>
                            <td className="p-2 text-right text-green-600">{mov.haber > 0 ? formatCurrency(mov.haber) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))
        )}
      </div>
    </div>
  )
}
