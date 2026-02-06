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
} from "lucide-react"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Ventas", href: "/ventas", icon: ShoppingCart },
  { name: "Cobros", href: "/cobros", icon: Receipt },
  { name: "Compras", href: "/compras", icon: Package },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Proveedores", href: "/proveedores", icon: Truck },
  { name: "Cuentas Corrientes", href: "/cuentas", icon: BarChart3 },
  { name: "Google Sheets", href: "/sheets", icon: FileSpreadsheet },
  { name: "Configuracion", href: "/config", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar-background text-sidebar-foreground">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">AviGest</h1>
            <p className="text-xs text-sidebar-foreground/60">Distribuidora</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-lg bg-sidebar-accent p-3">
            <p className="text-xs text-sidebar-foreground/60">Sincronizado con</p>
            <p className="text-sm font-medium">Google Sheets</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
