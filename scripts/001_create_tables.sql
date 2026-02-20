-- ============================================
-- AviGest: Full database schema for Supabase
-- ============================================

-- Clientes
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cuit text default '',
  telefono text default '',
  direccion text default '',
  saldo_inicial numeric default 0,
  created_at timestamptz default now()
);

-- Proveedores
create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cuit text default '',
  telefono text default '',
  direccion text default '',
  created_at timestamptz default now()
);

-- Vendedores
create table if not exists public.vendedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  comision numeric default 5,
  created_at timestamptz default now()
);

-- Ventas
create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_nombre text default '',
  productos text default '',
  cantidad numeric default 0,
  precio_unitario numeric default 0,
  total numeric default 0,
  vendedor_id uuid references public.vendedores(id) on delete set null,
  vendedor_nombre text default '',
  created_at timestamptz default now()
);

-- Cobros
create table if not exists public.cobros (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_nombre text default '',
  monto numeric default 0,
  metodo_pago text default 'Efectivo',
  observaciones text default '',
  verificado_agroaves boolean default false,
  created_at timestamptz default now()
);

-- Compras
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  proveedor_nombre text default '',
  producto text default '',
  cantidad numeric default 0,
  precio_unitario numeric default 0,
  total numeric default 0,
  estado text default 'pendiente',
  created_at timestamptz default now()
);

-- Pagos
create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  proveedor_nombre text default '',
  monto numeric default 0,
  metodo_pago text default 'Efectivo',
  observaciones text default '',
  created_at timestamptz default now()
);

-- Gastos
create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  tipo text default 'Egreso',
  categoria text default '',
  descripcion text default '',
  monto numeric default 0,
  medio_pago text default 'Efectivo',
  tarjeta text default '',
  banco text default '',
  cuota_actual int default 1,
  cuotas_total int default 1,
  origen_pdf boolean default false,
  created_at timestamptz default now()
);

-- Vehiculos
create table if not exists public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  patente text unique not null,
  marca text default '',
  modelo text default '',
  anio text default '',
  kilometraje numeric default 0,
  created_at timestamptz default now()
);

-- Mantenimientos
create table if not exists public.mantenimientos (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid references public.vehiculos(id) on delete cascade,
  fecha date not null default current_date,
  tipo text default '',
  descripcion text default '',
  kilometraje numeric default 0,
  costo numeric default 0,
  taller text default '',
  proximo_km numeric,
  proxima_fecha date,
  created_at timestamptz default now()
);

-- Presupuestos
create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  monto numeric default 0,
  mes int not null,
  anio int not null,
  created_at timestamptz default now()
);

-- Configuracion (key-value store)
create table if not exists public.configuracion (
  id uuid primary key default gen_random_uuid(),
  clave text unique not null,
  valor text default ''
);

-- Insert default config
insert into public.configuracion (clave, valor)
values ('login_activo', 'TRUE')
on conflict (clave) do nothing;
