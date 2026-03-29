"use client"

// Para usar este componente, la tabla "reglas_categorias" debe existir en Supabase.
// SQL para crearla:
//
// create table if not exists reglas_categorias (
//   id uuid primary key default gen_random_uuid(),
//   texto_original text not null,
//   categoria text not null,
//   proveedor text,
//   created_at timestamptz default now()
// );
// alter table reglas_categorias enable row level security;
// create policy "Allow all" on reglas_categorias for all using (true) with check (true);

import { useState, useRef } from "react"
import { Upload, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { insertRow, queryRows } from "@/hooks/use-supabase"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const CATEGORIAS = [
  "Combustibles",
  "Sueldos",
  "Comisiones",
  "Servicios",
  "Mantenimiento",
  "Alquiler",
  "Impuestos",
  "Otros",
]

interface ReglaCategorias {
  id: string
  texto_original: string
  categoria: string
  proveedor: string
  created_at: string
}

interface GastoExtraido {
  descripcion_original: string
  monto: number
  fecha: string | null
}

interface GastoReview extends GastoExtraido {
  categoria: string
  proveedor: string
  regla_existe: boolean
}

type Step = "upload" | "loading" | "review" | "saving" | "done"

const TARJETAS_IMPORT = ["Visa (empresa)", "Visa (personal Francisco)", "Visa (Damián)", "Master", "Tarjeta MP"]

interface ImportarTarjetaProps {
  onClose: () => void
  onImportComplete: () => void
}

export function ImportarTarjeta({ onClose, onImportComplete }: ImportarTarjetaProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>("upload")
  const [error, setError] = useState<string | null>(null)
  const [gastosReview, setGastosReview] = useState<GastoReview[]>([])
  const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState("")
  const [fechaPago, setFechaPago] = useState("")

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setStep("loading")

    try {
      // 1. Send PDF to Claude for extraction
      const form = new FormData()
      form.append("file", file)
      const response = await fetch("/api/parse-credit-card", { method: "POST", body: form })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || "Error al procesar el PDF")
      if (!Array.isArray(data.gastos)) throw new Error("El servidor no devolvió gastos válidos. Verificá que el PDF sea un resumen de tarjeta.")

      const gastosExtraidos: GastoExtraido[] = data.gastos

      // 2. Load all matching rules from Supabase
      const reglas = await queryRows<ReglaCategorias>("reglas_categorias")

      // 3. Match each extracted gasto against existing rules (case-insensitive substring)
      const today = new Date().toISOString().split("T")[0]
      const revisados: GastoReview[] = gastosExtraidos.map((g) => {
        const match = reglas.find((r) =>
          g.descripcion_original.toLowerCase().includes(r.texto_original.toLowerCase())
        )
        return {
          ...g,
          fecha: g.fecha ?? today,
          categoria: match?.categoria ?? "",
          proveedor: match?.proveedor ?? "",
          regla_existe: !!match,
        }
      })

      setGastosReview(revisados)
      setStep("review")
    } catch (err: any) {
      setError(err.message || "Error desconocido")
      setStep("upload")
      // Reset file input so the same file can be retried
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const updateGasto = (index: number, field: "categoria" | "proveedor", value: string) => {
    setGastosReview((prev) =>
      prev.map((g, i) => (i === index ? { ...g, [field]: value } : g))
    )
  }

  const handleConfirm = async () => {
    setStep("saving")
    try {
      // 1. Collect new rules from manually categorized gastos (deduplicated)
      const nuevasReglas = new Map<string, GastoReview>()
      for (const g of gastosReview) {
        if (!g.regla_existe && g.categoria && !nuevasReglas.has(g.descripcion_original)) {
          nuevasReglas.set(g.descripcion_original, g)
        }
      }

      // Insert new rules in parallel
      await Promise.all(
        Array.from(nuevasReglas.values()).map((g) =>
          insertRow("reglas_categorias", {
            texto_original: g.descripcion_original,
            categoria: g.categoria,
            proveedor: g.proveedor || null,
          })
        )
      )

      // 2. Save all gastos in parallel — use "Otros" fallback so categoria is never null
      await Promise.all(
        gastosReview.map((g) =>
          insertRow("gastos", {
            fecha: g.fecha,
            tipo: "Egreso",
            categoria: g.categoria || "Otros",
            descripcion: g.descripcion_original,
            monto: g.monto,
            medio_pago: "Tarjeta Credito",
            tarjeta: tarjetaSeleccionada || null,
            fecha_pago: fechaPago || null,
          })
        )
      )

      toast({
        title: "Importación exitosa",
        description: `Se importaron ${gastosReview.length} gastos.${nuevasReglas.size > 0 ? ` Se guardaron ${nuevasReglas.size} nuevas reglas.` : ""}`,
      })
      onImportComplete()
      setStep("done")
    } catch (err: any) {
      toast({ title: "Error al importar", description: err.message, variant: "destructive" })
      setStep("review")
    }
  }

  // ─── UPLOAD / LOADING ───────────────────────────────────────────────────────

  if (step === "upload" || step === "loading") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Importar resumen de tarjeta de crédito</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tarjeta</label>
            <Select value={tarjetaSeleccionada} onValueChange={setTarjetaSeleccionada}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tarjeta" />
              </SelectTrigger>
              <SelectContent>
                {TARJETAS_IMPORT.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Fecha de pago del resumen</label>
            <Input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
          </div>
        </div>

        <div
          className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/25 p-16 cursor-pointer hover:border-muted-foreground/50 transition-colors"
          onClick={() => step === "upload" && fileInputRef.current?.click()}
        >
          {step === "loading" ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">Procesando PDF con IA…</p>
                <p className="text-sm text-muted-foreground mt-1">Esto puede tardar unos segundos</p>
              </div>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">Subir resumen de tarjeta en PDF</p>
                <p className="text-sm text-muted-foreground mt-1">Hacé clic para seleccionar un archivo PDF</p>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={step === "loading"}
        />

        <div className="flex justify-start">
          <Button variant="outline" onClick={onClose} disabled={step === "loading"}>
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  // ─── DONE ───────────────────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-xl font-semibold">¡Importación completada!</h2>
        <p className="text-muted-foreground">
          Se guardaron {gastosReview.length} gastos en el sistema.
        </p>
        <Button onClick={onClose}>Volver al listado</Button>
      </div>
    )
  }

  // ─── REVIEW ─────────────────────────────────────────────────────────────────

  const sinCategoria = gastosReview.filter((g) => !g.categoria).length
  const conRegla = gastosReview.filter((g) => g.regla_existe).length
  const manuales = gastosReview.filter((g) => !g.regla_existe && g.categoria).length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Revisar gastos extraídos</h2>
          <div className="flex flex-wrap gap-3 mt-1">
            <span className="text-sm text-muted-foreground">{gastosReview.length} gastos encontrados</span>
            {tarjetaSeleccionada && <Badge variant="outline">{tarjetaSeleccionada}</Badge>}
            {fechaPago && <Badge variant="outline">Vence: {new Date(fechaPago + "T12:00:00").toLocaleDateString()}</Badge>}
            <Badge variant="secondary">{conRegla} categorizados automáticamente</Badge>
            {sinCategoria > 0 && (
              <Badge variant="destructive">{sinCategoria} sin categoría</Badge>
            )}
            {manuales > 0 && (
              <Badge variant="outline">{manuales} categorizados manualmente</Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-lg border overflow-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className="text-left p-3 font-semibold">Descripcion</th>
              <th className="text-left p-3 font-semibold whitespace-nowrap">Fecha</th>
              <th className="text-right p-3 font-semibold whitespace-nowrap">Monto</th>
              <th className="text-left p-3 font-semibold min-w-[170px]">Categoria</th>
              <th className="text-left p-3 font-semibold min-w-[150px]">Proveedor</th>
            </tr>
          </thead>
          <tbody>
            {gastosReview.map((g, i) => (
              <tr key={i} className="border-t hover:bg-muted/20">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="truncate max-w-[260px] block"
                      title={g.descripcion_original}
                    >
                      {g.descripcion_original}
                    </span>
                    {g.regla_existe && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Auto
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="p-3 whitespace-nowrap text-muted-foreground">
                  {g.fecha ? formatDate(new Date(g.fecha)) : "-"}
                </td>
                <td className="p-3 text-right font-semibold text-destructive whitespace-nowrap">
                  {formatCurrency(g.monto)}
                </td>
                <td className="p-3">
                  <Select
                    value={g.categoria}
                    onValueChange={(value) => updateGasto(i, "categoria", value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">
                  <Input
                    className="h-8 text-xs"
                    value={g.proveedor}
                    placeholder="Proveedor"
                    onChange={(e) => updateGasto(i, "proveedor", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onClose} disabled={step === "saving"}>
          Cancelar
        </Button>
        <div className="flex items-center gap-4">
          {sinCategoria > 0 && (
            <p className="text-sm text-muted-foreground">
              {sinCategoria} gasto{sinCategoria !== 1 ? "s" : ""} se guardar{sinCategoria !== 1 ? "án" : "á"} sin categoría
            </p>
          )}
          <Button onClick={handleConfirm} disabled={step === "saving"}>
            {step === "saving" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar importación ({gastosReview.length})
          </Button>
        </div>
      </div>
    </div>
  )
}
