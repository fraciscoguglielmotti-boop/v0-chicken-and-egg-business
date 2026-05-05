import jsPDF from "jspdf"

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Gasto {
  fecha: string
  monto: number
  categoria: string
  medio_pago?: string
  descripcion?: string
}

interface EERRResult {
  totalVentas: number
  totalCMV: number
  margenBruto: number
  margenPct: number
  totalGastosOp: number
  desglose: Record<string, number>
  movimientosPorCat: Record<string, Gasto[]>
  gastosSueldos: Gasto[]
  gastosRetiros: Gasto[]
  totalSueldos: number
  totalRetiros: number
  resultadoOp: number
  resultadoOpPct: number
  resultadoFinal: number
  resultadoFinalPct: number
}

interface EERRResponse {
  month: string
  prevMonth: string
  current: EERRResult
  previous: EERRResult
}

// ─── Paleta de colores ────────────────────────────────────────────────────────

const C = {
  // Estructura
  headerBg:      [15, 23, 42] as [number,number,number],   // slate-900
  headerText:    [255,255,255] as [number,number,number],
  sectionBg:     [248,250,252] as [number,number,number],  // slate-50
  border:        [226,232,240] as [number,number,number],  // slate-200
  // Texto
  body:          [30, 41, 59] as [number,number,number],   // slate-800
  muted:         [100,116,139] as [number,number,number],  // slate-500
  // KPI positivo
  kpiPosBg:      [240,253,244] as [number,number,number],  // green-50
  kpiPosBorder:  [134,239,172] as [number,number,number],  // green-300
  kpiPosText:    [21, 128, 61] as [number,number,number],  // green-700
  // KPI negativo
  kpiNegBg:      [254,242,242] as [number,number,number],  // red-50
  kpiNegBorder:  [252,165,165] as [number,number,number],  // red-300
  kpiNegText:    [185, 28, 28] as [number,number,number],  // red-700
  // KPI neutro
  kpiNeutBg:     [239,246,255] as [number,number,number],  // blue-50
  kpiNeutBorder: [147,197,253] as [number,number,number],  // blue-300
  kpiNeutText:   [29, 78, 216] as [number,number,number],  // blue-700
  // Subtotales
  subTotalBg:    [241,245,249] as [number,number,number],  // slate-100
  // Resultado positivo
  resultPosBg:   [240,253,244] as [number,number,number],
  resultPosText: [21, 128, 61] as [number,number,number],
  resultNegBg:   [254,242,242] as [number,number,number],
  resultNegText: [185, 28, 28] as [number,number,number],
  // Barra de progreso
  barBg:         [226,232,240] as [number,number,number],
  barFill:       [99, 102, 241] as [number,number,number], // indigo-500
  barPos:        [34, 197, 94] as [number,number,number],  // green-500
  barNeg:        [239, 68, 68] as [number,number,number],  // red-500
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(n)

const fmtPct = (n: number) => `${n.toFixed(1)} %`

function monthLabel(m: string): string {
  const [y, mo] = m.split("-")
  const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                 "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
  return `${names[Number(mo) - 1]} ${y}`
}

function setFill(doc: jsPDF, rgb: [number,number,number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2])
}
function setDraw(doc: jsPDF, rgb: [number,number,number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2])
}
function setTxt(doc: jsPDF, rgb: [number,number,number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2])
}

// ─── Generador principal ──────────────────────────────────────────────────────

