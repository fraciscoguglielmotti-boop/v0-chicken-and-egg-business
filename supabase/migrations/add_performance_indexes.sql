-- Índices de rendimiento para las tablas más consultadas.
-- Se aplican con `IF NOT EXISTS`, por lo que esta migración es segura de correr
-- varias veces.

-- ventas
create index if not exists idx_ventas_fecha         on ventas (fecha desc);
create index if not exists idx_ventas_cliente       on ventas (cliente_nombre);
create index if not exists idx_ventas_vendedor      on ventas (vendedor);
create index if not exists idx_ventas_created_at    on ventas (created_at desc);

-- cobros
create index if not exists idx_cobros_fecha         on cobros (fecha desc);
create index if not exists idx_cobros_cliente       on cobros (cliente_nombre);
create index if not exists idx_cobros_created_at    on cobros (created_at desc);

-- compras
create index if not exists idx_compras_fecha        on compras (fecha desc);
create index if not exists idx_compras_proveedor    on compras (proveedor_nombre);
create index if not exists idx_compras_estado       on compras (estado);
create index if not exists idx_compras_created_at   on compras (created_at desc);

-- movimientos_mp
create index if not exists idx_movimientos_mp_fecha on movimientos_mp (fecha desc);

-- minorista: pedidos por fecha + estado + cliente
create index if not exists idx_pedidos_minoristas_fecha
  on pedidos_minoristas (fecha desc);
create index if not exists idx_pedidos_minoristas_estado
  on pedidos_minoristas (estado);
create index if not exists idx_pedidos_minoristas_cliente
  on pedidos_minoristas (cliente_id);

-- minorista: items por pedido (aceleran joins)
create index if not exists idx_items_pedido_minorista_pedido
  on items_pedido_minorista (pedido_id);

-- minorista: repartos por fecha
create index if not exists idx_repartos_minoristas_fecha
  on repartos_minoristas (fecha desc);

-- minorista: rendiciones por reparto
create index if not exists idx_rendiciones_minoristas_reparto
  on rendiciones_minoristas (reparto_id);
