import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

// Generic fetcher for SWR
async function fetcher<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false })
  if (error) throw error
  return (data as T[]) || []
}

// Hook to fetch data from a Supabase table
export function useSupabase<T = any>(table: string) {
  const { data, error, isLoading, mutate } = useSWR<T[]>(`supabase:${table}`, () => fetcher<T>(table))

  return {
    data: data || [],
    error,
    isLoading,
    mutate,
  }
}

// Insert a new row
export async function insertRow(table: string, data: Record<string, any>) {
  const { data: inserted, error } = await supabase.from(table).insert([data]).select().single()
  if (error) throw error
  return inserted
}

// Update a row by ID
export async function updateRow(table: string, id: string, data: Record<string, any>) {
  const { data: updated, error } = await supabase.from(table).update(data).eq("id", id).select().single()
  if (error) throw error
  return updated
}

// Delete a row by ID
export async function deleteRow(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq("id", id)
  if (error) throw error
}

// Get a single row by ID
export async function getRow<T = any>(table: string, id: string): Promise<T | null> {
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
