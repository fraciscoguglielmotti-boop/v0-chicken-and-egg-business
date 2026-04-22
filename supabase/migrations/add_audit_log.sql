-- Audit log: registro de cambios en tablas críticas
create table if not exists audit_log (
  id          uuid        primary key default gen_random_uuid(),
  tabla       text        not null,
  operacion   text        not null,  -- INSERT | UPDATE | DELETE
  registro_id text,                  -- id del registro afectado
  datos_antes jsonb,
  datos_nuevo jsonb,
  usuario     text,                  -- email/id del usuario (si hay auth)
  created_at  timestamptz default now()
);

alter table audit_log enable row level security;
drop policy if exists "Allow all" on audit_log;
create policy "Allow all" on audit_log for all using (true) with check (true);

-- Índices para queries frecuentes
create index if not exists idx_audit_log_tabla    on audit_log (tabla);
create index if not exists idx_audit_log_fecha    on audit_log (created_at desc);
create index if not exists idx_audit_log_registro on audit_log (registro_id);