export async function generateEERRPdf(data: EERRResponse): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const PW = 210   // page width
  const PH = 297   // page height
  const ML = 14    // margin left
  const MR = 14    // margin right
  const UW = PW - ML - MR  // usable width

  let y = 0

  // ── HEADER ───────────────────────────────────────────────────────────────

  setFill(doc, C.headerBg)
  doc.rect(0, 0, PW, 38, "F")

  // Línea de acento superior (indigo)
  setFill(doc, [99, 102, 241])
  doc.rect(0, 0, PW, 2, "F")

  setTxt(doc, C.headerText)
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text("Estado de Resultados", ML, 16)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(148, 163, 184)  // slate-400
  doc.text("Resumen ejecutivo  |  Periodo: " + monthLabel(data.month), ML, 24)

  // Fecha de generación (derecha)
  const hoy = new Date().toLocaleDateString("es-AR", { day:"2-digit", month:"long", year:"numeric" })
  doc.setFontSize(8)
  doc.text(hoy, PW - MR, 24, { align: "right" })

  // Etiqueta comparativa
  doc.setFontSize(8)
  doc.setTextColor(203, 213, 225)  // slate-300
  doc.text("vs " + monthLabel(data.prevMonth), PW - MR, 32, { align: "right" })

  y = 46

  // ── KPI CARDS ─────────────────────────────────────────────────────────────

  const eerr = data.current
  const prev = data.previous

  const kpis = [
    {
      label: "Ventas del mes",
      value: fmt(eerr.totalVentas),
      sub: prev.totalVentas > 0
        ? `${((eerr.totalVentas - prev.totalVentas) / Math.abs(prev.totalVentas) * 100).toFixed(1)}% vs mes ant.`
        : "—",
      positive: eerr.totalVentas >= prev.totalVentas,
      neutral: true,
    },
    {
      label: "Margen Bruto",
      value: fmt(eerr.margenBruto),
      sub: fmtPct(eerr.margenPct) + " sobre ventas",
      positive: eerr.margenBruto >= 0,
    },
    {
      label: "Resultado del Período",
      value: fmt(eerr.resultadoFinal),
      sub: fmtPct(eerr.resultadoFinalPct) + " sobre ventas",
      positive: eerr.resultadoFinal >= 0,
    },
  ]

  const kpiW = (UW - 6) / 3  // 3 cards con 3mm gap
  kpis.forEach((k, i) => {
    const kx = ML + i * (kpiW + 3)
    const bg = k.neutral ? C.kpiNeutBg : k.positive ? C.kpiPosBg : C.kpiNegBg
    const border = k.neutral ? C.kpiNeutBorder : k.positive ? C.kpiPosBorder : C.kpiNegBorder
    const textC = k.neutral ? C.kpiNeutText : k.positive ? C.kpiPosText : C.kpiNegText

    setFill(doc, bg)
    setDraw(doc, border)
    doc.setLineWidth(0.4)
    doc.roundedRect(kx, y, kpiW, 26, 2, 2, "FD")

    setTxt(doc, C.muted)
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.text(k.label.toUpperCase(), kx + 5, y + 8)

    setTxt(doc, textC)
    doc.setFontSize(12.5)
    doc.setFont("helvetica", "bold")
    doc.text(k.value, kx + 5, y + 17)

    setTxt(doc, C.muted)
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.text(k.sub, kx + 5, y + 23)
  })

  y += 34

  // ── ESTADO DE RESULTADOS ──────────────────────────────────────────────────

  // Título de sección
  y = sectionTitle(doc, "Estado de Resultados", ML, y, UW)

  const lineH = 7

  const rows: Array<{
    label: string
    value: number
    indent: number
    bold: boolean
    total: boolean
    positive?: boolean   // para colorear totales
    prefix?: string
  }> = [
    { label: "Ventas netas", value: eerr.totalVentas, indent: 0, bold: false, total: false, prefix: "(+)" },
    { label: "Costo de mercadería vendida", value: -eerr.totalCMV, indent: 0, bold: false, total: false, prefix: "(-)" },
    { label: "Margen Bruto", value: eerr.margenBruto, indent: 0, bold: true, total: true, positive: eerr.margenBruto >= 0 },
    { label: "Gastos Operativos", value: -eerr.totalGastosOp, indent: 0, bold: false, total: false, prefix: "(-)" },
    ...Object.entries(eerr.desglose)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => ({ label: cat, value: -val, indent: 1, bold: false, total: false })),
    { label: "Resultado Operativo", value: eerr.resultadoOp, indent: 0, bold: true, total: true, positive: eerr.resultadoOp >= 0 },
    { label: "Sueldos y Comisiones", value: -eerr.totalSueldos, indent: 0, bold: false, total: false, prefix: "(-)" },
    ...(eerr.totalRetiros > 0
      ? [{ label: "Retiros personales", value: -eerr.totalRetiros, indent: 0, bold: false, total: false, prefix: "(-)" }]
      : []),
  ]

  for (const row of rows) {
    // Fondo para totales
    if (row.total) {
      const bg = row.positive ? C.resultPosBg : C.resultNegBg
      setFill(doc, bg)
      doc.rect(ML, y - 4.5, UW, lineH, "F")
    } else if (row.indent === 0) {
      // Línea separadora sutil
      setDraw(doc, C.border)
      doc.setLineWidth(0.15)
      doc.line(ML, y - 4.5, ML + UW, y - 4.5)
    }

    // Etiqueta
    const indentX = ML + row.indent * 8
    setTxt(doc, row.total ? (row.positive ? C.resultPosText : C.resultNegText) : C.body)
    doc.setFontSize(row.total ? 9.5 : 8.5)
    doc.setFont("helvetica", row.bold ? "bold" : "normal")

    if (row.prefix) {
      setTxt(doc, C.muted)
      doc.setFontSize(8)
      doc.text(row.prefix, ML + 1, y)
    }

    const labelX = row.prefix ? ML + 9 : indentX
    if (row.indent > 0) {
      // Bullet point para sub-ítems
      setFill(doc, C.muted)
      doc.circle(ML + 4.5, y - 1, 0.7, "F")
      setTxt(doc, C.muted)
    } else {
      setTxt(doc, row.total ? (row.positive ? C.resultPosText : C.resultNegText) : C.body)
    }
    doc.text(row.label, labelX, y)

    // Porcentaje (sólo en totales)
    if (row.total && eerr.totalVentas > 0) {
      const pct = (Math.abs(row.value) / eerr.totalVentas) * 100
      setTxt(doc, C.muted)
      doc.setFontSize(7.5)
      doc.text(fmtPct(pct), ML + UW - 44, y, { align: "right" })
    }

    // Valor (derecha)
    setTxt(doc, row.total ? (row.positive ? C.resultPosText : C.resultNegText) : C.body)
    doc.setFontSize(row.total ? 9.5 : 8.5)
    doc.setFont("helvetica", row.bold ? "bold" : "normal")
    doc.text(fmt(row.indent > 0 ? -row.value : row.value), ML + UW, y, { align: "right" })

    y += lineH
  }

  // Resultado final — bloque grande
  y += 2
  const resFinal = eerr.resultadoFinal
  const resBg = resFinal >= 0 ? C.resultPosBg : C.resultNegBg
  const resBorder = resFinal >= 0 ? C.kpiPosBorder : C.kpiNegBorder
  const resTxt = resFinal >= 0 ? C.resultPosText : C.resultNegText

  setFill(doc, resBg)
  setDraw(doc, resBorder)
  doc.setLineWidth(0.5)
  doc.roundedRect(ML, y, UW, 14, 2, 2, "FD")

  setTxt(doc, resTxt)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("= RESULTADO DEL PERÍODO", ML + 5, y + 6)

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  setTxt(doc, C.muted)
  doc.text(fmtPct(eerr.resultadoFinalPct) + " sobre ventas", ML + 5, y + 11)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  setTxt(doc, resTxt)
  doc.text(fmt(resFinal), ML + UW, y + 8, { align: "right" })

  y += 22

  // ── COMPARATIVA VS MES ANTERIOR ───────────────────────────────────────────

  // Verificar si necesitamos nueva página
  if (y > PH - 90) {
    doc.addPage()
    y = 18
  }

  y = sectionTitle(doc, "Comparativa vs Mes Anterior", ML, y, UW)

  const compRows = [
    { label: "Ventas", actual: eerr.totalVentas, ant: prev.totalVentas },
    { label: "Costo mercadería", actual: eerr.totalCMV, ant: prev.totalCMV },
    { label: "Margen Bruto", actual: eerr.margenBruto, ant: prev.margenBruto },
    { label: "Gastos Operativos", actual: eerr.totalGastosOp, ant: prev.totalGastosOp },
    { label: "Resultado Operativo", actual: eerr.resultadoOp, ant: prev.resultadoOp },
    { label: "Sueldos y Comisiones", actual: eerr.totalSueldos, ant: prev.totalSueldos },
    { label: "Resultado Final", actual: eerr.resultadoFinal, ant: prev.resultadoFinal },
  ]

  // Header de tabla
  const col1 = 60, col2 = 50, col3 = 50, col4 = UW - col1 - col2 - col3
  setFill(doc, C.headerBg)
  doc.rect(ML, y - 4.5, UW, 7, "F")
  setTxt(doc, C.headerText)
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.text("Concepto", ML + 3, y)
  doc.text(monthLabel(data.month), ML + col1 + col2, y, { align: "right" })
  doc.text(monthLabel(data.prevMonth), ML + col1 + col2 + col3, y, { align: "right" })
  doc.text("Variación", ML + UW, y, { align: "right" })
  y += 4

  compRows.forEach((row, idx) => {
    if (idx % 2 === 0) {
      setFill(doc, C.sectionBg)
      doc.rect(ML, y - 4.5, UW, 7, "F")
    }
    const delta = row.ant !== 0 ? ((row.actual - row.ant) / Math.abs(row.ant)) * 100 : 0
    const up = delta >= 0

    setTxt(doc, C.body)
    doc.setFont("helvetica", row.label === "Resultado Final" ? "bold" : "normal")
    doc.setFontSize(8.5)
    doc.text(row.label, ML + 3, y)

    setTxt(doc, C.body)
    doc.text(fmt(row.actual), ML + col1 + col2, y, { align: "right" })
    setTxt(doc, C.muted)
    doc.text(fmt(row.ant), ML + col1 + col2 + col3, y, { align: "right" })

    if (row.ant !== 0) {
      setTxt(doc, up ? C.kpiPosText : C.kpiNegText)
      doc.setFont("helvetica", "bold")
      doc.text(`${up ? "+" : "-"}${Math.abs(delta).toFixed(1)}%`, ML + UW, y, { align: "right" })
    } else {
      setTxt(doc, C.muted)
      doc.text("—", ML + UW, y, { align: "right" })
    }

    y += 7
  })

  y += 6

  // ── DESGLOSE DE GASTOS OPERATIVOS ─────────────────────────────────────────

  const gastosEntries = Object.entries(eerr.desglose).sort((a, b) => b[1] - a[1])
  if (gastosEntries.length > 0) {
    if (y > PH - 60) {
      doc.addPage()
      y = 18
    }

    y = sectionTitle(doc, "Desglose de Gastos Operativos", ML, y, UW)

    const maxVal = gastosEntries[0][1]
    const barMaxW = UW * 0.42
    const catColW = UW * 0.31
    const valColW = UW * 0.18

    gastosEntries.forEach(([cat, val], idx) => {
      if (y > PH - 14) {
        doc.addPage()
        y = 18
      }
      if (idx % 2 === 0) {
        setFill(doc, C.sectionBg)
        doc.rect(ML, y - 4.5, UW, 8, "F")
      }

      setTxt(doc, C.body)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      doc.text(cat, ML + 3, y)

      // Barra
      const barX = ML + catColW
      const barW = (val / maxVal) * barMaxW
      const barY = y - 3.5
      const barH = 4

      setFill(doc, C.barBg)
      doc.roundedRect(barX, barY, barMaxW, barH, 1, 1, "F")
      setFill(doc, C.barFill)
      doc.roundedRect(barX, barY, barW, barH, 1, 1, "F")

      // Valor y porcentaje
      setTxt(doc, C.body)
      doc.setFont("helvetica", "bold")
      doc.text(fmt(val), ML + catColW + barMaxW + valColW, y, { align: "right" })

      setTxt(doc, C.muted)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7.5)
      const pct = eerr.totalGastosOp > 0 ? (val / eerr.totalGastosOp) * 100 : 0
      doc.text(fmtPct(pct), ML + UW, y, { align: "right" })

      y += 8
    })
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────

  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    setFill(doc, C.sectionBg)
    doc.rect(0, PH - 10, PW, 10, "F")
    setDraw(doc, C.border)
    doc.setLineWidth(0.3)
    doc.line(0, PH - 10, PW, PH - 10)

    setTxt(doc, C.muted)
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.text(`Estado de Resultados — ${monthLabel(data.month)}`, ML, PH - 4)
    doc.text(`Página ${i} de ${pageCount}`, PW - MR, PH - 4, { align: "right" })
    doc.text("Generado: " + hoy, PW / 2, PH - 4, { align: "center" })
  }

  const filename = `EERR-${data.month}.pdf`
  doc.save(filename)
}

// ─── Helpers de layout ────────────────────────────────────────────────────────

function sectionTitle(doc: jsPDF, title: string, x: number, y: number, w: number): number {
  setFill(doc, [15, 23, 42])  // slate-900
  doc.rect(x, y, w, 8, "F")

  // Acento lateral izquierdo
  setFill(doc, [99, 102, 241])  // indigo-500
  doc.rect(x, y, 3, 8, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(title.toUpperCase(), x + 7, y + 5.5)

  return y + 14
}
