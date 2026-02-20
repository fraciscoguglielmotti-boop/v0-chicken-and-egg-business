# Guía de Migración a Supabase

## Estado Actual

✅ **Completado:**
- Base de datos Supabase con 12 tablas creadas
- RLS policies aplicadas
- Supabase auth configurado (email/password)
- Hook `use-supabase` creado
- Ejemplo de componente migrado: `clientes-content-supabase.tsx`

🔄 **Pendiente:**
- Migrar todos los *-content.tsx componentes
- Ejecutar script de migración de datos
- Eliminar código legacy de Google Sheets

## Patrón de Migración

### 1. Imports
**ANTES (Google Sheets):**
```tsx
import { useSheet, addRow, updateRowData, deleteRow } from "@/hooks/use-sheets"
```

**DESPUÉS (Supabase):**
```tsx
import { useSupabase, insertRow, updateRow, deleteRow } from "@/hooks/use-supabase"
```

### 2. Tipos de Datos
**ANTES:**
```tsx
interface Cliente {
  id: string
  nombre: string
  cuit?: string
  saldoActual: number  // camelCase
  createdAt: Date
}
```

**DESPUÉS:**
```tsx
interface Cliente {
  id: string  // UUID de Supabase
  nombre: string
  cuit: string | null  // nullable
  saldo_inicial: number  // snake_case
  created_at: string  // ISO timestamp
}
```

### 3. Fetching Data
**ANTES:**
```tsx
const { rows, isLoading, error, mutate } = useSheet("Clientes")
const clientes = rows.map((row, i) => sheetRowToCliente(row, i))
```

**DESPUÉS:**
```tsx
const { data: clientes, isLoading, error, mutate } = useSupabase<Cliente>("clientes")
// clientes ya es un array de objetos tipados - no necesita mapeo
```

### 4. Insertar Datos
**ANTES:**
```tsx
const rowData = [id, nombre, cuit, telefono, direccion, saldo, fecha]
await addRow("Clientes", [rowData])
```

**DESPUÉS:**
```tsx
await insertRow("clientes", {
  nombre: nombre.trim(),
  cuit: cuit.trim() || null,
  telefono: telefono || null,
  direccion: direccion || null,
  saldo_inicial: parseFloat(saldo) || 0,
})
```

### 5. Actualizar Datos
**ANTES:**
```tsx
await updateRowData("Clientes", rowIndex, {
  "Nombre": nombre,
  "CUIT": cuit,
})
```

**DESPUÉS:**
```tsx
await updateRow("clientes", clienteId, {
  nombre: nombre.trim(),
  cuit: cuit.trim() || null,
})
```

### 6. Eliminar Datos
**ANTES:**
```tsx
await deleteRow("Clientes", rowIndex)
```

**DESPUÉS:**
```tsx
await deleteRow("clientes", clienteId)
```

## Nombres de Tablas (snake_case)

| Google Sheets | Supabase      |
|---------------|---------------|
| Clientes      | clientes      |
| Proveedores   | proveedores   |
| Vendedores    | vendedores    |
| Ventas        | ventas        |
| Cobros        | cobros        |
| Pagos         | pagos         |
| Compras       | compras       |
| Gastos        | gastos        |
| Vehiculos     | vehiculos     |
| Mantenimientos| mantenimientos|
| Presupuestos  | presupuestos  |
| Configuracion | configuracion |

## Mapeo de Columnas

### Clientes
- `ID` → `id` (UUID)
- `Nombre` → `nombre`
- `CUIT` → `cuit`
- `Telefono` → `telefono`
- `Direccion` → `direccion`
- `Saldo` / `SaldoInicial` → `saldo_inicial`
- `FechaAlta` → `fecha_alta` (date)
- - → `created_at` (timestamptz)

### Ventas
- `ID` → `id` (UUID)
- `Fecha` → `fecha` (date)
- `Cliente` → `cliente_nombre`
- `ClienteID` → `cliente_id` (UUID foreign key)
- `Productos` → `productos` (JSONB)
- `Cantidad` → `cantidad`
- `PrecioUnitario` → `precio_unitario`
- `Vendedor` → `vendedor`

### Cobros
- `ID` → `id` (UUID)
- `Fecha` → `fecha` (date)
- `Cliente` → `cliente_nombre`
- `ClienteID` → `cliente_id` (UUID foreign key)
- `Monto` → `monto`
- `MetodoPago` → `metodo_pago`
- `Observaciones` → `observaciones`
- `VerificadoAgroaves` → `verificado_agroaves` (boolean)

## Pasos para Migrar un Componente

1. **Backup:** Guarda una copia del archivo original
2. **Tipos:** Define las interfaces TypeScript con snake_case
3. **Imports:** Cambia a `use-supabase`
4. **Hook:** Reemplaza `useSheet` por `useSupabase<Tipo>`
5. **Mapeo:** Elimina funciones `sheetRowTo...()` ya que Supabase devuelve objetos tipados
6. **CRUD:** Actualiza `insertRow`, `updateRow`, `deleteRow` para usar objetos y UUIDs
7. **Fechas:** Usa `Date` objects o ISO strings - Supabase maneja fechas correctamente
8. **Testing:** Prueba crear, editar, eliminar registros

## Migración de Datos

Una vez migrados los componentes, ejecutar:

```bash
# Asegúrate de tener las env vars correctas:
# - NEXT_PUBLIC_SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - GOOGLE_SPREADSHEET_ID
# - GOOGLE_CREDENTIALS

node --loader tsx scripts/migrate-data-from-sheets.ts
```

⚠️ **IMPORTANTE:** Ejecutar UNA SOLA VEZ después de crear las tablas en Supabase.

## Cleanup Final

Después de migrar todos los componentes y datos:

1. Eliminar `/hooks/use-sheets.ts`
2. Eliminar `/app/api/sheets/route.ts`
3. Eliminar scripts SQL viejos si los hay
4. Remover `GOOGLE_SPREADSHEET_ID` y `GOOGLE_CREDENTIALS` de env vars
5. Desinstalar `googleapis` del package.json

## Troubleshooting

**Error: "relation does not exist"**
→ Verifica que las tablas estén creadas en Supabase

**Error: "new row violates row-level security policy"**
→ Verifica que estés autenticado y las RLS policies estén configuradas

**Error: "null value in column violates not-null constraint"**
→ Asegúrate de enviar `null` (no `undefined` o `""`) para campos opcionales

**Fechas inválidas**
→ Usa formato ISO: `"2026-02-20"` o `new Date().toISOString()`
