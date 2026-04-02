import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Faltan variables de entorno de Supabase")
  return createClient(url, key)
}

interface MPReportRow {
  DATE?: string
  SOURCE_ID?: string
  EXTERNAL_REFERENCE?: string
  RECORD_TYPE?: string
  DESCRIPTION?: string
  NET_CREDIT_AMOUNT?: string
  NET_DEBIT_AMOUNT?: string
  GROSS_AMOUNT?: string
}

/**
 * Parsea el CSV del reporte de MP.
 * Soporta campos entre comillas y separador coma o punto y coma.
 */
function parseReportCSV(csvText: string): Array<{
  fecha: string
  descripcion: string
  id_operacion: string
  valor: number
}> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2) return []

  // Detectar separador
  const sep = lines[0].includes(";") ? ";" : ","

  const splitLine = (line: string): string[] =>
    line.split(sep).map((c) => c.replace(/^"|"$/g, "").trim())

  const headers = splitLine(lines[0]) as (keyof MPReportRow)[]

  const idx = (name: string) => headers.indexOf(name as keyof MPReportRow)

  const dateIdx = idx("DATE")
  const sourceIdx = idx("SOURCE_ID")
  const descIdx = idx("DESCRIPTION")
  const creditIdx = idx("NET_CREDIT_AMOUNT")
  const debitIdx = idx("NET_DEBIT_AMOUNT")
  const typeIdx = idx("RECORD_TYPE")

  if (dateIdx < 0 || sourceIdx < 0) {
    throw new Error("El CSV no tiene el formato esperado de reporte MP (faltan columnas DATE o SOURCE_ID)")
  }

  const movimientos: Array<{
    fecha: string
    descripcion: string
    id_operacion: string
    valor: number
  }> = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i])

    const rawDate = cols[dateIdx] ?? ""
    // DATE puede venir como "2026-01-15T12:34:56.000-03:00" o "2026-01-15"
    const fecha = rawDate.split("T")[0]
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue

    const sourceId = cols[sourceIdx] ?? ""
    if (!sourceId) continue

    // Ignorar filas de encabezado repetidas o saldo inicial/final
    const recordType = cols[typeIdx] ?? ""
    if (["OPENING_BALANCE", "CLOSING_BALANCE", "RESERVE"].includes(recordType)) continue

    const descripcion = cols[descIdx] ?? recordType ?? ""
    const credit = parseFloat((cols[creditIdx] ?? "0").replace(",", ".")) || 0
    const debit = parseFloat((cols[debitIdx] ?? "0").replace(",", ".")) || 0
    const valor = credit - Math.abs(debit)

    if (valor === 0) continue

    movimientos.push({ fecha, descripcion, id_operacion: sourceId, valor })
  }

  return movimientos
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: Request) {
  try {
    const { fechaDesde, fechaHasta } = (await request.json()) as {
      fechaDesde: string
      fechaHasta: string
    }

    if (!fechaDesde || !fechaHasta) {
      return NextResponse.json({ error: "Debe indicar fecha desde y fecha hasta" }, { status: 400 })
    }

    const accessToken = process.env.MP_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({ error: "MP_ACCESS_TOKEN no configurado" }, { status: 500 })
    }

    // MP Reports API usa UTC. Argentina es UTC-3, así que ponemos T03:00:00Z
    // para que el período empiece a medianoche argentina.
    const beginDate = `${fechaDesde}T03:00:00Z`
    const endDate = `${fechaHasta}T02:59:59Z` // día siguiente medianoche menos 1s

    // ── 1. Crear el reporte ─────────────────────────────────────────────────────
    const createRes = await fetch("https://api.mercadopago.com/v1/account/settlement-report", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        begin_date: beginDate,
        end_date: endDate,
      }),
    })

    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => null)
      const msg = errBody?.message ?? errBody?.error ?? `Error ${createRes.status}`
      if (createRes.status === 403 || createRes.status === 401) {
        return NextResponse.json(
          {
            error:
              "Tu cuenta de MercadoPago no tiene acceso a la API de Reportes. " +
              "Esta función está disponible solo para cuentas de empresa. " +
              "Usá 'Importar Resumen PDF' en su lugar.",
          },
          { status: 403 }
        )
      }
      throw new Error(`No se pudo crear el reporte: ${msg}`)
    }

    const reportData = (await createRes.json()) as {
      id?: number | string
      file_name?: string
      status?: string
    }

    if (!reportData.file_name && !reportData.id) {
      throw new Error("MP no devolvió información del reporte creado")
    }

    // ── 2. Esperar a que el reporte esté listo (polling hasta ~45 seg) ──────────
    let fileName = reportData.file_name ?? ""
    let status = reportData.status ?? "generating"

    if (status !== "available" && reportData.id) {
      for (let attempt = 0; attempt < 15; attempt++) {
        await sleep(3000) // esperar 3 segundos entre intentos

        const checkRes = await fetch(
          `https://api.mercadopago.com/v1/account/settlement-report/${reportData.id}?access_token=${accessToken}`
        )

        if (checkRes.ok) {
          const checkData = (await checkRes.json()) as {
            status?: string
            file_name?: string
          }
          status = checkData.status ?? status
          fileName = checkData.file_name ?? fileName
          if (status === "available") break
        }
      }
    }

    if (status !== "available" || !fileName) {
      throw new Error(
        "El reporte tardó demasiado en generarse. Intentá de nuevo en unos minutos."
      )
    }

    // ── 3. Descargar el archivo CSV ─────────────────────────────────────────────
    const downloadRes = await fetch(
      `https://api.mercadopago.com/v1/account/settlement-report/${fileName}?access_token=${accessToken}`
    )

    if (!downloadRes.ok) {
      throw new Error(`No se pudo descargar el reporte: ${downloadRes.status}`)
    }

    const csvText = await downloadRes.text()

    // ── 4. Parsear el CSV ───────────────────────────────────────────────────────
    const movimientosRaw = parseReportCSV(csvText)

    if (movimientosRaw.length === 0) {
      return NextResponse.json(
        { error: "El reporte no contiene movimientos para el período seleccionado" },
        { status: 400 }
      )
    }

    // ── 5. Normalizar para upsert ───────────────────────────────────────────────
    const movimientos = movimientosRaw.map((m) => ({
      id: `rpt_${m.id_operacion}`,
      fecha: m.fecha,
      tipo: m.valor >= 0 ? "ingreso" : "egreso",
      monto: Math.abs(m.valor),
      descripcion: m.descripcion,
      referencia: String(m.id_operacion),
      pagador_nombre: null,
      pagador_email: null,
      tipo_operacion: null,
      metodo_pago: null,
      estado: "sin_verificar",
    }))

    const supabase = getSupabase()

    const { error: upsertError } = await supabase
      .from("movimientos_mp")
      .upsert(movimientos, { onConflict: "id", ignoreDuplicates: false })

    if (upsertError) throw upsertError

    // ── 6. Auto-clasificar egresos sin categoria ────────────────────────────────
    let clasificados = 0
    const egresosIds = movimientos.filter((m) => m.tipo === "egreso").map((m) => m.id)

    if (egresosIds.length > 0) {
      const [{ data: reglas }, { data: sinCategoria }] = await Promise.all([
        supabase.from("reglas_categorias").select("texto_original, categoria"),
        supabase
          .from("movimientos_mp")
          .select("id, descripcion")
          .in("id", egresosIds)
          .is("categoria", null),
      ])

      if (reglas && reglas.length > 0 && sinCategoria && sinCategoria.length > 0) {
        const updates: Array<{ id: string; categoria: string }> = []
        for (const mov of sinCategoria) {
          const texto = (mov.descripcion ?? "").toLowerCase()
          const match = reglas.find((r) => texto.includes(r.texto_original.toLowerCase()))
          if (match) updates.push({ id: mov.id, categoria: match.categoria })
        }
        if (updates.length > 0) {
          await Promise.all(
            updates.map((u) =>
              supabase.from("movimientos_mp").update({ categoria: u.categoria }).eq("id", u.id)
            )
          )
          clasificados = updates.length
        }
      }
    }

    const ingresos = movimientos.filter((m) => m.tipo === "ingreso").length
    const egresos = movimientos.filter((m) => m.tipo === "egreso").length

    return NextResponse.json({
      importados: movimientos.length,
      ingresos,
      egresos,
      clasificados,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
