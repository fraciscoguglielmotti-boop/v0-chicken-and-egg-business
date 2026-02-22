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
  metodo_pago?: string
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
    const clientesMap = new Map<string, { nombre: string; saldo: number; movimientos: Movimiento[]; saldoAnterior: number; totalVentas: number; totalCobros: number }>()

    // Inicializar clientes con saldo inicial
    clientes.forEach((c) => {
      const key = c.nombre.toLowerCase().trim()
      clientesMap.set(key, { 
        nombre: c.nombre, 
        saldo: c.saldo_inicial || 0,
        saldoAnterior: c.saldo_inicial || 0,
        totalVentas: 0,
        totalCobros: 0,
        movimientos: []
      })
    })

    // Agregar ventas
    ventas.forEach((v) => {
      const key = v.cliente_nombre.toLowerCase().trim()
      const total = v.cantidad * v.precio_unitario
      const producto = v.productos?.nombre || v.productos?.descripcion || 'Producto'
      
      if (!clientesMap.has(key)) {
        clientesMap.set(key, { nombre: v.cliente_nombre, saldo: 0, saldoAnterior: 0, totalVentas: 0, totalCobros: 0, movimientos: [] })
      }
      
      const cliente = clientesMap.get(key)!
      cliente.saldo += total
      cliente.totalVentas += total
      cliente.movimientos.push({
        fecha: v.fecha,
        tipo: 'venta',
        descripcion: `Venta - ${v.cantidad} ${producto} (${v.cantidad} x ${formatCurrency(v.precio_unitario)})`,
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
        cliente.totalCobros += Number(c.monto)
        cliente.movimientos.push({
          fecha: c.fecha,
          tipo: 'cobro',
          descripcion: `Cobro - ${c.metodo_pago || 'efectivo'}`,
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
        
        // Recalcular totales
        cliente.totalVentas = cliente.movimientos.filter(m => m.tipo === 'venta').reduce((sum, m) => sum + m.debe, 0)
        cliente.totalCobros = cliente.movimientos.filter(m => m.tipo === 'cobro').reduce((sum, m) => sum + m.haber, 0)
        cliente.saldo = cliente.saldoAnterior + cliente.totalVentas - cliente.totalCobros
      })
    }

    // Ordenar movimientos por fecha
    clientesMap.forEach((cliente) => {
      cliente.movimientos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
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
    const now = new Date()
    
    // Header con nombre de empresa
    doc.setFontSize(24)
    doc.setFont(undefined, 'bold')
    doc.text("AviGest", 105, 20, { align: "center" })
    
    doc.setFontSize(12)
    doc.setFont(undefined, 'normal')
    doc.text("Estado de Cuenta Corriente", 105, 28, { align: "center" })
    
    // Info del cliente
    doc.setFontSize(16)
    doc.setFont(undefined, 'bold')
    doc.text(cliente.nombre, 20, 45)
    
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    const periodoText = dateRange.desde && dateRange.hasta 
      ? `Periodo: ${formatDate(new Date(dateRange.desde))} al ${formatDate(new Date(dateRange.hasta))}`
      : `Periodo: Todo el historial`
    doc.text(periodoText, 20, 52)
    doc.text(`Vendedor: ${cliente.movimientos.length > 0 ? 'AviGest' : 'N/A'}`, 20, 58)
    
    // Cuadros de resumen
    const boxY = 70
    const boxHeight = 20
    const colWidth = 56
    
    // Saldo Anterior
    doc.setFillColor(245, 245, 245)
    doc.rect(20, boxY, colWidth, boxHeight, 'F')
    doc.setFontSize(9)
    doc.text("SALDO ANTERIOR", 38, boxY + 8, { align: "center" })
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text(formatCurrency(cliente.saldoAnterior), 38, boxY + 16, { align: "center" })
    
    // Ventas
    doc.setFont(undefined, 'normal')
    doc.rect(20 + colWidth + 2, boxY, colWidth, boxHeight, 'F')
    doc.setFontSize(9)
    doc.text("VENTAS", 38 + colWidth + 2, boxY + 8, { align: "center" })
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text(`+${formatCurrency(cliente.totalVentas)}`, 38 + colWidth + 2, boxY + 16, { align: "center" })
    
    // Cobros
    doc.setFont(undefined, 'normal')
    doc.rect(20 + (colWidth + 2) * 2, boxY, colWidth, boxHeight, 'F')
    doc.setFontSize(9)
    doc.text("COBROS", 38 + (colWidth + 2) * 2, boxY + 8, { align: "center" })
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text(`-${formatCurrency(cliente.totalCobros)}`, 38 + (colWidth + 2) * 2, boxY + 16, { align: "center" })
    
    // Saldo Actual - destacado
    let yPos = boxY + boxHeight + 10
    doc.setFillColor(230, 230, 230)
    doc.rect(20, yPos, 170, 18, 'F')
    doc.setFontSize(11)
    doc.setFont(undefined, 'normal')
    doc.text("SALDO ACTUAL", 105, yPos + 7, { align: "center" })
    doc.setFontSize(20)
    doc.setFont(undefined, 'bold')
    doc.text(formatCurrency(cliente.saldo), 105, yPos + 14, { align: "center" })
    
    // Tabla de detalle
    yPos += 28
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.text("FECHA", 22, yPos)
    doc.text("DETALLE", 55, yPos)
    doc.text("DEBE", 145, yPos, { align: "right" })
    doc.text("HABER", 180, yPos, { align: "right" })
    
    yPos += 2
    doc.setLineWidth(0.5)
    doc.line(20, yPos, 190, yPos)
    yPos += 6
    
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    
    cliente.movimientos.forEach((mov) => {
      if (yPos > 270) {
        doc.addPage()
        yPos = 20
      }
      
      doc.text(formatDate(new Date(mov.fecha)), 22, yPos)
      const descripcion = mov.descripcion.length > 50 ? mov.descripcion.substring(0, 47) + "..." : mov.descripcion
      doc.text(descripcion, 55, yPos)
      doc.text(mov.debe > 0 ? formatCurrency(mov.debe) : "", 145, yPos, { align: "right" })
      doc.text(mov.haber > 0 ? formatCurrency(mov.haber) : "", 180, yPos, { align: "right" })
      yPos += 6
    })
    
    // Footer
    yPos = 280
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(`Generado el ${formatDate(now)} por AviGest`, 105, yPos, { align: "center" })
    
    doc.save(`estado-cuenta-${cliente.nombre.replace(/\s+/g, '-')}.pdf`)
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
