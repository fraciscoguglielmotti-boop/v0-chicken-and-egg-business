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
import { Badge } from "@/components/ui/badge"
import { clientesIniciales } from "@/lib/store"
import type { Cobro } from "@/lib/types"
import { useSheet } from "@/hooks/use-sheets"

interface NuevoCobroDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (cobro: Cobro, esProveedor?: boolean, cuentaDestino?: string) => void
}

export function NuevoCobroDialog({
  open,
  onOpenChange,
  onSubmit,
}: NuevoCobroDialogProps) {
  const sheetsClientes = useSheet("Clientes")
  const [clienteId, setClienteId] = useState("")
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [monto, setMonto] = useState("")
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia" | "">("")
  const [cuentaDestino, setCuentaDestino] = useState("")
  const [observaciones, setObservaciones] = useState("")

  const allClientes = sheetsClientes.rows.length > 0
    ? sheetsClientes.rows.map((r, i) => ({ 
        id: r.ID || String(i), 
        nombre: r.Nombre || "", 
        saldoActual: Number(r.Saldo) || 0 
      }))
    : clientesIniciales.map((c) => ({ id: c.id, nombre: c.nombre, saldoActual: c.saldoActual }))

  const cliente = allClientes.find((c) => c.id === clienteId)

  // Check if cuenta destino is Agroaves SRL
  const esTransferenciaAgroaves = metodoPago === "transferencia" && 
    cuentaDestino.toLowerCase().includes("agroaves")

  const handleSubmit = () => {
    if (!clienteId || !monto || !metodoPago) return
    if (metodoPago === "transferencia" && !cuentaDestino) return

    const cobro: Cobro = {
      id: Date.now().toString(),
      fecha: new Date(fecha),
      clienteId: cliente?.nombre || "", // Use name, not numeric ID
      clienteNombre: cliente?.nombre || "",
      monto: Number.parseFloat(monto),
      metodoPago,
      observaciones: observaciones || undefined,
      createdAt: new Date(),
    }

    onSubmit(cobro, esTransferenciaAgroaves, cuentaDestino || undefined)
    resetForm()
  }

  const resetForm = () => {
    setClienteId("")
    setFecha(new Date().toISOString().split("T")[0])
    setMonto("")
    setMetodoPago("")
    setCuentaDestino("")
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

          {/* Metodo de Pago - sin cheque */}
          <div className="space-y-2">
            <Label>Metodo de Cobro</Label>
            <Select
              value={metodoPago}
              onValueChange={(v) => {
                setMetodoPago(v as "efectivo" | "transferencia")
                if (v !== "transferencia") {
                  setCuentaDestino("")
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar metodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cuenta destino - solo para transferencias */}
          {metodoPago === "transferencia" && (
            <div className="space-y-2">
              <Label>Cuenta Destino</Label>
              <Select value={cuentaDestino} onValueChange={setCuentaDestino}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta destino" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Agroaves SRL">Agroaves SRL</SelectItem>
                  <SelectItem value="Cuenta Personal">Cuenta Personal</SelectItem>
                  <SelectItem value="Otra">Otra cuenta</SelectItem>
                </SelectContent>
              </Select>
              {cuentaDestino === "Otra" && (
                <Input
                  placeholder="Nombre del titular de la cuenta"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              )}
              {esTransferenciaAgroaves && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-800">
                    <Badge variant="outline" className="mr-2 bg-blue-100 text-blue-700 border-blue-300">
                      Auto
                    </Badge>
                    Esta transferencia a Agroaves SRL se registrara tambien como pago al proveedor, descontando del saldo de cuenta corriente del proveedor.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Observaciones */}
          <div className="space-y-2">
            <Label>Observaciones (opcional)</Label>
            <Textarea
              placeholder="Notas sobre el cobro..."
              value={cuentaDestino === "Otra" ? "" : observaciones}
              onChange={(e) => {
                if (cuentaDestino !== "Otra") setObservaciones(e.target.value)
              }}
              rows={3}
              disabled={cuentaDestino === "Otra"}
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
            disabled={!clienteId || !monto || !metodoPago || (metodoPago === "transferencia" && !cuentaDestino)}
          >
            Registrar Cobro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
