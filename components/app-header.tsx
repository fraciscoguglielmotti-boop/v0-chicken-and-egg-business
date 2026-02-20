"use client"

import { Menu, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "./auth-guard"

interface AppHeaderProps {
  title: string
  subtitle?: string
  onMenuClick: () => void
}

export function AppHeader({ title, subtitle, onMenuClick }: AppHeaderProps) {
  const { user, logout } = useAuth()

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
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold text-foreground leading-tight">{title}</h1>
        {subtitle && (
          <p className="truncate text-sm text-muted-foreground leading-none">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <div className="hidden items-center gap-2 sm:flex">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{user.email}</span>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Salir</span>
        </Button>
      </div>
    </header>
  )
}
