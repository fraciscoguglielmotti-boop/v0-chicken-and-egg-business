"use client"

export function PlaceholderContent({ title }: { title: string }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
      <div className="text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta sección está siendo migrada a Supabase.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Consulta SUPABASE_MIGRATION_GUIDE.md para más detalles.
        </p>
      </div>
    </div>
  )
}
