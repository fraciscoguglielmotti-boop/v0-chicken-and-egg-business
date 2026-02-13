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
import { proveedoresIniciales } from "@/lib/store"
import type { Pago } from "@/lib/types"
import { useSheet } from "@/hooks/use-sheets"

export interface PagoEditData {
  rowIndex: number
  fecha: string
  proveedorId: string
  proveedorNombre: string
  monto: number
  metodoPago: string
  observaciones: string
}

interface NuevoPagoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (pago: Pago) => void
  onUpdate?: (rowIndex: number, pago: Pago) => void
  onDelete?: (rowIndex: number) => void
  editData?: PagoEditData | null
}

export function NuevoPagoDialog({
  open,
  onOpenChange,
  onSubmit,
  onUpdate,
  onDelete,
  editData,
}: NuevoPagoDialogProps) {
  const sheetsProveedores = useSheet("Proveedores")
  const [proveedorId, setProveedorId] = useState("")
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])
  const [monto, setMonto] = useState("")
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia" | "">("")
  const [observaciones, setObservaciones] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const allProveedores = sheetsProveedores.rows.length > 0
    ? sheetsProveedores.rows.map((r, i) => ({ id: r.ID || String(i), nombre: r.Nombre || "", saldoActual: parseSheetNumber(r.Saldo) }))
    : proveedoresIniciales.map((p) => ({ id: p.id, nombre: p.nombre, saldoActual: p.saldoActual }))

  const proveedor = allProveedores.find((p) => p.id === proveedorId)

  useEffect(() => {
    if (editData && open) {
      setFecha(editData.fecha)
      setMonto(String(editData.monto))
      setMetodoPago((editData.metodoPago as "efectivo" | "transferencia") || "efectivo")
      setObservaciones(editData.observaciones || "")
      const p = allProveedores.find((pr) => pr.nombre === editData.proveedorNombre)
      setProveedorId(p?.id || "")
    } else if (!open) {
      resetForm()
    }
  }, [editData, open])

  const resetForm = () => {
    setProveedorId("")
    setFecha(new Date().toISOString().split("T")[0])
    setMonto("")
    setMetodoPago("")
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
    if (!proveedorId) newErrors.proveedor = "Seleccione un proveedor"
    if (!monto || Number.parseFloat(monto) <= 0) newErrors.monto = "Monto debe ser mayor a 0"
    if (!metodoPago) newErrors.metodo = "Seleccione un metodo"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const pago: Pago = {
      id: editData ? String(editData.rowIndex) : Date.now().toString(),
      fecha: parseDate(fecha),
      proveedorId: proveedor?.nombre || "",
      proveedorNombre: proveedor?.nombre || "",
      monto: Number.parseFloat(monto),
      metodoPago: metodoPago as "efectivo" | "transferencia",
      observaciones: observaciones || undefined,
      createdAt: new Date(),
    }
    if (editData && onUpdate) {
      onUpdate(editData.rowIndex, pago)
    } else {
      onSubmit(pago)
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
          <DialogTitle>{isEditing ? "Editar Pago" : "Registrar Pago a Proveedor"}</DialogTitle>
          <DialogDescription>{isEditing ? "Modifique los datos del pago" : "Complete los datos del pago al proveedor"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Proveedor</Label>
            <Select value={proveedorId} onValueChange={(v) => { setProveedorId(v); setErrors((e) => ({ ...e, proveedor: "" })) }}>
              <SelectTrigger className={errors.proveedor ? "border-destructive" : ""}>
                <SelectValue placeholder="Seleccionar proveedor" />
              </SelectTrigger>
              <SelectContent>
                {allProveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{p.nombre}</span>
                      {p.saldoActual > 0 && <span className="text-xs text-muted-foreground">Debe: {formatCurrency(p.saldoActual)}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.proveedor && <p className="text-xs text-destructive">{errors.proveedor}</p>}
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
            <Label>Metodo de Pago</Label>
            <Select value={metodoPago} onValueChange={(v) => { setMetodoPago(v as "efectivo" | "transferencia"); setErrors((e) => ({ ...e, metodo: "" })) }}>
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

          <div className="space-y-2">
            <Label>Observaciones (opcional)</Label>
            <Textarea placeholder="Notas sobre el pago..." value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} />
          </div>

          {montoNum > 0 && (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Monto a pagar</span>
                <span className="text-xl font-bold text-destructive">{formatCurrency(montoNum)}</span>
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
          <Button onClick={handleSubmit} disabled={!proveedorId || !monto || !metodoPago}>
            {isEditing ? "Guardar Cambios" : "Registrar Pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
