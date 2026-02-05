"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Users,
  Truck,
  BarChart3,
  Settings,
  FileSpreadsheet,
  X,
  Egg,
  Calculator,
  UserCheck,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const navSections = [
  {
    label: "Principal",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Ventas", href: "/ventas", icon: ShoppingCart },
      { name: "Cobros", href: "/cobros", icon: Receipt },
      { name: "Compras", href: "/compras", icon: Package },
    ],
  },
  {
    label: "Gestion",
    items: [
      { name: "Clientes", href: "/clientes", icon: Users },
      { name: "Proveedores", href: "/proveedores", icon: Truck },
      { name: "Cuentas Corrientes", href: "/cuentas", icon: BarChart3 },
      { name: "Vendedores", href: "/vendedores", icon: UserCheck },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { name: "Contabilidad", href: "/contabilidad", icon: Calculator },
      { name: "Flujo de Fondos", href: "/flujo", icon: Wallet },
    ],
  },
  {
    label: "Sistema",
    items: [
      { name: "Google Sheets", href: "/sheets", icon: FileSpreadsheet },
      { name: "Configuracion", href: "/config", icon: Settings },
    ],
  },
]

interface AppSidebarProps {
  open: boolean
  onClose: () => void
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose()
          }}
          role="button"
          tabIndex={0}
          aria-label="Cerrar menu"
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-border bg-card transition-transform duration-200 ease-in-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
          <Link href="/" className="flex items-center gap-3" onClick={onClose}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Egg className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">AviGest</h1>
              <p className="text-[11px] text-muted-foreground leading-none">Distribuidora</p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar menu</span>
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {section.label}
              </p>
              <ul className="space-y-0.5" role="list">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-border p-3">
          <div className="rounded-lg bg-muted px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Sincronizado con</p>
            <p className="text-sm font-medium text-foreground">Google Sheets</p>
          </div>
        </div>
      </aside>
    </>
  )
}
