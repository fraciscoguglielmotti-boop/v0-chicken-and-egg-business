import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"

interface UserPermissions {
  user_id: string
  email: string
  display_name: string | null
  allowed_sections: string[] | null
  updated_at: string
}

async function fetchPermissions(): Promise<UserPermissions | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("user_permissions")
    .select("user_id, email, display_name, allowed_sections, updated_at")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    console.error("[usePermissions]", error)
    return null
  }
  return data
}

export function usePermissions() {
  const { data, isLoading } = useSWR<UserPermissions | null>(
    "user_permissions_self",
    fetchPermissions,
    { revalidateOnFocus: false }
  )

  // null means no row in DB = full access (owner)
  // data.allowed_sections === null also means full access
  const allowedSections: string[] | null =
    data === undefined ? null : (data?.allowed_sections ?? null)

  const isOwner = allowedSections === null

  function canAccess(href: string): boolean {
    if (allowedSections === null) return true
    return allowedSections.includes(href)
  }

  return { allowedSections, isOwner, isLoading, canAccess }
}
