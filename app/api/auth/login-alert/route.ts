import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { email, timestamp } = await req.json()

    const gmailUser = process.env.GMAIL_USER
    const gmailPass = (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "")
    const ownerEmail = process.env.EMAIL_TO ?? process.env.RESEND_TO
    const fromEmail = process.env.EMAIL_FROM ?? (gmailUser ? `AviGest <${gmailUser}>` : "")

    // Silently skip if not configured — don't break the login flow
    if (!gmailUser || !gmailPass || !ownerEmail) return NextResponse.json({ ok: false })

    const date = new Date(timestamp).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    })

    await transporter.sendMail({
      from: fromEmail,
      to: ownerEmail,
      subject: `🔐 Nuevo acceso a AviGest — ${email}`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;color:#1a1a1a;">
  <div style="background:#1e3a5f;padding:18px 20px;border-radius:8px 8px 0 0;">
    <h2 style="color:white;margin:0;font-size:16px;">🔐 Acceso a AviGest</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 12px;font-size:14px;">Un usuario inició sesión en el sistema:</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:8px 0;color:#6b7280;border-bottom:1px solid #f3f4f6;">Usuario</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #f3f4f6;">${email}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">Fecha y hora</td><td style="padding:8px 0;font-weight:600;">${date}</td></tr>
    </table>
  </div>
  <p style="font-size:10px;color:#9ca3af;text-align:center;margin-top:10px;">AviGest — Sistema de Gestión Avícola</p>
</body>
</html>`,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[login-alert]", err)
    return NextResponse.json({ ok: false })
  }
}
