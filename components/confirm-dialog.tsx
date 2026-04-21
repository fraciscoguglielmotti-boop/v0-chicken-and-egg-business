"use client"

import { useCallback, useRef, useState } from "react"
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

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
}

/**
 * Hook para reemplazar `window.confirm(...)` por un dialog estilizado.
 *
 * Uso:
 *
 *   const { confirm, ConfirmDialog } = useConfirm()
 *   ...
 *   if (await confirm({ title: "¿Eliminar?", destructive: true })) { ... }
 *   ...
 *   return <>{ ...  <ConfirmDialog /> }</>
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: "",
  })
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    setState({ ...opts, open: true })
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const close = (value: boolean) => {
    setState((s) => ({ ...s, open: false }))
    resolverRef.current?.(value)
    resolverRef.current = null
  }

  const ConfirmDialog = () => (
    <AlertDialog
      open={state.open}
      onOpenChange={(o) => {
        if (!o) close(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          {state.description && (
            <AlertDialogDescription>{state.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {state.cancelLabel || "Cancelar"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={state.destructive ? "bg-rose-600 hover:bg-rose-700" : undefined}
          >
            {state.confirmLabel || "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirm, ConfirmDialog }
}
