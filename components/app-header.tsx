"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AppHeaderProps {
  title: string
  subtitle?: string
  onMenuClick: () => void
}

export function AppHeader({ title, subtitle, onMenuClick }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Abrir menu</span>
      </Button>
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold text-foreground leading-tight">{title}</h1>
        {subtitle && (
          <p className="truncate text-sm text-muted-foreground leading-none">{subtitle}</p>
        )}
      </div>
    </header>
  )
}
