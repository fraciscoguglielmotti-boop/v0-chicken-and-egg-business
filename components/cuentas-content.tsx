"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Download, Calendar } from "lucide-react"
import { useSupabase } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import jsPDF from "jspdf"

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
  const [dateRange, setDateRange] = useState({
    desde: "",
    hasta: ""
  })

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

    // Filtrar por rango de fechas si está definido
    if (dateRange.desde || dateRange.hasta) {
      const desde = dateRange.desde ? new Date(dateRange.desde) : new Date(0)
      const hasta = dateRange.hasta ? new Date(dateRange.hasta) : new Date()
      
      clientesMap.forEach((cliente) => {
        cliente.movimientos = cliente.movimientos.filter(m => {
          const fecha = new Date(m.fecha)
          return fecha >= desde && fecha <= hasta
        })
        
        // Recalcular saldo basado en movimientos filtrados
        cliente.saldo = cliente.movimientos.reduce((acc, m) => acc + m.debe - m.haber, 0)
      })
    }

    // Ordenar movimientos por fecha
    clientesMap.forEach((cliente) => {
      cliente.movimientos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    })

    return Array.from(clientesMap.values()).sort((a, b) => b.saldo - a.saldo)
  }, [ventas, cobros, clientes, dateRange])

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

  const exportToPDF = (cliente: typeof clientesConMovimientos[0]) => {
    const doc = new jsPDF()
    
    // Titulo
    doc.setFontSize(18)
    doc.text("Cuenta Corriente", 105, 20, { align: "center" })
    
    // Info del cliente
    doc.setFontSize(12)
    doc.text(`Cliente: ${cliente.nombre}`, 20, 35)
    
    if (dateRange.desde || dateRange.hasta) {
      doc.setFontSize(10)
      doc.text(`Periodo: ${dateRange.desde || 'Inicio'} - ${dateRange.hasta || 'Fin'}`, 20, 42)
    }
    
    // Tabla de movimientos
    let yPos = 55
    doc.setFontSize(10)
    doc.text("Fecha", 20, yPos)
    doc.text("Descripcion", 50, yPos)
    doc.text("Debe", 140, yPos)
    doc.text("Haber", 170, yPos)
    
    yPos += 7
    doc.line(20, yPos - 2, 190, yPos - 2)
    
    cliente.movimientos.forEach((mov) => {
      if (yPos > 270) {
        doc.addPage()
        yPos = 20
      }
      
      doc.setFontSize(9)
      doc.text(formatDate(new Date(mov.fecha)), 20, yPos)
      doc.text(mov.descripcion.substring(0, 40), 50, yPos)
      doc.text(mov.debe > 0 ? formatCurrency(mov.debe) : "-", 140, yPos)
      doc.text(mov.haber > 0 ? formatCurrency(mov.haber) : "-", 170, yPos)
      yPos += 6
    })
    
    // Saldo final
    yPos += 5
    doc.line(20, yPos, 190, yPos)
    yPos += 7
    doc.setFontSize(11)
    doc.setFont(undefined, "bold")
    doc.text(`Saldo Final: ${formatCurrency(cliente.saldo)}`, 20, yPos)
    
    doc.save(`cuenta-corriente-${cliente.nombre.replace(/\s+/g, '-')}.pdf`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Cuentas Corrientes</h2>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <Label htmlFor="desde" className="text-sm">Desde:</Label>
              <Input
                id="desde"
                type="date"
                value={dateRange.desde}
                onChange={(e) => setDateRange({...dateRange, desde: e.target.value})}
                className="w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="hasta" className="text-sm">Hasta:</Label>
              <Input
                id="hasta"
                type="date"
                value={dateRange.hasta}
                onChange={(e) => setDateRange({...dateRange, hasta: e.target.value})}
                className="w-auto"
              />
            </div>
            {(dateRange.desde || dateRange.hasta) && (
              <Button variant="outline" size="sm" onClick={() => setDateRange({desde: "", hasta: ""})}>
                Limpiar
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        {clientesConMovimientos.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            No hay datos de cuentas corrientes
          </div>
        ) : (
          clientesConMovimientos.map((cliente) => (
            <Collapsible key={cliente.nombre} open={expandedClients.has(cliente.nombre)}>
              <div className="rounded-lg border bg-card">
                <div className="flex items-center justify-between p-4">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex-1 justify-start gap-4 h-auto hover:bg-muted/50 p-0"
                      onClick={() => toggleClient(cliente.nombre)}
                    >
                      {expandedClients.has(cliente.nombre) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{cliente.nombre}</span>
                    </Button>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-2">
                    <Badge variant={cliente.saldo > 0 ? "destructive" : cliente.saldo < 0 ? "default" : "outline"}>
                      {formatCurrency(cliente.saldo)}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToPDF(cliente)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <CollapsibleContent>
                  <div className="border-t">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr className="text-xs">
                          <th className="text-left p-2 font-medium">Fecha</th>
                          <th className="text-left p-2 font-medium">Descripcion</th>
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
