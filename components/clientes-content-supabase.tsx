"use client"

import { useState, useMemo } from "react"
import { Plus, Search, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "./data-table"
import { useSupabase, insertRow, updateRow, deleteRow, queryRows } from "@/hooks/use-supabase"
import { formatCurrency } from "@/lib/utils"

interface Cliente {
  id: string
  nombre: string
  cuit: string | null
  telefono: string | null
  direccion: string | null
  saldo_inicial: number
  fecha_alta: string
  created_at: string
}

interface Venta {
  id: string
  cliente_nombre: string
  cantidad: number
  precio_unitario: number
}

interface Cobro {
  id: string
  cliente_nombre: string
  monto: number
}

export function ClientesContent() {
  const { data: clientes, isLoading, error, mutate } = useSupabase<Cliente>("clientes")
  const { data: ventas } = useSupabase<Venta>("ventas")
  const { data: cobros } = useSupabase<Cobro>("cobros")

  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editClienteId, setEditClienteId] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre: "",
    cuit: "",
    telefono: "",
    direccion: "",
    saldo_inicial: "0",
  })

  // Calculate balances
  const clientesConSaldo = useMemo(() => {
    return clientes.map((cliente) => {
      const clienteKey = cliente.nombre.toLowerCase().trim()
      
      const totalVentas = ventas
        .filter((v) => v.cliente_nombre.toLowerCase().trim() === clienteKey)
        .reduce((sum, v) => sum + (v.cantidad * v.precio_unitario), 0)

      const totalCobros = cobros
        .filter((c) => c.cliente_nombre.toLowerCase().trim() === clienteKey)
        .reduce((sum, c) => sum + c.monto, 0)

      const saldoCalculado = cliente.saldo_inicial + totalVentas - totalCobros

      return {
        ...cliente,
        totalVentas,
        totalCobros,
        saldoCalculado,
      }
    })
  }, [clientes, ventas, cobros])

  const filtered = clientesConSaldo.filter((c) =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleOpenDialog = (cliente?: typeof clientesConSaldo[0]) => {
    if (cliente) {
      setEditClienteId(cliente.id)
      setForm({
        nombre: cliente.nombre,
        cuit: cliente.cuit || "",
        telefono: cliente.telefono || "",
        direccion: cliente.direccion || "",
        saldo_inicial: String(cliente.saldo_inicial),
      })
    } else {
      setEditClienteId(null)
      setForm({ nombre: "", cuit: "", telefono: "", direccion: "", saldo_inicial: "0" })
    }
    setDialogOpen(true)
  }

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const data = {
        nombre: form.nombre.trim(),
        cuit: form.cuit.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        saldo_inicial: parseFloat(form.saldo_inicial) || 0,
      }

      if (editClienteId) {
        await updateRow("clientes", editClienteId, data)
      } else {
        await insertRow("clientes", data)
      }

      await mutate()
      setDialogOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este cliente?")) return
    try {
      await deleteRow("clientes", id)
      await mutate()
    } catch (err) {
      console.error(err)
    }
  }

  const columns = [
    { header: "Nombre", accessorKey: "nombre" },
    { header: "CUIT", accessorKey: "cuit", cell: (row: any) => row.cuit || "-" },
    { header: "Teléfono", accessorKey: "telefono", cell: (row: any) => row.telefono || "-" },
    { header: "Ventas", accessorKey: "totalVentas", cell: (row: any) => formatCurrency(row.totalVentas) },
    { header: "Cobros", accessorKey: "totalCobros", cell: (row: any) => formatCurrency(row.totalCobros) },
    {
      header: "Saldo",
      accessorKey: "saldoCalculado",
      cell: (row: any) => (
        <span className={row.saldoCalculado > 0 ? "text-red-600 font-medium" : row.saldoCalculado < 0 ? "text-green-600 font-medium" : ""}>
          {formatCurrency(row.saldoCalculado)}
        </span>
      ),
    },
    {
      header: "",
      accessorKey: "actions",
      cell: (row: any) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-600">Error al cargar datos</div>
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editClienteId ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <Label>CUIT</Label>
              <Input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div>
              <Label>Saldo Inicial</Label>
              <Input type="number" value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={saving || !form.nombre.trim()}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
