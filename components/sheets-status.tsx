"use client"

import { Cloud, CloudOff, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SheetsStatusProps {
  isLoading: boolean
  error: string | null
  isConnected: boolean
}

export function SheetsStatus({ isLoading, error, isConnected }: SheetsStatusProps) {
  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Sincronizando...
      </Badge>
    )
  }

  if (error || !isConnected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive">
              <CloudOff className="h-3 w-3" />
              Offline
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs text-sm">
              {error || "Sin conexion a Google Sheets. Usando datos locales."}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
            <Cloud className="h-3 w-3" />
            Sheets
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">Sincronizado con Google Sheets</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
