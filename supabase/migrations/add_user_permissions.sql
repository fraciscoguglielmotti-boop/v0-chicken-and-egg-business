-- user_permissions: controla qué secciones puede ver cada usuario.
-- Si no existe fila para un usuario, tiene acceso total (comportamiento del dueño).
-- allowed_sections = NULL también significa acceso total.

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  display_name  TEXT,
  allowed_sections TEXT[],   -- NULL = todas las secciones permitidas
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Cada usuario puede leer sus propios permisos (para que el sidebar los filtre)
CREATE POLICY "users_read_own_permissions"
  ON public.user_permissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Solo el service role puede insertar / actualizar / eliminar permisos
CREATE POLICY "service_role_manage_permissions"
  ON public.user_permissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
