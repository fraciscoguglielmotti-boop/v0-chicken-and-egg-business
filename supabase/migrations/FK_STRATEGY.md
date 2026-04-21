# Estrategia de foreign keys

Actualmente, varias tablas mayoristas guardan **nombre** en lugar de `id`:

- `ventas.cliente_nombre`, `ventas.vendedor`
- `cobros.cliente_nombre`
- `compras.proveedor_nombre`
- `pagos.proveedor_nombre`
- `gastos.categoria`

Esto se hizo así para que la carga desde Sheets/CSV funcione sin lookups —
los nombres vienen ya como strings y no hay que resolver IDs. Consecuencias:

1. Renombrar un cliente no se propaga — los registros viejos quedan con el
   nombre anterior.
2. Clientes con nombre duplicado pueden mezclarse.
3. No hay integridad referencial: se puede insertar un nombre que no existe
   en `clientes`.

## Cuándo migrar a FK reales

La migración a `cliente_id` / `proveedor_nombre_id` **no se hizo todavía** y
no debe hacerse a la ligera. Antes de intentarlo:

- Relevar todos los registros con `ventas.cliente_nombre` que no matchean con
  ningún `clientes.nombre` (normalización: trim, tildes, mayúsculas).
- Decidir qué hacer con los que no matchean: crear cliente fantasma, asignar
  a "Consumidor final", o bloquear.
- Agregar columna `cliente_id uuid references clientes(id)` **nullable** y
  hacer un backfill idempotente.
- Recién ahí hacer que la UI escriba `cliente_id` además de `cliente_nombre`.
- Después de un ciclo de operación completo (30-60 días), se puede hacer
  `cliente_nombre` computable via vista/trigger.

## Mientras tanto

- Usar los nombres como están, con búsqueda case-insensitive.
- El módulo Minorista (`clientes_minoristas`) sí usa FK (`pedidos_minoristas.cliente_id`)
  porque se diseñó después, con alta transaccional controlada desde la UI.
- La tabla `movimientos_mp` usa `categoria` (texto libre) resuelta por
  `reglas_categorias` — ver `add_categoria_movimientos_mp.sql`.

## Script sugerido de diagnóstico (no ejecutar sin revisar)

```sql
-- clientes que están en ventas pero no en la tabla clientes
select distinct v.cliente_nombre
from ventas v
left join clientes c on lower(trim(c.nombre)) = lower(trim(v.cliente_nombre))
where c.id is null;

-- mismo para proveedores/compras
select distinct co.proveedor_nombre
from compras co
left join proveedores p on lower(trim(p.nombre)) = lower(trim(co.proveedor_nombre))
where p.id is null;
```
