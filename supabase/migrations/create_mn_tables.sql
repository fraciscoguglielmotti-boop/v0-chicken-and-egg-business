-- Tablas mn_* usadas por el bot de WhatsApp (Make.com / Bot Pechugas)
-- Estas tablas usan IDs enteros (serial) para compatibilidad con Make.com

create table if not exists mn_clientes (
  id         serial      primary key,
  telefono   text        not null default '',
  nombre     text        not null,
  zona_id    integer,
  activo     boolean     default true,
  created_at timestamptz default now()
);

alter table mn_clientes enable row level security;
drop policy if exists "Allow all" on mn_clientes;
create policy "Allow all" on mn_clientes for all using (true) with check (true);

create table if not exists mn_productos (
  id          serial      primary key,
  nombre      text        not null,
  descripcion text,
  unidad      text        default 'kg',
  precio      numeric     not null default 0,
  activo      boolean     default true,
  created_at  timestamptz default now()
);

alter table mn_productos enable row level security;
drop policy if exists "Allow all" on mn_productos;
create policy "Allow all" on mn_productos for all using (true) with check (true);

create table if not exists mn_zonas (
  id          serial      primary key,
  nombre      text        not null,
  precio_envio numeric,
  activo      boolean     default true
);

alter table mn_zonas enable row level security;
drop policy if exists "Allow all" on mn_zonas;
create policy "Allow all" on mn_zonas for all using (true) with check (true);

create table if not exists mn_pedidos (
  id                serial      primary key,
  cliente_id        integer     references mn_clientes(id),
  estado            text        not null default 'pendiente',
  -- pendiente | confirmado | en_reparto | entregado | cancelado
  direccion_entrega text,
  notas_direccion   text,
  fecha_entrega     date,
  subtotal          numeric     not null default 0,
  costo_envio       numeric,
  total             numeric     not null default 0,
  metodo_pago       text,       -- efectivo | mercadopago | transferencia
  pago_status       text,       -- pendiente | pagado
  notas             text,
  canal             text,       -- whatsapp | manual
  created_at        timestamptz default now(),
  updated_at        timestamptz,
  confirmado_at     timestamptz,
  entregado_at      timestamptz
);

alter table mn_pedidos enable row level security;
drop policy if exists "Allow all" on mn_pedidos;
create policy "Allow all" on mn_pedidos for all using (true) with check (true);

create table if not exists mn_items_pedido (
  id               serial      primary key,
  pedido_id        integer     not null references mn_pedidos(id) on delete cascade,
  producto_id      integer     references mn_productos(id),
  cantidad         numeric     not null default 1,
  precio_unitario  numeric     not null default 0,
  subtotal         numeric     not null default 0,
  notas            text,       -- nombre libre si producto_id es null
  created_at       timestamptz default now()
);

alter table mn_items_pedido enable row level security;
drop policy if exists "Allow all" on mn_items_pedido;
create policy "Allow all" on mn_items_pedido for all using (true) with check (true);
