import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function verifyOwner() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  // Check that caller has no restrictions (= owner)
  const { data: perms } = await supabase
    .from("user_permissions")
    .select("allowed_sections")
    .eq("user_id", user.id)
    .maybeSingle()

  // null row or null allowed_sections = owner
  if (perms && perms.allowed_sections !== null) {
    throw new Error("Sin permisos de administrador")
  }
  return user
}

// POST /api/admin/cuentas — create a new user
// Body: { email, password, display_name? }
export async function POST(req: NextRequest) {
  try {
    await verifyOwner()
    const { email, password, display_name } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 })
    }

    const admin = getAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: display_name ?? null },
    })
    if (error) throw error

    // Create a permissions row with full access (null = unrestricted)
    await admin.from("user_permissions").upsert({
      user_id: data.user.id,
      email,
      display_name: display_name ?? null,
      allowed_sections: [],
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

    return NextResponse.json({ ok: true, user: { id: data.user.id, email } })
  } catch (err: any) {
    console.error("[admin/cuentas POST]", err)
    return NextResponse.json({ error: err?.message ?? "Error al crear usuario" }, { status: 500 })
  }
}

// PATCH /api/admin/cuentas — change a user's password
// Body: { user_id, password }
export async function PATCH(req: NextRequest) {
  try {
    await verifyOwner()
    const { user_id, password } = await req.json()

    if (!user_id || !password) {
      return NextResponse.json({ error: "user_id y contraseña son requeridos" }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 })
    }

    const admin = getAdminClient()
    const { error } = await admin.auth.admin.updateUserById(user_id, { password })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[admin/cuentas PATCH]", err)
    return NextResponse.json({ error: err?.message ?? "Error al cambiar contraseña" }, { status: 500 })
  }
}

// DELETE /api/admin/cuentas?user_id=xxx — delete a user
export async function DELETE(req: NextRequest) {
  try {
    await verifyOwner()
    const userId = req.nextUrl.searchParams.get("user_id")
    if (!userId) return NextResponse.json({ error: "user_id requerido" }, { status: 400 })

    const admin = getAdminClient()
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) throw error

    // Clean up permissions row
    await admin.from("user_permissions").delete().eq("user_id", userId)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[admin/cuentas DELETE]", err)
    return NextResponse.json({ error: err?.message ?? "Error al eliminar usuario" }, { status: 500 })
  }
}
