/**
 * Presence API — tracks when each user was last active.
 *
 * Requires a `last_seen_at` column on `user_permissions`:
 *   ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
 *
 * POST /api/admin/presence — authenticated user updates their own last_seen_at
 * GET  /api/admin/presence — owner-only: returns all users with last_seen_at + last_sign_in_at
 */

import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// POST — update own presence (called every ~2 min from the client)
export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const now = new Date().toISOString()

    // Upsert into user_permissions to set last_seen_at
    // If the column doesn't exist yet this will silently fail — that's intentional
    const { error } = await supabase.from("user_permissions").upsert(
      {
        user_id: user.id,
        email: user.email ?? "",
        last_seen_at: now,
        // Keep these non-null to satisfy constraints
        updated_at: now,
      },
      { onConflict: "user_id", ignoreDuplicates: false }
    )

    if (error) {
      // Column might not exist yet — fail silently
      console.warn("[presence POST] upsert failed (column may not exist):", error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[presence POST]", err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

// GET — list all users with presence info (owner only)
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

    // Verify caller is owner
    const { data: selfPerms } = await supabase
      .from("user_permissions")
      .select("allowed_sections")
      .eq("user_id", user.id)
      .maybeSingle()

    if (selfPerms && selfPerms.allowed_sections !== null) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
    }

    const admin = getAdminClient()

    // Get all auth users (has last_sign_in_at)
    const { data: { users: authUsers }, error: authErr } = await admin.auth.admin.listUsers({ perPage: 200 })
    if (authErr) throw authErr

    // Get presence data from user_permissions
    const { data: presenceRows } = await admin
      .from("user_permissions")
      .select("user_id, email, display_name, last_seen_at")

    const presenceMap = new Map<string, { last_seen_at: string | null; display_name: string | null }>()
    for (const row of presenceRows ?? []) {
      presenceMap.set(row.user_id, {
        last_seen_at: (row as any).last_seen_at ?? null,
        display_name: row.display_name ?? null,
      })
    }

    const result = authUsers.map((u) => {
      const presence = presenceMap.get(u.id)
      return {
        id: u.id,
        email: u.email ?? "",
        display_name: presence?.display_name ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        last_seen_at: presence?.last_seen_at ?? null,
        created_at: u.created_at,
      }
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error("[presence GET]", err)
    return NextResponse.json({ error: err?.message ?? "Error" }, { status: 500 })
  }
}
