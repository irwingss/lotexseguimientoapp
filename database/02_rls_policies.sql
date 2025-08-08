-- =============================================
-- FASE 4: Admin Supervisores - RLS Policies
-- =============================================
-- Solo usuarios ADMIN pueden gestionar supervisores

-- Habilitar RLS en la tabla supervisores
ALTER TABLE public.supervisores ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLÍTICAS RLS PARA SUPERVISORES
-- =============================================

-- Política para SELECT: Solo usuarios autenticados pueden ver supervisores activos
CREATE POLICY "supervisores_select_policy" ON public.supervisores
  FOR SELECT
  TO authenticated
  USING (
    -- El usuario debe existir en la tabla supervisores y estar activo
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE is_active = true AND is_deleted = false
    )
    -- Y solo puede ver supervisores no eliminados
    AND is_deleted = false
  );

-- Política para INSERT: Solo ADMIN puede crear supervisores
CREATE POLICY "supervisores_insert_policy" ON public.supervisores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Solo usuarios con permisos ADMIN pueden insertar
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE permisos_sistema = 'ADMIN' 
      AND is_active = true 
      AND is_deleted = false
    )
  );

-- Política para UPDATE: Solo ADMIN puede actualizar supervisores
CREATE POLICY "supervisores_update_policy" ON public.supervisores
  FOR UPDATE
  TO authenticated
  USING (
    -- Solo usuarios con permisos ADMIN pueden actualizar
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE permisos_sistema = 'ADMIN' 
      AND is_active = true 
      AND is_deleted = false
    )
    -- Y solo pueden actualizar registros no eliminados
    AND is_deleted = false
  )
  WITH CHECK (
    -- Verificar que el usuario sigue siendo ADMIN después de la actualización
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE permisos_sistema = 'ADMIN' 
      AND is_active = true 
      AND is_deleted = false
    )
  );

-- Política para DELETE: Solo ADMIN puede hacer soft delete
CREATE POLICY "supervisores_delete_policy" ON public.supervisores
  FOR UPDATE
  TO authenticated
  USING (
    -- Solo usuarios con permisos ADMIN pueden hacer soft delete
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE permisos_sistema = 'ADMIN' 
      AND is_active = true 
      AND is_deleted = false
    )
    -- Y solo pueden eliminar registros no eliminados previamente
    AND is_deleted = false
  );

-- =============================================
-- FUNCIÓN AUXILIAR PARA VERIFICAR PERMISOS ADMIN
-- =============================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND permisos_sistema = 'ADMIN'
    AND is_active = true 
    AND is_deleted = false
  );
END;
$$;

-- =============================================
-- FUNCIÓN PARA OBTENER ID DEL SUPERVISOR ACTUAL
-- =============================================

CREATE OR REPLACE FUNCTION public.get_current_supervisor_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supervisor_id UUID;
BEGIN
  SELECT id INTO supervisor_id
  FROM public.supervisores 
  WHERE email = auth.email()
  AND is_active = true 
  AND is_deleted = false;
  
  RETURN supervisor_id;
END;
$$;

-- =============================================
-- TRIGGER PARA ACTUALIZAR updated_at EN EXPEDIENTES
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Aplicar trigger a expedientes (para futuras fases)
CREATE TRIGGER update_expedientes_updated_at
  BEFORE UPDATE ON public.expedientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
