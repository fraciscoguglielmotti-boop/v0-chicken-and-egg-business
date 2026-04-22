"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Download, Calendar, Check, Receipt, LayoutList, AlignJustify, FileSpreadsheet, EyeOff, Eye, UserX } from "lucide-react"
import { useSupabase, insertRow, updateRow } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import jsPDF from "jspdf"

interface Cliente {
  id: string
  nombre: string
  saldo_inicial: number
  saldo_verificado: boolean
  activo: boolean
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
  const { data: clientes = [], mutate: mutateClientes } = useSupabase<Cliente>("clientes")
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
  const [exportRanges, setExportRanges] = useState<Record<string, { desde: string; hasta: string }>>({})
  const getExportRange = (nombre: string) => exportRanges[nombre] ?? { desde: "", hasta: "" }
  const setExportRange = (nombre: string, val: { desde: string; hasta: string }) =>
    setExportRanges(prev => ({ ...prev, [nombre]: val }))

  const [cobrarCliente, setCobrarCliente] = useState<string | null>(null)
  const [cobrarForm, setCobrarForm] = useState({ monto: "", metodo_pago: "efectivo", cuenta_destino: "", fecha: new Date().toISOString().split('T')[0] })
  const [isCobrarSubmitting, setIsCobrarSubmitting] = useState(false)
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [vistaLista, setVistaLista] = useState(false)
  const [sortCol, setSortCol] = useState<"nombre" | "totalVentas" | "totalCobros" | "saldo">("saldo")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortCol(col); setSortDir(col === "nombre" ? "asc" : "desc") }
  }

  // Clientes con movimientos
  // Set de clientes inactivos (por nombre, para incluir los sin id)
  const clientesInactivos = useMemo(() =>
    new Set(clientes.filter(c => c.activo === false).map(c => c.nombre.toLowerCase().trim()))
  , [clientes])

  const clientesConMovimientos = useMemo(() => {
    const clientesMap = new Map<string, { id: string; nombre: string; saldo: number; movimientos: MovimientoCliente[]; saldoAnterior: number; totalVentas: number; totalCobros: number; saldo_verificado: boolean; activo: boolean }>()

    clientes.forEach((c) => {
      const key = c.nombre.toLowerCase().trim()
      clientesMap.set(key, {
        id: c.id,
        nombre: c.nombre,
        saldo: c.saldo_inicial || 0,
        saldoAnterior: c.saldo_inicial || 0,
        totalVentas: 0,
        totalCobros: 0,
        movimientos: [],
        saldo_verificado: c.saldo_verificado || false,
        activo: c.activo !== false,
      })
    })

    ventas.forEach((v) => {
      const key = v.cliente_nombre.toLowerCase().trim()
      const total = v.cantidad * v.precio_unitario
      const producto = v.productos?.nombre || 'Producto'
      
      if (!clientesMap.has(key)) {
        clientesMap.set(key, { id: "", nombre: v.cliente_nombre, saldo: 0, saldoAnterior: 0, totalVentas: 0, totalCobros: 0, movimientos: [], saldo_verificado: false, activo: true })
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

    const todos = Array.from(clientesMap.values()).map(c => ({
      ...c,
      activo: !clientesInactivos.has(c.nombre.toLowerCase().trim()),
    }))
    return todos.sort((a, b) => b.saldo - a.saldo)
  }, [ventas, cobros, clientes, dateRange, clientesInactivos])

  const clientesFiltrados = useMemo(
    () => mostrarInactivos ? clientesConMovimientos : clientesConMovimientos.filter(c => c.activo !== false),
    [clientesConMovimientos, mostrarInactivos]
  )

  const totalPendienteCobro = useMemo(
    () => clientesFiltrados.filter(c => c.saldo > 0).reduce((s, c) => s + c.saldo, 0),
    [clientesFiltrados]
  )
  const clientesConDeuda = useMemo(
    () => clientesFiltrados.filter(c => c.saldo > 0).length,
    [clientesFiltrados]
  )

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

  const handleToggleActivo = async (clienteId: string, currentActivo: boolean) => {
    try {
      await updateRow("clientes", clienteId, { activo: !currentActivo })
      await mutateClientes()
      toast({ title: !currentActivo ? "Cliente activado" : "Cliente marcado como inactivo" })
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" })
    }
  }

  const handleVerificarSaldo = async (clienteId: string, currentStatus: boolean) => {
    try {
      await updateRow("clientes", clienteId, { saldo_verificado: !currentStatus })
      await mutateClientes()
      toast({ title: !currentStatus ? "Saldo verificado ✓" : "Verificación removida", description: !currentStatus ? "El saldo fue marcado como coincidente" : "Se desmarcó la verificación" })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" })
    }
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

  const handleCobrarSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cobrarCliente || isCobrarSubmitting) return
    setIsCobrarSubmitting(true)
    try {
      await insertRow("cobros", {
        fecha: cobrarForm.fecha,
        cliente_nombre: cobrarCliente,
        monto: parseFloat(cobrarForm.monto),
        metodo_pago: cobrarForm.metodo_pago,
        cuenta_destino: cobrarForm.metodo_pago === "transferencia" ? cobrarForm.cuenta_destino : null,
        verificado_agroaves: false
      })
      await mutateCobros()
      setCobrarCliente(null)
      setCobrarForm({ monto: "", metodo_pago: "efectivo", cuenta_destino: "", fecha: new Date().toISOString().split('T')[0] })
      toast({ title: "Cobro registrado", description: `Cobro a ${cobrarCliente} guardado correctamente.` })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsCobrarSubmitting(false)
    }
  }

  const filtrarMovsPorRango = (movs: MovimientoCliente[], rango: { desde: string; hasta: string }) => {
    if (!rango.desde && !rango.hasta) return movs
    const desde = rango.desde ? new Date(rango.desde + "T00:00:00") : new Date(0)
    const hasta = rango.hasta ? new Date(rango.hasta + "T23:59:59") : new Date()
    return movs.filter(m => { const f = new Date(m.fecha); return f >= desde && f <= hasta })
  }

  const exportClientePDF = (cliente: typeof clientesConMovimientos[0], rango?: { desde: string; hasta: string }) => {
    const movsFiltrados = rango ? filtrarMovsPorRango(cliente.movimientos, rango) : cliente.movimientos
    const totalVentasPDF = movsFiltrados.filter(m => m.tipo === "venta").reduce((s, m) => s + m.debe, 0)
    const totalCobrosPDF = movsFiltrados.filter(m => m.tipo === "cobro").reduce((s, m) => s + m.haber, 0)
    const doc = new jsPDF()
    
    doc.setFontSize(24)
    doc.text("AviGest", 105, 20, { align: "center" })
    doc.setFontSize(12)
    doc.text("Estado de Cuenta Corriente", 105, 28, { align: "center" })
    
    doc.setFontSize(16)
    doc.text(cliente.nombre, 20, 45)
    doc.setFontSize(10)
    const r = rango ?? { desde: "", hasta: "" }
    const periodoText = r.desde || r.hasta
      ? `Periodo: ${r.desde ? formatDate(new Date(r.desde + "T12:00:00")) : "inicio"} al ${r.hasta ? formatDate(new Date(r.hasta + "T12:00:00")) : "hoy"}`
      : "Periodo: Todo el historial"
    doc.text(periodoText, 20, 52)
    doc.text(`Generado por AviGest`, 20, 58)

    const boxY = 70
    const boxHeight = 20
    const colWidth = 56

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
    doc.text(`+${formatCurrency(totalVentasPDF)}`, 48 + colWidth + 2, boxY + 16, { align: "center" })

    doc.setFillColor(245, 245, 245)
    doc.rect(20 + (colWidth + 2) * 2, boxY, colWidth, boxHeight, 'F')
    doc.setFontSize(9)
    doc.text("COBROS", 48 + (colWidth + 2) * 2, boxY + 8, { align: "center" })
    doc.setFontSize(14)
    doc.text(`-${formatCurrency(totalCobrosPDF)}`, 48 + (colWidth + 2) * 2, boxY + 16, { align: "center" })

    let yPos = boxY + boxHeight + 10
    doc.setFillColor(230, 230, 230)
    doc.rect(20, yPos, 170, 18, 'F')
    doc.setFontSize(11)
    doc.text("SALDO ACTUAL", 105, yPos + 7, { align: "center" })
    doc.setFontSize(20)
    doc.text(formatCurrency(cliente.saldo), 105, yPos + 14, { align: "center" })

    yPos += 28
    doc.setLineWidth(0.5)
    doc.line(20, yPos, 190, yPos)
    yPos += 6

    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.text("FECHA", 22, yPos)
    doc.text("DETALLE", 55, yPos)
    doc.text("DEBE", 133, yPos, { align: "right" })
    doc.text("HABER", 162, yPos, { align: "right" })
    doc.text("SALDO", 190, yPos, { align: "right" })
    yPos += 2
    doc.line(20, yPos, 190, yPos)
    yPos += 5

    doc.setFontSize(9)
    let saldoPDF = cliente.saldoAnterior
    movsFiltrados.forEach((mov) => {
      if (yPos > 270) {
        doc.addPage()
        yPos = 20
      }
      saldoPDF += mov.debe - mov.haber
      doc.text(formatDate(new Date(mov.fecha)), 22, yPos)
      doc.text(mov.descripcion.substring(0, 38), 55, yPos)
      doc.text(mov.debe > 0 ? formatCurrency(mov.debe) : "", 133, yPos, { align: "right" })
      doc.text(mov.haber > 0 ? formatCurrency(mov.haber) : "", 162, yPos, { align: "right" })
      doc.text(formatCurrency(saldoPDF), 190, yPos, { align: "right" })
      yPos += 6
    })
    
    yPos = 280
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(`Generado el ${formatDate(new Date())} por AviGest`, 105, yPos, { align: "center" })
    
    doc.save(`estado-cuenta-${cliente.nombre.replace(/\s+/g, '-')}.pdf`)
  }

  const exportClienteCSV = (cliente: typeof clientesConMovimientos[0], rango?: { desde: string; hasta: string }) => {
    const movsFiltrados = rango ? filtrarMovsPorRango(cliente.movimientos, rango) : cliente.movimientos
    const totalVentasCSV = movsFiltrados.filter(m => m.tipo === "venta").reduce((s, m) => s + m.debe, 0)
    const totalCobrosCSV = movsFiltrados.filter(m => m.tipo === "cobro").reduce((s, m) => s + m.haber, 0)
    const r = rango ?? { desde: "", hasta: "" }
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const rows: string[] = []

    const periodoLabel = r.desde || r.hasta
      ? `${r.desde || "inicio"} al ${r.hasta || "hoy"}`
      : "Todo el historial"
    rows.push(`"Estado de cuenta — ${cliente.nombre}"`)
    rows.push(`"Período",${esc(periodoLabel)}`)
    rows.push(`"Saldo anterior",${esc(cliente.saldoAnterior)}`)
    rows.push(`"Total ventas",${esc(totalVentasCSV)}`)
    rows.push(`"Total cobros",${esc(totalCobrosCSV)}`)
    rows.push(`"Saldo actual",${esc(cliente.saldo)}`)
    rows.push("")
    rows.push([esc("Fecha"), esc("Tipo"), esc("Descripción"), esc("Debe"), esc("Haber"), esc("Saldo")].join(","))

    let saldoAcum = cliente.saldoAnterior
    if (cliente.saldoAnterior !== 0) {
      rows.push([esc(""), esc(""), esc("Saldo inicial"), esc(""), esc(""), esc(cliente.saldoAnterior)].join(","))
    }
    movsFiltrados.forEach(mov => {
      saldoAcum += mov.debe - mov.haber
      rows.push([
        esc(formatDate(new Date(mov.fecha + "T12:00:00"))),
        esc(mov.tipo === "venta" ? "Venta" : "Cobro"),
        esc(mov.descripcion),
        esc(mov.debe > 0 ? mov.debe : ""),
        esc(mov.haber > 0 ? mov.haber : ""),
        esc(saldoAcum),
      ].join(","))
    })

    // BOM para que Excel abra UTF-8 correctamente
    const bom = "\uFEFF"
    const blob = new Blob([bom + rows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cuenta-corriente-${cliente.nombre.replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h2 className="text-xl font-semibold">Cuentas Corrientes</h2>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button
            variant={mostrarInactivos ? "secondary" : "outline"}
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setMostrarInactivos(v => !v)}
          >
            {mostrarInactivos ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {mostrarInactivos ? "Mostrando inactivos" : "Ocultar inactivos"}
          </Button>
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-2">
              <Label htmlFor="desde" className="text-sm whitespace-nowrap">Desde:</Label>
              <Input
                id="desde"
                type="date"
                value={dateRange.desde}
                onChange={(e) => setDateRange({...dateRange, desde: e.target.value})}
                className="w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="hasta" className="text-sm whitespace-nowrap">Hasta:</Label>
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

      <Tabs defaultValue="clientes" className="w-full">
        <div className="flex items-center gap-3">
          <TabsList className="grid grid-cols-3 sm:max-w-2xl">
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
            <TabsTrigger value="transferencias"><span className="hidden sm:inline">Transferencias Agroaves</span><span className="sm:hidden">Transf.</span></TabsTrigger>
          </TabsList>
          <div className="ml-auto flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={vistaLista ? "ghost" : "secondary"}
              size="sm"
              className="rounded-none h-9 px-3"
              onClick={() => setVistaLista(false)}
              title="Vista detallada"
            >
              <AlignJustify className="h-4 w-4" />
            </Button>
            <Button
              variant={vistaLista ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none h-9 px-3 border-l"
              onClick={() => setVistaLista(true)}
              title="Vista lista"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="clientes" className="space-y-4 mt-4">
          {clientesConDeuda > 0 && (
            <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Pendiente de Cobro</p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{formatCurrency(totalPendienteCobro)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-amber-700 dark:text-amber-300">{clientesConDeuda} cliente{clientesConDeuda !== 1 ? "s" : ""} con saldo</p>
                </div>
              </div>
            </Card>
          )}
          {clientesFiltrados.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No hay datos de clientes
            </div>
          ) : vistaLista ? (
            /* ── Vista lista compacta ── */
            <div className="rounded-lg border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="text-left p-3 font-semibold">#</th>
                    <th className="text-left p-3 font-semibold cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("nombre")}>
                      Cliente{sortCol === "nombre" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                    <th className="text-right p-3 font-semibold cursor-pointer select-none hover:text-foreground hidden sm:table-cell" onClick={() => handleSort("totalVentas")}>
                      Total vendido{sortCol === "totalVentas" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                    <th className="text-right p-3 font-semibold cursor-pointer select-none hover:text-foreground hidden sm:table-cell" onClick={() => handleSort("totalCobros")}>
                      Total cobrado{sortCol === "totalCobros" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                    <th className="text-right p-3 font-semibold cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("saldo")}>
                      Saldo{sortCol === "saldo" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                    <th className="text-center p-3 font-semibold">Verificado</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {[...clientesFiltrados].sort((a, b) => {
                    const dir = sortDir === "asc" ? 1 : -1
                    if (sortCol === "nombre") return a.nombre.localeCompare(b.nombre) * dir
                    return (a[sortCol] - b[sortCol]) * dir
                  }).map((cliente, i) => (
                    <tr key={cliente.nombre} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-muted-foreground">{i + 1}</td>
                      <td className="p-3 font-medium">{cliente.nombre}</td>
                      <td className="p-3 text-right hidden sm:table-cell text-muted-foreground">
                        {formatCurrency(cliente.totalVentas)}
                      </td>
                      <td className="p-3 text-right hidden sm:table-cell text-green-600">
                        {formatCurrency(cliente.totalCobros)}
                      </td>
                      <td className="p-3 text-right">
                        <Badge variant={cliente.saldo > 0 ? "destructive" : cliente.saldo < 0 ? "default" : "outline"}>
                          {formatCurrency(cliente.saldo)}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        {cliente.id ? (
                          <Badge
                            variant={cliente.saldo_verificado ? "default" : "outline"}
                            className="cursor-pointer select-none"
                            onClick={() => handleVerificarSaldo(cliente.id, cliente.saldo_verificado)}
                          >
                            {cliente.saldo_verificado ? "✓ Coincide" : "Pendiente"}
                          </Badge>
                        ) : "-"}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          {cliente.saldo > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 h-7 px-2 text-xs"
                              onClick={() => { setCobrarCliente(cliente.nombre); setCobrarForm(f => ({ ...f, monto: String(Math.round(cliente.saldo)) })) }}
                            >
                              <Receipt className="h-3 w-3" />
                              Cobrar
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Exportar PDF" onClick={() => exportClientePDF(cliente)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Exportar Excel" onClick={() => exportClienteCSV(cliente)}>
                            <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 border-t font-semibold text-sm">
                  <tr>
                    <td colSpan={2} className="p-3">Total</td>
                    <td className="p-3 text-right hidden sm:table-cell text-muted-foreground">
                      {formatCurrency(clientesFiltrados.reduce((s, c) => s + c.totalVentas, 0))}
                    </td>
                    <td className="p-3 text-right hidden sm:table-cell text-green-600">
                      {formatCurrency(clientesFiltrados.reduce((s, c) => s + c.totalCobros, 0))}
                    </td>
                    <td className="p-3 text-right">
                      <Badge variant="destructive">
                        {formatCurrency(clientesFiltrados.filter(c => c.saldo > 0).reduce((s, c) => s + c.saldo, 0))}
                      </Badge>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            clientesFiltrados.map((cliente) => (
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
                      {cliente.id && (
                        <Badge
                          variant={cliente.saldo_verificado ? "default" : "outline"}
                          className="cursor-pointer select-none"
                          onClick={(e) => { e.stopPropagation(); handleVerificarSaldo(cliente.id, cliente.saldo_verificado) }}
                        >
                          {cliente.saldo_verificado ? "✓ Verificado" : "Sin verificar"}
                        </Badge>
                      )}
                      {cliente.saldo > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={(e) => { e.stopPropagation(); setCobrarCliente(cliente.nombre); setCobrarForm(f => ({ ...f, monto: String(Math.round(cliente.saldo)) })) }}
                        >
                          <Receipt className="h-3 w-3" />
                          Cobrar
                        </Button>
                      )}
                      <Button variant="outline" size="sm" title="Exportar PDF" onClick={(e) => { e.stopPropagation(); exportClientePDF(cliente) }}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" title="Exportar Excel" onClick={(e) => { e.stopPropagation(); exportClienteCSV(cliente) }}>
                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      </Button>
                      {cliente.id && (
                        <Button
                          variant="ghost" size="sm"
                          title={cliente.activo ? "Marcar como inactivo" : "Reactivar cliente"}
                          onClick={(e) => { e.stopPropagation(); handleToggleActivo(cliente.id, cliente.activo) }}
                        >
                          <UserX className={`h-4 w-4 ${cliente.activo ? "text-muted-foreground" : "text-destructive"}`} />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <CollapsibleContent>
                    {/* Exportar por período */}
                    <div className="border-t px-4 py-3 bg-muted/20 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Exportar período:</span>
                      <Input type="date" className="h-7 w-auto text-xs"
                        value={getExportRange(cliente.nombre).desde}
                        onChange={e => setExportRange(cliente.nombre, { ...getExportRange(cliente.nombre), desde: e.target.value })}
                      />
                      <span className="text-xs text-muted-foreground">→</span>
                      <Input type="date" className="h-7 w-auto text-xs"
                        value={getExportRange(cliente.nombre).hasta}
                        onChange={e => setExportRange(cliente.nombre, { ...getExportRange(cliente.nombre), hasta: e.target.value })}
                      />
                      {(getExportRange(cliente.nombre).desde || getExportRange(cliente.nombre).hasta) && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setExportRange(cliente.nombre, { desde: "", hasta: "" })}>
                          Limpiar
                        </Button>
                      )}
                      <div className="flex gap-1 ml-auto">
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs"
                          onClick={() => exportClientePDF(cliente, getExportRange(cliente.nombre).desde || getExportRange(cliente.nombre).hasta ? getExportRange(cliente.nombre) : undefined)}>
                          <Download className="h-3 w-3" /> PDF
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs"
                          onClick={() => exportClienteCSV(cliente, getExportRange(cliente.nombre).desde || getExportRange(cliente.nombre).hasta ? getExportRange(cliente.nombre) : undefined)}>
                          <FileSpreadsheet className="h-3 w-3 text-green-600" /> Excel
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[400px]">
                        <thead className="bg-muted/50">
                          <tr className="text-xs">
                            <th className="text-left p-2 font-medium">Fecha</th>
                            <th className="text-left p-2 font-medium">Descripcion</th>
                            <th className="text-right p-2 font-medium">Debe</th>
                            <th className="text-right p-2 font-medium">Haber</th>
                            <th className="text-right p-2 font-medium">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cliente.saldoAnterior !== 0 && (
                            <tr className="border-t text-sm bg-muted/20">
                              <td className="p-2 text-muted-foreground">—</td>
                              <td className="p-2 text-muted-foreground italic">Saldo inicial</td>
                              <td className="p-2 text-right">-</td>
                              <td className="p-2 text-right">-</td>
                              <td className="p-2 text-right font-medium">{formatCurrency(cliente.saldoAnterior)}</td>
                            </tr>
                          )}
                          {(() => {
                            let saldoAcum = cliente.saldoAnterior
                            return cliente.movimientos.map((mov, idx) => {
                              saldoAcum += mov.debe - mov.haber
                              return (
                                <tr key={idx} className="border-t text-sm">
                                  <td className="p-2 text-muted-foreground">{formatDate(new Date(mov.fecha))}</td>
                                  <td className="p-2">{mov.descripcion}</td>
                                  <td className="p-2 text-right text-destructive">{mov.debe > 0 ? formatCurrency(mov.debe) : '-'}</td>
                                  <td className="p-2 text-right text-green-600">{mov.haber > 0 ? formatCurrency(mov.haber) : '-'}</td>
                                  <td className={`p-2 text-right font-medium ${saldoAcum > 0 ? "text-destructive" : saldoAcum < 0 ? "text-green-600" : "text-muted-foreground"}`}>
                                    {formatCurrency(saldoAcum)}
                                  </td>
                                </tr>
                              )
                            })
                          })()}
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
                    <div className="border-t overflow-x-auto">
                      <table className="w-full min-w-[400px]">
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

      <Dialog open={!!cobrarCliente} onOpenChange={(open) => !open && setCobrarCliente(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Cobro — {cobrarCliente}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCobrarSubmit} className="space-y-4">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={cobrarForm.fecha} max={new Date().toISOString().split('T')[0]} onChange={(e) => setCobrarForm({ ...cobrarForm, fecha: e.target.value })} required />
            </div>
            <div>
              <Label>Monto</Label>
              <Input type="number" step="0.01" value={cobrarForm.monto} onChange={(e) => setCobrarForm({ ...cobrarForm, monto: e.target.value })} required />
            </div>
            <div>
              <Label>Metodo de Pago</Label>
              <Select value={cobrarForm.metodo_pago} onValueChange={(value) => setCobrarForm({ ...cobrarForm, metodo_pago: value, cuenta_destino: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cobrarForm.metodo_pago === "transferencia" && (
              <div>
                <Label>Cuenta Destino</Label>
                <Select value={cobrarForm.cuenta_destino} onValueChange={(value) => setCobrarForm({ ...cobrarForm, cuenta_destino: value })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                  <SelectContent>
                    {["Agroaves", "Francisco", "Diego", "Otra"].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCobrarCliente(null)} disabled={isCobrarSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={isCobrarSubmitting}>{isCobrarSubmitting ? "Guardando…" : "Registrar Cobro"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
