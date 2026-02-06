"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { clientesIniciales, proveedoresIniciales } from "@/lib/store"
import type { Cobro } from "@/lib/types"
import { useSheet } from "@/hooks/use-sheets"

interface NuevoCobroDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (cobro: Cobro, esProveedor?: boolean) => void
}

export function NuevoCobroDialog({
  open,
  onOpenChange,
  onSubmit,
}: NuevoCobroDialogProps) {
  const sheetsClientes = useSheet("Clientes")
  const sheetsProveedores = useSheet("Proveedores")
  const [clienteId, setClienteId] = useState("")
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [monto, setMonto] = useState("")
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia" | "cheque" | "">("")
  const [observaciones, setObservaciones] = useState("")

  const allClientes = sheetsClientes.rows.length > 0
    ? sheetsClientes.rows.map((r, i) => ({ id: r.ID || String(i), nombre: r.Nombre || "", saldoActual: Number(r.Saldo) || 0 }))
    : clientesIniciales.map((c) => ({ id: c.id, nombre: c.nombre, saldoActual: c.saldoActual }))

  const allProveedores = sheetsProveedores.rows.length > 0
    ? sheetsProveedores.rows.map((r, i) => ({ id: r.ID || String(i), nombre: r.Nombre || "" }))
    : proveedoresIniciales.map((p) => ({ id: p.id, nombre: p.nombre }))

  const cliente = allClientes.find((c) => c.id === clienteId)

  const handleSubmit = () => {
    if (!clienteId || !monto || !metodoPago) return

    const cobro: Cobro = {
      id: Date.now().toString(),
      fecha: new Date(fecha),
      clienteId,
      clienteNombre: cliente?.nombre || "",
      monto: Number.parseFloat(monto),
      metodoPago,
      observaciones: observaciones || undefined,
      createdAt: new Date(),
    }

    // Check if cliente name matches a proveedor
    const esProveedor = allProveedores.some(
      (p) => p.nombre.toLowerCase().trim() === cliente?.nombre.toLowerCase().trim()
    )

    onSubmit(cobro, esProveedor)
    resetForm()
  }

  const resetForm = () => {
    setClienteId("")
    setFecha(new Date().toISOString().split("T")[0])
    setMonto("")
    setMetodoPago("")
    setObservaciones("")
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
    }).format(amount)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Cobro</DialogTitle>
          <DialogDescription>Registre un cobro de cliente</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {allClientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{c.nombre}</span>
                      {c.saldoActual > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Saldo: {formatCurrency(c.saldoActual)}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha */}
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          {/* Monto */}
          <div className="space-y-2">
            <Label>Monto</Label>
            <Input
              type="number"
              placeholder="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>

          {/* Metodo de Pago */}
          <div className="space-y-2">
            <Label>Metodo de Pago</Label>
            <Select
              value={metodoPago}
              onValueChange={(v) => setMetodoPago(v as "efectivo" | "transferencia" | "cheque")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar metodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <Label>Observaciones (opcional)</Label>
            <Textarea
              placeholder="Notas sobre el cobro..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
            />
          </div>

          {/* Resumen */}
          {monto && (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Monto a registrar</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(Number.parseFloat(monto) || 0)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!clienteId || !monto || !metodoPago}
          >
            Registrar Cobro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
