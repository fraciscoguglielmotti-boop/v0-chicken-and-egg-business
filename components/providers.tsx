"use client"

import { useEffect } from "react"
import { SWRConfig } from "swr"
import { useToast } from "@/hooks/use-toast"
import { OfflineIndicator } from "@/components/offline-indicator"

function GlobalErrorListener() {
  const { toast } = useToast()

  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message ?? "Error inesperado en la aplicación"
      toast({ title: "Error", description: msg, variant: "destructive" })
    }
    window.addEventListener("unhandledrejection", handler)
    return () => window.removeEventListener("unhandledrejection", handler)
  }, [toast])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()

  return (
    <SWRConfig
      value={{
        onError: (error) => {
          const msg = error?.message ?? "Error al cargar los datos"
          toast({ title: "Error de conexión", description: msg, variant: "destructive" })
        },
      }}
    >
      <GlobalErrorListener />
      <OfflineIndicator />
      {children}
    </SWRConfig>
  )
}
