import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
}

// GET /api/admin/permisos — devuelve todos los registros de user_permissions
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const admin = getAdminClient()
    const { data, error } = await admin
      .from("user_permissions")
      .select("user_id, email, display_name, allowed_sections, updated_at")

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    console.error("[admin/permisos GET]", err)
    return NextResponse.json({ error: err?.message ?? "Error" }, { status: 500 })
  }
}

// POST /api/admin/permisos — upsert permisos para un usuario
// Body: { user_id, email, display_name?, allowed_sections: string[] | null }
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const body = await req.json()
    const { user_id, email, display_name, allowed_sections } = body

    if (!user_id || !email) {
      return NextResponse.json({ error: "user_id y email son requeridos" }, { status: 400 })
    }

    const admin = getAdminClient()
    const { error } = await admin.from("user_permissions").upsert(
      {
        user_id,
        email,
        display_name: display_name ?? null,
        allowed_sections: allowed_sections ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[admin/permisos POST]", err)
    return NextResponse.json({ error: err?.message ?? "Error" }, { status: 500 })
  }
}

// DELETE /api/admin/permisos?user_id=xxx — elimina restricciones (acceso total)
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    const userId = req.nextUrl.searchParams.get("user_id")
    if (!userId) return NextResponse.json({ error: "user_id requerido" }, { status: 400 })

    const admin = getAdminClient()
    const { error } = await admin.from("user_permissions").delete().eq("user_id", userId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[admin/permisos DELETE]", err)
    return NextResponse.json({ error: err?.message ?? "Error" }, { status: 500 })
  }
}
