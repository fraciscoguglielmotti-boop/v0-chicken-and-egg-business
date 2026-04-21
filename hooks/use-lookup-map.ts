import { useMemo } from "react"

/**
 * Construye un Map<key, T> a partir de una lista. El patrón
 * `useMemo(() => new Map(...))` se repite en cada componente minorista; esto
 * lo centraliza.
 *
 * ```ts
 * const clientesById = useLookupMap(clientes, "id")
 * const productosByNombre = useLookupMap(productos, (p) => p.nombre.toLowerCase())
 * ```
 */
export function useLookupMap<T, K = string>(
  items: readonly T[],
  keyOrGetter: keyof T | ((item: T) => K)
): Map<K, T> {
  return useMemo(() => {
    const m = new Map<K, T>()
    const getter =
      typeof keyOrGetter === "function"
        ? (keyOrGetter as (item: T) => K)
        : (item: T) => item[keyOrGetter as keyof T] as unknown as K
    for (const item of items) {
      m.set(getter(item), item)
    }
    return m
  }, [items, keyOrGetter])
}

/**
 * Construye un Map<key, T[]> para agrupar items por clave.
 *
 * ```ts
 * const itemsByPedido = useGroupMap(items, "pedido_id")
 * ```
 */
export function useGroupMap<T, K = string>(
  items: readonly T[],
  keyOrGetter: keyof T | ((item: T) => K)
): Map<K, T[]> {
  return useMemo(() => {
    const m = new Map<K, T[]>()
    const getter =
      typeof keyOrGetter === "function"
        ? (keyOrGetter as (item: T) => K)
        : (item: T) => item[keyOrGetter as keyof T] as unknown as K
    for (const item of items) {
      const k = getter(item)
      const arr = m.get(k)
      if (arr) arr.push(item)
      else m.set(k, [item])
    }
    return m
  }, [items, keyOrGetter])
}
