create table if not exists pedidos_dia (
  id              uuid        primary key default gen_random_uuid(),
  cliente         text        not null,
  producto        text        not null,
  cantidad        numeric     not null,
  precio_unitario numeric     not null default 0,
  observaciones   text,
  created_at      timestamptz default now()
);

alter table pedidos_dia enable row level security;
create policy "Allow all" on pedidos_dia for all using (true) with check (true);
