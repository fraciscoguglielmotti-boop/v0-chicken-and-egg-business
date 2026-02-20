-- ============================================
-- Enable RLS on all tables
-- Policy: all authenticated users can CRUD all rows
-- (single-tenant business app - no multi-tenancy)
-- ============================================

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'clientes','proveedores','vendedores','ventas','cobros',
      'compras','pagos','gastos','vehiculos','mantenimientos',
      'presupuestos','configuracion'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy if not exists "Authenticated full access" on public.%I
       for all using (auth.uid() is not null)
       with check (auth.uid() is not null)', t);
  end loop;
end
$$;
