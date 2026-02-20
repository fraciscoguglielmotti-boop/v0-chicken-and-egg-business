# AviGest - Sistema de Gestión Avícola

Sistema de gestión empresarial construido con Next.js 15, Supabase y Tailwind CSS.

## Tecnologías

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Base de datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Estilos**: Tailwind CSS + shadcn/ui
- **Caché**: SWR

## Configuración Inicial

### 1. Crear Usuario Administrador

La forma más fácil es desde el dashboard de Supabase:

1. Ve a tu proyecto de Supabase: https://supabase.com/dashboard
2. Navega a **Authentication** > **Users**
3. Click en **Add user** > **Create new user**
4. Ingresa un email y contraseña
5. El usuario se crea automáticamente y puede hacer login de inmediato

### 2. Login

Una vez creado el usuario, ve a `/auth/login` e ingresa tus credenciales.

## Estructura de la Base de Datos

La base de datos ya está creada con las siguientes tablas:

- `clientes` - Gestión de clientes con saldo inicial
- `proveedores` - Gestión de proveedores
- `vendedores` - Gestión de vendedores con comisiones
- `ventas` - Registro de ventas (productos en JSONB)
- `cobros` - Registro de cobros de clientes
- `compras` - Registro de compras a proveedores
- `pagos` - Registro de pagos a proveedores
- `gastos` - Registro de gastos con categorías y cuotas
- `vehiculos` - Gestión de vehículos de la empresa
- `mantenimientos` - Historial de mantenimientos de vehículos
- `presupuestos` - Presupuestos mensuales por categoría
- `configuracion` - Configuración del sistema

Todas las tablas tienen Row Level Security (RLS) habilitado y políticas que permiten acceso completo a usuarios autenticados.

## Estado de Migración

✅ **Completado:**
- Base de datos Supabase configurada
- Autenticación funcionando
- Dashboard migrado a Supabase

⏳ **Pendiente:**
- Migración de componentes individuales (Ventas, Cobros, Clientes, etc.)
- Cada sección muestra un placeholder hasta que sea migrada

## Guía de Migración

Para migrar cada componente a Supabase, consulta `SUPABASE_MIGRATION_GUIDE.md` que incluye:
- Patrón de migración completo
- Ejemplo de componente migrado
- Mapeo de tipos de datos
- Uso del hook `use-supabase`

## Desarrollo Local

```bash
# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Variables de Entorno

Las variables de entorno de Supabase se configuran automáticamente desde la integración de Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (para scripts)

## Despliegue

El proyecto se despliega automáticamente en Vercel cuando se hace push a la rama principal.
