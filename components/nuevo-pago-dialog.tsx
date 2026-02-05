"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
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
import { proveedoresIniciales } from "@/lib/store"
import type { Pago } from "@/lib/types"
import { useSheet } from "@/hooks/use-sheets"

interface NuevoPagoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (pago: Pago) => void
}

export function NuevoPagoDialog({
  open,
  onOpenChange,
  onSubmit,
}: NuevoPagoDialogProps) {
  const sheetsProveedores = useSheet("Proveedores")
  const [proveedorId, setProveedorId] = useState("")
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [monto, setMonto] = useState("")
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia" | "cheque" | "">("")
  const [observaciones, setObservaciones] = useState("")

  const allProveedores = sheetsProveedores.rows.length > 0
    ? sheetsProveedores.rows.map((r, i) => ({ id: r.ID || String(i), nombre: r.Nombre || "", saldoActual: Number(r.Saldo) || 0 }))
    : proveedoresIniciales.map((p) => ({ id: p.id, nombre: p.nombre, saldoActual: p.saldoActual }))

  const proveedor = allProveedores.find((p) => p.id === proveedorId)

  const handleSubmit = () => {
    if (!proveedorId || !monto || !metodoPago) return

    const pago: Pago = {
      id: Date.now().toString(),
      fecha: new Date(fecha),
      proveedorId,
      proveedorNombre: proveedor?.nombre || "",
      monto: Number.parseFloat(monto),
      metodoPago,
      observaciones: observaciones || undefined,
      createdAt: new Date(),
    }

    onSubmit(pago)
    resetForm()
  }

  const resetForm = () => {
    setProveedorId("")
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
          <DialogTitle>Registrar Pago a Proveedor</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Proveedor */}
          <div className="space-y-2">
            <Label>Proveedor</Label>
            <Select value={proveedorId} onValueChange={setProveedorId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar proveedor" />
              </SelectTrigger>
              <SelectContent>
                {allProveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{p.nombre}</span>
                      {p.saldoActual > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Debe: {formatCurrency(p.saldoActual)}
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
              placeholder="Notas sobre el pago..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
            />
          </div>

          {/* Resumen */}
          {monto && (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Monto a pagar</span>
                <span className="text-xl font-bold text-destructive">
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
            disabled={!proveedorId || !monto || !metodoPago}
          >
            Registrar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
