import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

// Configurar estas variables de entorno:
//   RESEND_API_KEY   → clave de API de Resend (https://resend.com)
//   RESEND_FROM      → dirección remitente, ej: "Reportes <reportes@tudominio.com>"
//   RESEND_TO        → tu casilla de email destino

function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n)
}

function deltaArrow(delta: number) {
  return delta >= 0 ? `▲ +${delta}%` : `▼ ${delta}%`
}

// ─── Templates HTML ───────────────────────────────────────────────────────────

function buildEmailDiario(datos: any): string {
  const { fecha, ventas, cobros, pedidos, topClientes, gastos } = datos
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Reporte Diario</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="background:#16a34a;padding:20px;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">Reporte Diario</h1>
    <p style="color:#dcfce7;margin:4px 0 0;font-size:14px;">${fecha}</p>
  </div>

  <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
    <!-- KPIs -->
    <table width="100%" cellpadding="12" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:#f0fdf4;border-radius:8px;text-align:center;">
          <div style="font-size:12px;color:#6b7280;">Ventas del Día</div>
          <div style="font-size:20px;font-weight:bold;">${formatCurrency(ventas.hoy)}</div>
          <div style="font-size:12px;color:${ventas.delta >= 0 ? '#16a34a' : '#dc2626'};">${deltaArrow(ventas.delta)} vs ayer</div>
        </td>
        <td width="8"></td>
        <td style="background:#eff6ff;border-radius:8px;text-align:center;">
          <div style="font-size:12px;color:#6b7280;">Cobros del Día</div>
          <div style="font-size:20px;font-weight:bold;">${formatCurrency(cobros.hoy)}</div>
          <div style="font-size:12px;color:${cobros.delta >= 0 ? '#16a34a' : '#dc2626'};">${deltaArrow(cobros.delta)} vs ayer</div>
        </td>
        <td width="8"></td>
        <td style="background:#fefce8;border-radius:8px;text-align:center;">
          <div style="font-size:12px;color:#6b7280;">Pedidos</div>
          <div style="font-size:20px;font-weight:bold;">${pedidos.hoy}</div>
          <div style="font-size:12px;color:${pedidos.delta >= 0 ? '#16a34a' : '#dc2626'};">${deltaArrow(pedidos.delta)} vs ayer</div>
        </td>
      </tr>
    </table>

    <!-- Top clientes -->
    ${topClientes.length > 0 ? `
    <h3 style="font-size:14px;margin:0 0 10px;color:#374151;">Top Clientes del Día</h3>
    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;">
      ${topClientes.map((c: any, i: number) => `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="font-size:13px;"><strong>${i + 1}.</strong> ${c.nombre}</td>
          <td style="text-align:right;font-size:13px;font-weight:bold;">${formatCurrency(c.monto)}</td>
        </tr>
      `).join("")}
    </table>` : ""}

    <!-- Gastos -->
    <div style="background:#fafafa;padding:12px;border-radius:6px;display:flex;justify-content:space-between;">
      <span style="font-size:13px;color:#6b7280;">Gastos del Día</span>
      <span style="font-size:14px;font-weight:bold;">${formatCurrency(gastos)}</span>
    </div>
  </div>

  <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:12px;">
    Generado automáticamente por AviGest
  </p>
</body>
</html>`
}

function buildEmailSemanal(datos: any): string {
  const { semana, ventas, cobros, cajonesSemana, clientesActivos, pendiente, ticketPromedioPorCliente, tasaCobranza, topClientes, desglose } = datos
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Reporte Semanal</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="background:#2563eb;padding:20px;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">Reporte Semanal</h1>
    <p style="color:#dbeafe;margin:4px 0 0;font-size:14px;">${semana}</p>
  </div>

  <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
    <table width="100%" cellpadding="10" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:#f0fdf4;border-radius:8px;text-align:center;">
          <div style="font-size:12px;color:#6b7280;">Ventas</div>
          <div style="font-size:18px;font-weight:bold;">${formatCurrency(ventas.semana)}</div>
          <div style="font-size:11px;color:${ventas.delta >= 0 ? '#16a34a' : '#dc2626'};">${deltaArrow(ventas.delta)} vs semana ant.</div>
        </td>
        <td width="8"></td>
        <td style="background:#eff6ff;border-radius:8px;text-align:center;">
          <div style="font-size:12px;color:#6b7280;">Cobros</div>
          <div style="font-size:18px;font-weight:bold;">${formatCurrency(cobros.semana)}</div>
          <div style="font-size:11px;color:${cobros.delta >= 0 ? '#16a34a' : '#dc2626'};">${deltaArrow(cobros.delta)} vs semana ant.</div>
        </td>
        <td width="8"></td>
        <td style="background:#fefce8;border-radius:8px;text-align:center;">
          <div style="font-size:12px;color:#6b7280;">Pendiente</div>
          <div style="font-size:18px;font-weight:bold;">${formatCurrency(pendiente)}</div>
        </td>
        <td width="8"></td>
        <td style="background:#fdf4ff;border-radius:8px;text-align:center;">
          <div style="font-size:12px;color:#6b7280;">Tasa Cobranza</div>
          <div style="font-size:18px;font-weight:bold;">${tasaCobranza}%</div>
          ${tasaCobranza > 100 ? `<div style="font-size:9px;color:#d97706;">Incl. cobros ant.</div>` : ""}
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:20px;background:#f9fafb;border-radius:6px;">
      <tr>
        <td style="text-align:center;border-right:1px solid #e5e7eb;font-size:12px;">
          <div style="color:#6b7280;font-size:11px;">Cajones Vendidos</div>
          <div style="font-weight:bold;">${cajonesSemana}</div>
        </td>
        <td style="text-align:center;border-right:1px solid #e5e7eb;font-size:12px;">
          <div style="color:#6b7280;font-size:11px;">Clientes Activos</div>
          <div style="font-weight:bold;">${clientesActivos}</div>
        </td>
        <td style="text-align:center;font-size:12px;">
          <div style="color:#6b7280;font-size:11px;">Ticket Prom./Cliente</div>
          <div style="font-weight:bold;">${formatCurrency(ticketPromedioPorCliente)}</div>
        </td>
      </tr>
    </table>

    ${topClientes?.length > 0 ? `
    <h3 style="font-size:14px;margin:0 0 10px;color:#374151;">Top 5 Clientes</h3>
    <table width="100%" cellpadding="7" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;">
      ${topClientes.map((c: any, i: number) => `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="font-size:13px;">${i + 1}. ${c.nombre}</td>
          <td style="text-align:right;font-size:13px;font-weight:bold;">${formatCurrency(c.monto)}</td>
        </tr>
      `).join("")}
    </table>` : ""}

    ${desglose?.length > 0 ? `
    <h3 style="font-size:14px;margin:0 0 10px;color:#374151;">Desglose por Producto</h3>
    <table width="100%" cellpadding="7" cellspacing="0" style="border-collapse:collapse;">
      ${desglose.map((p: any) => `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="font-size:13px;">${p.producto}</td>
          <td style="text-align:center;font-size:12px;color:#6b7280;">${p.unidades.toLocaleString("es-AR")} u.</td>
          <td style="text-align:right;font-size:13px;font-weight:bold;">${formatCurrency(p.ingresos)}</td>
        </tr>
      `).join("")}
    </table>` : ""}
  </div>

  <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:12px;">Generado automáticamente por AviGest</p>
</body>
</html>`
}

