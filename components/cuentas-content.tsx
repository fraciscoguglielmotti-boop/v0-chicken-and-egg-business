"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Download, Calendar, Check } from "lucide-react"
import { useSupabase, insertRow, updateRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import jsPDF from "jspdf"

interface Cliente {
  id: string
  nombre: string
  saldo_inicial: number
}

interface Proveedor {
  id: string
  nombre: string
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
  cuenta_destino?: string
  verificado_agroaves: boolean
}

interface Compra {
  id: string
  fecha: string
  proveedor_nombre: string
  producto: string
  cantidad: number
  precio_unitario: number
  total: number
}

interface Pago {
  id: string
  fecha: string
  proveedor_nombre: string
  monto: number
  metodo_pago?: string
}

type MovimientoCliente = {
  fecha: string
  tipo: 'venta' | 'cobro'
  descripcion: string
  debe: number
  haber: number
}

type MovimientoProveedor = {
  id?: string
  fecha: string
  tipo: 'compra' | 'pago' | 'transferencia'
  descripcion: string
  debe: number
  haber: number
  verificado?: boolean
}

export function CuentasContent() {
  const { data: clientes = [] } = useSupabase<Cliente>("clientes")
  const { data: proveedores = [] } = useSupabase<Proveedor>("proveedores")
  const { data: ventas = [] } = useSupabase<Venta>("ventas")
  const { data: cobros = [], mutate: mutateCobros } = useSupabase<Cobro>("cobros")
  const { data: compras = [] } = useSupabase<Compra>("compras")
  const { data: pagos = [] } = useSupabase<Pago>("pagos")
  
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set())
  const [dateRange, setDateRange] = useState({ desde: "", hasta: "" })
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const { toast } = useToast()

  // Clientes con movimientos
  const clientesConMovimientos = useMemo(() => {
    const clientesMap = new Map<string, { nombre: string; saldo: number; movimientos: MovimientoCliente[]; saldoAnterior: number; totalVentas: number; totalCobros: number }>()

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

    ventas.forEach((v) => {
      const key = v.cliente_nombre.toLowerCase().trim()
      const total = v.cantidad * v.precio_unitario
      const producto = v.productos?.nombre || 'Producto'
      
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

    if (dateRange.desde || dateRange.hasta) {
      const desde = dateRange.desde ? new Date(dateRange.desde) : new Date(0)
      const hasta = dateRange.hasta ? new Date(dateRange.hasta) : new Date()
      
      clientesMap.forEach((cliente) => {
        cliente.movimientos = cliente.movimientos.filter(m => {
          const fecha = new Date(m.fecha)
          return fecha >= desde && fecha <= hasta
        })
        cliente.totalVentas = cliente.movimientos.filter(m => m.tipo === 'venta').reduce((sum, m) => sum + m.debe, 0)
        cliente.totalCobros = cliente.movimientos.filter(m => m.tipo === 'cobro').reduce((sum, m) => sum + m.haber, 0)
        cliente.saldo = cliente.saldoAnterior + cliente.totalVentas - cliente.totalCobros
      })
    }

    clientesMap.forEach((cliente) => {
      cliente.movimientos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    })

    return Array.from(clientesMap.values()).sort((a, b) => b.saldo - a.saldo)
  }, [ventas, cobros, clientes, dateRange])

  // Proveedores con movimientos
  const proveedoresConMovimientos = useMemo(() => {
    const proveedoresMap = new Map<string, { nombre: string; saldo: number; movimientos: MovimientoProveedor[]; totalCompras: number; totalPagos: number }>()

    proveedores.forEach((p) => {
      const key = p.nombre.toLowerCase().trim()
      proveedoresMap.set(key, { 
        nombre: p.nombre, 
        saldo: 0,
        totalCompras: 0,
        totalPagos: 0,
        movimientos: []
      })
    })

    // Agregar compras (aumentan deuda)
    compras.forEach((c) => {
      const key = c.proveedor_nombre.toLowerCase().trim()
      
      if (!proveedoresMap.has(key)) {
        proveedoresMap.set(key, { nombre: c.proveedor_nombre, saldo: 0, totalCompras: 0, totalPagos: 0, movimientos: [] })
      }
      
      const proveedor = proveedoresMap.get(key)!
      proveedor.saldo += c.total
      proveedor.totalCompras += c.total
      proveedor.movimientos.push({
        fecha: c.fecha,
        tipo: 'compra',
        descripcion: `Compra - ${c.cantidad} ${c.producto} (${c.cantidad} x ${formatCurrency(c.precio_unitario)})`,
        debe: c.total,
        haber: 0
      })
    })

    // Agregar pagos en efectivo (disminuyen deuda)
    pagos.forEach((p) => {
      const key = p.proveedor_nombre.toLowerCase().trim()
      const proveedor = proveedoresMap.get(key)
      
      if (proveedor) {
        proveedor.saldo -= Number(p.monto)
        proveedor.totalPagos += Number(p.monto)
        proveedor.movimientos.push({
          fecha: p.fecha,
          tipo: 'pago',
          descripcion: `Pago - ${p.metodo_pago || 'efectivo'}`,
          debe: 0,
          haber: Number(p.monto)
        })
      }
    })

    // Agregar transferencias directas de clientes (disminuyen deuda SOLO si están verificadas)
    cobros.forEach((c) => {
      if (c.cuenta_destino && c.metodo_pago === 'transferencia') {
        const key = c.cuenta_destino.toLowerCase().trim()
        const proveedor = proveedoresMap.get(key)
        
        if (proveedor) {
          // Solo descuenta del saldo si está verificado
          if (c.verificado_agroaves) {
            proveedor.saldo -= Number(c.monto)
            proveedor.totalPagos += Number(c.monto)
          }
          proveedor.movimientos.push({
            id: c.id,
            fecha: c.fecha,
            tipo: 'transferencia',
            descripcion: `Transferencia de ${c.cliente_nombre}`,
            debe: 0,
            haber: Number(c.monto),
            verificado: c.verificado_agroaves
          })
        }
      }
    })

    proveedoresMap.forEach((proveedor) => {
      proveedor.movimientos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    })

    return Array.from(proveedoresMap.values()).sort((a, b) => b.saldo - a.saldo)
  }, [compras, pagos, cobros, proveedores])

  const toggleClient = (nombre: string) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev)
      newSet.has(nombre) ? newSet.delete(nombre) : newSet.add(nombre)
      return newSet
    })
  }

  const toggleProvider = (nombre: string) => {
    setExpandedProviders(prev => {
      const newSet = new Set(prev)
      newSet.has(nombre) ? newSet.delete(nombre) : newSet.add(nombre)
      return newSet
    })
  }

  const handleVerifyTransfer = async (cobroId: string, currentStatus: boolean) => {
    try {
      await updateRow("cobros", cobroId, { verificado_agroaves: !currentStatus })
      await mutateCobros()
      toast({ title: "Transferencia actualizada", description: !currentStatus ? "Marcada como verificada" : "Desmarcada" })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar la verificación", variant: "destructive" })
    }
  }

  const exportClientePDF = (cliente: typeof clientesConMovimientos[0]) => {
    const doc = new jsPDF()
    
    doc.setFontSize(24)
    doc.text("AviGest", 105, 20, { align: "center" })
    doc.setFontSize(12)
    doc.text("Estado de Cuenta Corriente", 105, 28, { align: "center" })
    
    doc.setFontSize(16)
    doc.text(cliente.nombre, 20, 45)
    doc.setFontSize(10)
    const periodoText = dateRange.desde && dateRange.hasta 
      ? `Periodo: ${formatDate(new Date(dateRange.desde))} al ${formatDate(new Date(dateRange.hasta))}`
      : `Periodo: Todo el historial`
    doc.text(periodoText, 20, 52)
    doc.text(`Vendedor: AviGest`, 20, 58)
    
    const boxY = 70
    const boxHeight = 20
    const colWidth = 56
    
    // Cajas sin setFont
    doc.setFillColor(245, 245, 245)
    doc.rect(20, boxY, colWidth, boxHeight, 'F')
    doc.setFontSize(9)
    doc.text("SALDO ANTERIOR", 48, boxY + 8, { align: "center" })
    doc.setFontSize(14)
    doc.text(formatCurrency(cliente.saldoAnterior), 48, boxY + 16, { align: "center" })
    
    doc.setFillColor(245, 245, 245)
    doc.rect(20 + colWidth + 2, boxY, colWidth, boxHeight, 'F')
    doc.setFontSize(9)
    doc.text("VENTAS", 48 + colWidth + 2, boxY + 8, { align: "center" })
    doc.setFontSize(14)
    doc.text(`+${formatCurrency(cliente.totalVentas)}`, 48 + colWidth + 2, boxY + 16, { align: "center" })
    
    doc.setFillColor(245, 245, 245)
    doc.rect(20 + (colWidth + 2) * 2, boxY, colWidth, boxHeight, 'F')
    doc.setFontSize(9)
    doc.text("COBROS", 48 + (colWidth + 2) * 2, boxY + 8, { align: "center" })
    doc.setFontSize(14)
    doc.text(`-${formatCurrency(cliente.totalCobros)}`, 48 + (colWidth + 2) * 2, boxY + 16, { align: "center" })
    
    let yPos = boxY + boxHeight + 10
    doc.setFillColor(230, 230, 230)
    doc.rect(20, yPos, 170, 18, 'F')
    doc.setFontSize(11)
    doc.text("SALDO ACTUAL", 105, yPos + 7, { align: "center" })
    doc.setFontSize(20)
    doc.text(formatCurrency(cliente.saldo), 105, yPos + 14, { align: "center" })
    
    yPos += 28
    doc.setFontSize(10)
    doc.text("FECHA", 22, yPos)
    doc.text("DETALLE", 55, yPos)
    doc.text("DEBE", 145, yPos, { align: "right" })
    doc.text("HABER", 180, yPos, { align: "right" })
    
    yPos += 2
    doc.setLineWidth(0.5)
    doc.line(20, yPos, 190, yPos)
    yPos += 6
    
    doc.setFontSize(9)
    cliente.movimientos.forEach((mov) => {
      if (yPos > 270) {
        doc.addPage()
        yPos = 20
      }
      doc.text(formatDate(new Date(mov.fecha)), 22, yPos)
      doc.text(mov.descripcion.substring(0, 47), 55, yPos)
      doc.text(mov.debe > 0 ? formatCurrency(mov.debe) : "", 145, yPos, { align: "right" })
      doc.text(mov.haber > 0 ? formatCurrency(mov.haber) : "", 180, yPos, { align: "right" })
      yPos += 6
    })
    
    yPos = 280
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(`Generado el ${formatDate(new Date())} por AviGest`, 105, yPos, { align: "center" })
    
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

      <Tabs defaultValue="clientes" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
          <TabsTrigger value="transferencias">Transferencias Agroaves</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-2 mt-4">
          {clientesConMovimientos.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No hay datos de clientes
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
                        {expandedClients.has(cliente.nombre) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="font-medium">{cliente.nombre}</span>
                      </Button>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-2">
                      <Badge variant={cliente.saldo > 0 ? "destructive" : cliente.saldo < 0 ? "default" : "outline"}>
                        {formatCurrency(cliente.saldo)}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => exportClientePDF(cliente)}>
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
        </TabsContent>

        <TabsContent value="proveedores" className="space-y-2 mt-4">
          {proveedoresConMovimientos.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No hay datos de proveedores
            </div>
          ) : (
            proveedoresConMovimientos.map((proveedor) => (
              <Collapsible key={proveedor.nombre} open={expandedProviders.has(proveedor.nombre)}>
                <div className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between p-4">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex-1 justify-start gap-4 h-auto hover:bg-muted/50 p-0"
                        onClick={() => toggleProvider(proveedor.nombre)}
                      >
                        {expandedProviders.has(proveedor.nombre) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="font-medium">{proveedor.nombre}</span>
                      </Button>
                    </CollapsibleTrigger>
                    <Badge variant={proveedor.saldo > 0 ? "destructive" : proveedor.saldo < 0 ? "default" : "outline"}>
                      {formatCurrency(proveedor.saldo)}
                    </Badge>
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
                            <th className="text-center p-2 font-medium">Verificado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {proveedor.movimientos.map((mov, idx) => (
                            <tr key={idx} className="border-t text-sm">
                              <td className="p-2 text-muted-foreground">{formatDate(new Date(mov.fecha))}</td>
                              <td className="p-2">{mov.descripcion}</td>
                              <td className="p-2 text-right text-destructive">{mov.debe > 0 ? formatCurrency(mov.debe) : '-'}</td>
                              <td className="p-2 text-right text-green-600">{mov.haber > 0 ? formatCurrency(mov.haber) : '-'}</td>
                              <td className="p-2 text-center">
                                {mov.tipo === 'transferencia' && mov.id ? (
                                  <Checkbox
                                    checked={mov.verificado || false}
                                    onCheckedChange={() => handleVerifyTransfer(mov.id!, mov.verificado || false)}
                                  />
                                ) : (
                                  '-'
                                )}
                              </td>
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
        </TabsContent>

        <TabsContent value="transferencias" className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Mes:</Label>
            <Input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transferencias a Agroaves por Cliente - {selectedMonth}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(() => {
                  const transferenciasAgroaves = cobros
                    .filter(c => c.cuenta_destino?.toLowerCase() === 'agroaves' && c.metodo_pago === 'transferencia' && c.fecha.startsWith(selectedMonth))
                    .reduce((acc, c) => {
                      const cliente = c.cliente_nombre || 'Sin cliente'
                      if (!acc[cliente]) {
                        acc[cliente] = { total: 0, transferencias: [] }
                      }
                      acc[cliente].total += Number(c.monto)
                      acc[cliente].transferencias.push({
                        fecha: c.fecha,
                        monto: Number(c.monto),
                        verificado: c.verificado_agroaves
                      })
                      return acc
                    }, {} as Record<string, { total: number; transferencias: Array<{ fecha: string; monto: number; verificado: boolean }> }>)

                  const totalMes = Object.values(transferenciasAgroaves).reduce((sum, c) => sum + c.total, 0)

                  return (
                    <>
                      <div className="rounded-lg border p-4 bg-muted">
                        <p className="text-sm font-medium">Total Transferencias del Mes</p>
                        <p className="text-2xl font-bold">{formatCurrency(totalMes)}</p>
                      </div>

                      {Object.entries(transferenciasAgroaves).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No hay transferencias a Agroaves en este período</p>
                      ) : (
                        Object.entries(transferenciasAgroaves)
                          .sort((a, b) => b[1].total - a[1].total)
                          .map(([cliente, data]) => (
                            <div key={cliente} className="rounded-lg border p-4">
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold">{cliente}</h4>
                                <Badge variant="default" className="text-base">{formatCurrency(data.total)}</Badge>
                              </div>
                              <div className="mt-2 space-y-1">
                                {data.transferencias.map((t, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{formatDate(new Date(t.fecha))}</span>
                                    <div className="flex items-center gap-2">
                                      <span>{formatCurrency(t.monto)}</span>
                                      {t.verificado && <Badge variant="outline" className="text-xs">Verificado</Badge>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                      )}
                    </>
                  )
                })()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
