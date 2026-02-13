"use client"

import { useState, useEffect, useCallback } from "react"
import { parseDate, parseSheetNumber, formatCurrency, formatDateInput } from "@/lib/utils"
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

export interface CobroEditData {
  rowIndex: number
  fecha: string
  clienteId: string
  clienteNombre: string
  monto: number
  metodoPago: string
  observaciones: string
}

interface NuevoCobroDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (cobro: Cobro, esProveedor?: boolean, cuentaDestino?: string) => void
  onUpdate?: (rowIndex: number, cobro: Cobro) => void
  onDelete?: (rowIndex: number) => void
  editData?: CobroEditData | null
}

export function NuevoCobroDialog({
  open,
  onOpenChange,
  onSubmit,
  onUpdate,
  onDelete,
  editData,
}: NuevoCobroDialogProps) {
  const sheetsClientes = useSheet("Clientes")
  const [clienteId, setClienteId] = useState("")
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [monto, setMonto] = useState("")
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia" | "">("")
  const [cuentaDestino, setCuentaDestino] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const allClientes = sheetsClientes.rows.length > 0
    ? sheetsClientes.rows.map((r, i) => ({
        id: r.ID || String(i),
        nombre: r.Nombre || "",
        saldoActual: parseSheetNumber(r.Saldo),
      }))
    : clientesIniciales.map((c) => ({ id: c.id, nombre: c.nombre, saldoActual: c.saldoActual }))

  const cliente = allClientes.find((c) => c.id === clienteId)
  const esTransferenciaAgroaves = metodoPago === "transferencia" && cuentaDestino.toLowerCase().includes("agroaves")

  useEffect(() => {
    if (editData && open) {
      setFecha(editData.fecha)
      setMonto(String(editData.monto))
      setMetodoPago((editData.metodoPago as "efectivo" | "transferencia") || "efectivo")
      setObservaciones(editData.observaciones || "")
      const c = allClientes.find((cl) => cl.nombre === editData.clienteNombre)
      setClienteId(c?.id || "")
    } else if (!open) {
      resetForm()
    }
  }, [editData, open])

  const resetForm = () => {
    setClienteId("")
    setFecha(new Date().toISOString().split("T")[0])
    setMonto("")
    setMetodoPago("")
    setCuentaDestino("")
    setObservaciones("")
    setErrors({})
    setConfirmDelete(false)
  }

  const handleClose = useCallback(() => {
    onOpenChange(false)
    resetForm()
  }, [onOpenChange])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!clienteId) newErrors.cliente = "Seleccione un cliente"
    if (!monto || Number.parseFloat(monto) <= 0) newErrors.monto = "Monto debe ser mayor a 0"
    if (!metodoPago) newErrors.metodo = "Seleccione un metodo"
    if (metodoPago === "transferencia" && !cuentaDestino) newErrors.cuenta = "Seleccione cuenta destino"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const cobro: Cobro = {
      id: editData ? String(editData.rowIndex) : Date.now().toString(),
      fecha: parseDate(fecha),
      clienteId: cliente?.nombre || "",
      clienteNombre: cliente?.nombre || "",
      monto: Number.parseFloat(monto),
      metodoPago: metodoPago as "efectivo" | "transferencia",
      observaciones: observaciones || undefined,
      createdAt: new Date(),
    }
    if (editData && onUpdate) {
      onUpdate(editData.rowIndex, cobro)
    } else {
      onSubmit(cobro, esTransferenciaAgroaves, cuentaDestino || undefined)
    }
    handleClose()
  }

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    if (editData && onDelete) { onDelete(editData.rowIndex); handleClose() }
  }

  const isEditing = !!editData
  const montoNum = Number.parseFloat(monto) || 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" onEscapeKeyDown={handleClose}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Cobro" : "Registrar Cobro"}</DialogTitle>
          <DialogDescription>{isEditing ? "Modifique los datos del cobro" : "Registre un cobro de cliente"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={(v) => { setClienteId(v); setErrors((e) => ({ ...e, cliente: "" })) }}>
              <SelectTrigger className={errors.cliente ? "border-destructive" : ""}>
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {allClientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{c.nombre}</span>
                      {c.saldoActual > 0 && <span className="text-xs text-muted-foreground">Saldo: {formatCurrency(c.saldoActual)}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.cliente && <p className="text-xs text-destructive">{errors.cliente}</p>}
          </div>

          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Monto</Label>
            <Input
              type="number"
              placeholder="0"
              value={monto}
              onChange={(e) => { setMonto(e.target.value); setErrors((er) => ({ ...er, monto: "" })) }}
              className={errors.monto ? "border-destructive" : ""}
              min="0.01"
              step="any"
            />
            {errors.monto && <p className="text-xs text-destructive">{errors.monto}</p>}
          </div>

          <div className="space-y-2">
            <Label>Metodo de Cobro</Label>
            <Select
              value={metodoPago}
              onValueChange={(v) => {
                setMetodoPago(v as "efectivo" | "transferencia")
                if (v !== "transferencia") setCuentaDestino("")
                setErrors((e) => ({ ...e, metodo: "" }))
              }}
            >
              <SelectTrigger className={errors.metodo ? "border-destructive" : ""}>
                <SelectValue placeholder="Seleccionar metodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>
            {errors.metodo && <p className="text-xs text-destructive">{errors.metodo}</p>}
          </div>

          {metodoPago === "transferencia" && (
            <div className="space-y-2">
              <Label>Cuenta Destino</Label>
              <Select value={cuentaDestino} onValueChange={(v) => { setCuentaDestino(v); setErrors((e) => ({ ...e, cuenta: "" })) }}>
                <SelectTrigger className={errors.cuenta ? "border-destructive" : ""}>
                  <SelectValue placeholder="Seleccionar cuenta destino" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Agroaves SRL">Agroaves SRL</SelectItem>
                  <SelectItem value="Cuenta Personal">Cuenta Personal</SelectItem>
                  <SelectItem value="Otra">Otra cuenta</SelectItem>
                </SelectContent>
              </Select>
              {errors.cuenta && <p className="text-xs text-destructive">{errors.cuenta}</p>}
              {esTransferenciaAgroaves && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-800">
                    <Badge variant="outline" className="mr-2 bg-blue-100 text-blue-700 border-blue-300">Auto</Badge>
                    Esta transferencia se registrara tambien como pago al proveedor.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Observaciones (opcional)</Label>
            <Textarea placeholder="Notas sobre el cobro..." value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} />
          </div>

          {montoNum > 0 && (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Monto a registrar</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(montoNum)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {isEditing && onDelete && (
            <Button variant="destructive" onClick={handleDelete} className="sm:mr-auto">
              {confirmDelete ? "Confirmar Eliminacion" : "Eliminar"}
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!clienteId || !monto || !metodoPago}>
            {isEditing ? "Guardar Cambios" : "Registrar Cobro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
