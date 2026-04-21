"use client"

import { useState, useEffect } from "react"
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
  X,
  Egg,
  Calculator,
  UserCheck,
  Wallet,
  DollarSign,
  Target,
  Car,
  TrendingUp,
  LineChart,
  ClipboardList,
  Landmark,
  FileText,
  CalendarDays,
  BookOpen,
  MessagesSquare,
  ChevronDown,
  GripVertical,
  Store,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const ALL_SECTIONS = [
  {
    id: "principal",
    label: "Principal",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Minorista", href: "/minorista", icon: Store },
      { name: "Ventas", href: "/ventas", icon: ShoppingCart },
      { name: "Resumen de Ventas", href: "/resumen-ventas", icon: CalendarDays },
      { name: "Toma de Pedidos", href: "/pedidos", icon: ClipboardList },
      { name: "Cobros", href: "/cobros", icon: Receipt },
      { name: "Compras", href: "/compras", icon: Package },
      { name: "Pagos", href: "/pagos", icon: DollarSign },
      { name: "Prep. Facturas", href: "/facturas", icon: FileText },
    ],
  },
  {
    id: "gestion",
    label: "Gestión",
    items: [
      { name: "Clientes", href: "/clientes", icon: Users },
      { name: "Proveedores", href: "/proveedores", icon: Truck },
      { name: "Cuentas Corrientes", href: "/cuentas", icon: BarChart3 },
      { name: "Ranking de Clientes", href: "/ranking", icon: TrendingUp },
      { name: "Vendedores", href: "/vendedores", icon: UserCheck },
      { name: "Inventario", href: "/stock", icon: Package },
      { name: "Vehiculos", href: "/vehiculos", icon: Car },
      { name: "Asesor (Federico)", href: "/asesor", icon: MessagesSquare },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    items: [
      { name: "Gastos", href: "/gastos", icon: Receipt },
      { name: "Caja", href: "/caja", icon: Wallet },
      { name: "MercadoPago", href: "/mercadopago", icon: Landmark },
      { name: "EERR", href: "/eerr", icon: Calculator },
      { name: "Presupuestos", href: "/presupuestos", icon: Target },
      { name: "Flujo de Fondos", href: "/flujo", icon: TrendingUp },
      { name: "KPIs Ejecutivos", href: "/kpis", icon: LineChart },
      { name: "Reportes Ejecutivos", href: "/reportes-ejecutivos", icon: BookOpen },
    ],
  },
]

const STORAGE_KEY_ORDER = "sidebar_section_order"
const STORAGE_KEY_COLLAPSED = "sidebar_collapsed_sections"

function SortableSection({
  section,
  collapsed,
  onToggle,
  pathname,
  onClose,
}: {
  section: (typeof ALL_SECTIONS)[number]
  collapsed: boolean
  onToggle: () => void
  pathname: string
  onClose: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="mb-1">
      {/* Section header */}
      <div className="flex items-center gap-1 px-1 mb-0.5 group">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors rounded"
          tabIndex={-1}
          aria-label="Arrastrar sección"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <button
          onClick={onToggle}
          className="flex flex-1 items-center justify-between px-2 py-1 rounded hover:bg-muted/50 transition-colors"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {section.label}
          </span>
          <ChevronDown
            className={cn(
              "h-3 w-3 text-muted-foreground/40 transition-transform duration-200",
              collapsed && "-rotate-90"
            )}
          />
        </button>
      </div>

      {/* Items */}
      {!collapsed && (
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
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

interface AppSidebarProps {
  open: boolean
  onClose: () => void
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const pathname = usePathname()

  const [sectionOrder, setSectionOrder] = useState<string[]>(
    ALL_SECTIONS.map((s) => s.id)
  )
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Load persisted state from localStorage
  useEffect(() => {
    const allIds = ALL_SECTIONS.map((s) => s.id)
    try {
      const savedOrder = localStorage.getItem(STORAGE_KEY_ORDER)
      if (savedOrder) {
        const parsed: unknown = JSON.parse(savedOrder)
        if (Array.isArray(parsed)) {
          // Keep known ids in saved order; append new sections not yet persisted.
          const kept = parsed.filter((id): id is string => allIds.includes(id as string))
          const missing = allIds.filter((id) => !kept.includes(id))
          setSectionOrder([...kept, ...missing])
        }
      }
    } catch {}
    try {
      const savedCollapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED)
      if (savedCollapsed) {
        const parsed: unknown = JSON.parse(savedCollapsed)
        if (Array.isArray(parsed)) {
          setCollapsedSections(
            new Set(parsed.filter((v): v is string => typeof v === "string"))
          )
        }
      }
    } catch {}
  }, [])

  const toggleCollapse = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      try {
        localStorage.setItem(STORAGE_KEY_COLLAPSED, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setSectionOrder((prev) => {
        const oldIndex = prev.indexOf(String(active.id))
        const newIndex = prev.indexOf(String(over.id))
        const next = arrayMove(prev, oldIndex, newIndex)
        try {
          localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(next))
        } catch {}
        return next
      })
    }
  }

  const orderedSections = sectionOrder
    .map((id) => ALL_SECTIONS.find((s) => s.id === id))
    .filter(Boolean) as typeof ALL_SECTIONS

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          onKeyDown={(e) => { if (e.key === "Escape") onClose() }}
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
          <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar menu</span>
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
              {orderedSections.map((section) => (
                <SortableSection
                  key={section.id}
                  section={section}
                  collapsed={collapsedSections.has(section.id)}
                  onToggle={() => toggleCollapse(section.id)}
                  pathname={pathname}
                  onClose={onClose}
                />
              ))}
            </SortableContext>
          </DndContext>
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-border p-3">
          <div className="rounded-lg bg-muted px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Base de datos</p>
            <p className="text-sm font-medium text-foreground">Supabase</p>
          </div>
        </div>
      </aside>
    </>
  )
}
