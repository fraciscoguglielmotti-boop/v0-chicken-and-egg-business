import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"

export interface UseSupabaseOptions {
  /** Max rows to fetch. Defaults to 500. */
  limit?: number
  /** Column to order by. Defaults to "created_at". */
  orderBy?: string
  /** Ascending order. Defaults to false (newest first). */
  ascending?: boolean
  /** Extra equality filters, e.g. { activo: true }. */
  filters?: Record<string, any>
}

const DEFAULT_LIMIT = 500

// Stable serialization: sort keys so {b:1,a:2} and {a:2,b:1} produce same key
function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return JSON.stringify(obj)
  const sorted = Object.keys(obj as object).sort().reduce<Record<string, unknown>>((acc, k) => {
    acc[k] = (obj as Record<string, unknown>)[k]
    return acc
  }, {})
  return JSON.stringify(sorted)
}

// Generic fetcher for SWR
async function fetcher<T>(table: string, opts: UseSupabaseOptions = {}): Promise<T[]> {
  const supabase = createClient()
  const orderCol = opts.orderBy ?? "created_at"
  const ascending = opts.ascending ?? false
  let query = supabase.from(table).select("*").order(orderCol, { ascending })
  if (opts.filters) {
    for (const [k, v] of Object.entries(opts.filters)) {
      query = query.eq(k, v)
    }
  }
  query = query.limit(opts.limit ?? DEFAULT_LIMIT)
  const { data, error } = await query
  if (error) throw error
  return (data as T[]) || []
}

// Hook to fetch data from a Supabase table
export function useSupabase<T = any>(table: string, opts: UseSupabaseOptions = {}) {
  const key = `supabase:${table}:${stableStringify(opts)}`
  const { data, error, isLoading, mutate } = useSWR<T[]>(key, () => fetcher<T>(table, opts))

  return {
    data: data || [],
    error,
    isLoading,
    mutate,
  }
}

// Insert a new row
export async function insertRow(table: string, data: Record<string, any>) {
  const supabase = createClient()
  const { data: inserted, error } = await supabase.from(table).insert([data]).select().single()
  if (error) throw error
  return inserted
}

// Update a row by ID
export async function updateRow(table: string, id: string, data: Record<string, any>) {
  const supabase = createClient()
  const { data: updated, error } = await supabase.from(table).update(data).eq("id", id).select().single()
  if (error) throw error
  return updated
}

// Delete a row by ID
export async function deleteRow(table: string, id: string) {
  const supabase = createClient()
  const { error } = await supabase.from(table).delete().eq("id", id)
  if (error) throw error
}

// Get a single row by ID
export async function getRow<T = any>(table: string, id: string): Promise<T | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from(table).select("*").eq("id", id).single()
  if (error) {
    if (error.code === "PGRST116") return null // Not found
    throw error
  }
  return data as T
}

// Query with filters
export async function queryRows<T = any>(
  table: string,
  filters?: Record<string, any>,
  orderBy?: { column: string; ascending?: boolean }
): Promise<T[]> {
  const supabase = createClient()
  let query = supabase.from(table).select("*")

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value)
    })
  }

  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
  }

  const { data, error } = await query
  if (error) throw error
  return (data as T[]) || []
}