function buildEmailMensual(datos: any): string {
  const { mes, resumen, vs_mes_anterior, kpis, topClientes } = datos
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Reporte Mensual</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="background:#7c3aed;padding:20px;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">Reporte Mensual</h1>
    <p style="color:#ede9fe;margin:4px 0 0;font-size:14px;">${mes}</p>
  </div>

  <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
    <!-- Resumen ejecutivo -->
    <h3 style="font-size:14px;margin:0 0 12px;color:#374151;">Resumen Ejecutivo</h3>
    <table width="100%" cellpadding="10" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;background:#f9fafb;border-radius:8px;">
      <tr>
        <td style="text-align:center;border-right:1px solid #e5e7eb;">
          <div style="font-size:11px;color:#6b7280;">Ventas Totales</div>
          <div style="font-size:17px;font-weight:bold;">${formatCurrency(resumen.ventas)}</div>
          <div style="font-size:11px;color:${vs_mes_anterior.ventas >= 0 ? '#16a34a' : '#dc2626'};">${deltaArrow(vs_mes_anterior.ventas)} vs mes ant.</div>
        </td>
        <td style="text-align:center;border-right:1px solid #e5e7eb;">
          <div style="font-size:11px;color:#6b7280;">Cobros Totales</div>
          <div style="font-size:17px;font-weight:bold;">${formatCurrency(resumen.cobros)}</div>
          <div style="font-size:11px;color:${vs_mes_anterior.cobros >= 0 ? '#16a34a' : '#dc2626'};">${deltaArrow(vs_mes_anterior.cobros)} vs mes ant.</div>
        </td>
        <td style="text-align:center;">
          <div style="font-size:11px;color:#6b7280;">Resultado Neto</div>
          <div style="font-size:17px;font-weight:bold;">${formatCurrency(resumen.resultadoNeto)}</div>
          <div style="font-size:11px;color:#6b7280;">Margen: ${resumen.margenNeto}%</div>
        </td>
      </tr>
    </table>

    <!-- KPIs -->
    <h3 style="font-size:14px;margin:0 0 12px;color:#374151;">KPIs del Mes</h3>
    <table width="100%" cellpadding="8" cellspacing="4" style="margin-bottom:20px;">
      <tr>
        <td style="background:#f0fdf4;border-radius:6px;text-align:center;">
          <div style="font-size:11px;color:#6b7280;">Ticket Promedio</div>
          <div style="font-size:15px;font-weight:bold;">${formatCurrency(kpis.ticketPromedio)}</div>
        </td>
        <td width="8"></td>
        <td style="background:#eff6ff;border-radius:6px;text-align:center;">
          <div style="font-size:11px;color:#6b7280;">Tasa Cobranza</div>
          <div style="font-size:15px;font-weight:bold;">${kpis.tasaCobranza}%</div>
        </td>
        <td width="8"></td>
        <td style="background:#fefce8;border-radius:6px;text-align:center;">
          <div style="font-size:11px;color:#6b7280;">Margen Bruto</div>
          <div style="font-size:15px;font-weight:bold;">${kpis.margenBruto}%</div>
        </td>
        <td width="8"></td>
        <td style="background:#fdf4ff;border-radius:6px;text-align:center;">
          <div style="font-size:11px;color:#6b7280;">Crecimiento</div>
          <div style="font-size:15px;font-weight:bold;color:${kpis.crecimientoMensual >= 0 ? '#16a34a' : '#dc2626'};">${kpis.crecimientoMensual >= 0 ? "+" : ""}${kpis.crecimientoMensual}%</div>
        </td>
      </tr>
    </table>

    ${topClientes.length > 0 ? `
    <h3 style="font-size:14px;margin:0 0 10px;color:#374151;">Top Clientes del Mes</h3>
    <table width="100%" cellpadding="7" cellspacing="0" style="border-collapse:collapse;">
      ${topClientes.slice(0, 5).map((c: any, i: number) => `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="font-size:13px;">${i + 1}. ${c.nombre}</td>
          <td style="text-align:right;font-size:13px;font-weight:bold;">${formatCurrency(c.monto)}</td>
        </tr>
      `).join("")}
    </table>` : ""}
  </div>

  <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:12px;">Generado automáticamente por AviGest</p>
</body>
</html>`
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { tipo, datos } = await req.json()

    const apiKey = process.env.RESEND_API_KEY
    const toEmail = process.env.RESEND_TO
    const fromEmail = process.env.RESEND_FROM ?? "AviGest <onboarding@resend.dev>"

    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY no configurada. Agregá la variable de entorno en tu proyecto." },
        { status: 500 }
      )
    }
    if (!toEmail) {
      return NextResponse.json(
        { error: "RESEND_TO no configurada. Agregá tu casilla de email destino como variable de entorno." },
        { status: 500 }
      )
    }

    const resend = new Resend(apiKey)

    const subjectMap: Record<string, string> = {
      diario: `Reporte Diario — ${datos.fecha ?? new Date().toLocaleDateString("es-AR")}`,
      semanal: `Reporte Semanal — ${datos.semana ?? ""}`,
      mensual: `Reporte Mensual — ${datos.mes ?? ""}`,
    }

    const htmlMap: Record<string, string> = {
      diario: buildEmailDiario(datos),
      semanal: buildEmailSemanal(datos),
      mensual: buildEmailMensual(datos),
    }

    if (!htmlMap[tipo]) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 })
    }

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: subjectMap[tipo],
      html: htmlMap[tipo],
    })

    if (error) {
      console.error("[send-email] Resend error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data?.id })
  } catch (error) {
    console.error("[send-email]", error)
    return NextResponse.json({ error: "Error al enviar el email" }, { status: 500 })
  }
}
