"use client"

import React, { useState, useMemo } from "react"
import { Pencil, Trash2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

const DEFAULT_PAGE_SIZE = 25

interface Column<T> {
  key: keyof T | string
  header: string
  render?: (item: T) => React.ReactNode
  className?: string
  mobileHidden?: boolean // ocultar en pantallas pequeñas
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (item: T) => void
  emptyMessage?: string
  onEdit?: (item: T) => void
  onDelete?: (id: string) => void
  defaultPageSize?: number
}

function sortValues(a: any, b: any, dir: 'asc' | 'desc'): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  // Date strings (ISO format)
  if (typeof a === 'string' && /^\d{4}-\d{2}-\d{2}/.test(a)) {
    const diff = new Date(a).getTime() - new Date(b).getTime()
    return dir === 'asc' ? diff : -diff
  }

  // Numbers
  const aNum = Number(a)
  const bNum = Number(b)
  if (!isNaN(aNum) && !isNaN(bNum)) {
    return dir === 'asc' ? aNum - bNum : bNum - aNum
  }

  // Strings
  const cmp = String(a).toLowerCase().localeCompare(String(b).toLowerCase(), 'es')
  return dir === 'asc' ? cmp : -cmp
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No hay datos disponibles",
  onEdit,
  onDelete,
  defaultPageSize = DEFAULT_PAGE_SIZE,
}: DataTableProps<T>) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const handleSort = (key: string) => {
    if (key === '__actions__') return
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setCurrentPage(1)
  }

  const sortedData = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) =>
      sortValues((a as any)[sortKey], (b as any)[sortKey], sortDir)
    )
  }, [data, sortKey, sortDir])

  const hasActions = onEdit || onDelete
  const effectivePageSize = pageSize === 0 ? sortedData.length : pageSize
  const totalPages = Math.ceil(sortedData.length / effectivePageSize)
  const paginated = pageSize === 0 ? sortedData : sortedData.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize)
  const showPagination = sortedData.length > DEFAULT_PAGE_SIZE

  const effectiveColumns: Column<T>[] = hasActions
    ? [
        ...columns,
        {
          key: "__actions__",
          header: "",
          className: "sticky right-0 bg-card w-[1%] whitespace-nowrap",
          render: (item: T) => (
            <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
              {onEdit && (
                <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="icon" onClick={() => setPendingDeleteId(item.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ),
        },
      ]
    : columns

  return (
    <>
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {effectiveColumns.map((column) => {
                const key = String(column.key)
                const isSortable = key !== '__actions__'
                const isActive = sortKey === key
                return (
                  <TableHead
                    key={key}
                    className={cn("font-semibold", column.className, isSortable && "cursor-pointer select-none hover:bg-muted/50", column.mobileHidden && "hidden sm:table-cell")}
                    onClick={() => isSortable && handleSort(key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {column.header}
                      {isSortable && (
                        isActive
                          ? sortDir === 'asc'
                            ? <ChevronUp className="h-3 w-3 text-primary" />
                            : <ChevronDown className="h-3 w-3 text-primary" />
                          : <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
                      )}
                    </span>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={effectiveColumns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((item) => (
                <TableRow
                  key={item.id}
                  className={cn(
                    onRowClick && "cursor-pointer hover:bg-muted/50"
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {effectiveColumns.map((column) => (
                    <TableCell
                      key={`${item.id}-${String(column.key)}`}
                      className={cn(column.className, column.mobileHidden && "hidden sm:table-cell")}
                    >
                      {column.render
                        ? column.render(item)
                        : String(item[column.key as keyof T] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>

        {showPagination && (
          <div className="flex items-center justify-between border-t px-4 py-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {pageSize === 0
                  ? `${sortedData.length} registros (todos)`
                  : `${(currentPage - 1) * effectivePageSize + 1}–${Math.min(currentPage * effectivePageSize, sortedData.length)} de ${sortedData.length}`}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">· Mostrar:</span>
              {[25, 50, 100, 0].map(s => (
                <button
                  key={s}
                  className={cn("text-xs px-2 py-0.5 rounded border transition-colors", pageSize === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}
                  onClick={() => { setPageSize(s); setCurrentPage(1) }}
                >{s === 0 ? "Todos" : s}</button>
              ))}
            </div>
            {pageSize !== 0 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">{currentPage} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId && onDelete) {
                  onDelete(pendingDeleteId)
                }
                setPendingDeleteId(null)
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
