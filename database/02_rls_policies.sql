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

-- =============================================
-- POLÍTICAS RLS PARA EXPEDIENTES
-- =============================================

-- Habilitar RLS en expedientes
ALTER TABLE public.expedientes ENABLE ROW LEVEL SECURITY;

-- Política SELECT: Usuarios ven expedientes asignados o ADMIN ve todos
CREATE POLICY "expedientes_select_policy" ON public.expedientes
  FOR SELECT
  TO authenticated
  USING (
    -- El usuario debe existir en supervisores y estar activo
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE is_active = true AND is_deleted = false
    )
    AND (
      -- ADMIN puede ver todos los expedientes
      auth.email() IN (
        SELECT email FROM public.supervisores 
        WHERE permisos_sistema = 'ADMIN' 
        AND is_active = true 
        AND is_deleted = false
      )
      OR
      -- Usuario asignado al expediente puede verlo
      id IN (
        SELECT es.expediente_id 
        FROM public.expediente_supervisores es
        JOIN public.supervisores s ON es.supervisor_id = s.id
        WHERE s.email = auth.email()
        AND s.is_active = true 
        AND s.is_deleted = false
        AND es.is_deleted = false
      )
    )
    -- Para no-ADMIN, solo expedientes no eliminados
    AND (
      auth.email() IN (
        SELECT email FROM public.supervisores 
        WHERE permisos_sistema = 'ADMIN' 
        AND is_active = true 
        AND is_deleted = false
      )
      OR is_deleted = false
    )
  );

-- Política INSERT: Solo ADMIN puede crear expedientes
CREATE POLICY "expedientes_insert_policy" ON public.expedientes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE permisos_sistema = 'ADMIN' 
      AND is_active = true 
      AND is_deleted = false
    )
  );

-- Política UPDATE: Solo ADMIN puede actualizar expedientes
CREATE POLICY "expedientes_update_policy" ON public.expedientes
  FOR UPDATE
  TO authenticated
  USING (
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE permisos_sistema = 'ADMIN' 
      AND is_active = true 
      AND is_deleted = false
    )
  );

-- Política DELETE: Bloqueada (usar RPC para soft delete)
CREATE POLICY "expedientes_delete_policy" ON public.expedientes
  FOR DELETE
  TO authenticated
  USING (false);

-- =============================================
-- POLÍTICAS RLS PARA ACCIONES
-- =============================================

-- Habilitar RLS en acciones
ALTER TABLE public.acciones ENABLE ROW LEVEL SECURITY;

-- Política SELECT: Usuarios ven acciones de expedientes asignados o ADMIN ve todas
CREATE POLICY "acciones_select_policy" ON public.acciones
  FOR SELECT
  TO authenticated
  USING (
    -- El usuario debe existir en supervisores y estar activo
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE is_active = true AND is_deleted = false
    )
    AND (
      -- ADMIN puede ver todas las acciones
      auth.email() IN (
        SELECT email FROM public.supervisores 
        WHERE permisos_sistema = 'ADMIN' 
        AND is_active = true 
        AND is_deleted = false
      )
      OR
      -- Usuario asignado al expediente puede ver sus acciones
      expediente_id IN (
        SELECT es.expediente_id 
        FROM public.expediente_supervisores es
        JOIN public.supervisores s ON es.supervisor_id = s.id
        WHERE s.email = auth.email()
        AND s.is_active = true 
        AND s.is_deleted = false
        AND es.is_deleted = false
      )
    )
    -- Para no-ADMIN, solo acciones no eliminadas
    AND (
      auth.email() IN (
        SELECT email FROM public.supervisores 
        WHERE permisos_sistema = 'ADMIN' 
        AND is_active = true 
        AND is_deleted = false
      )
      OR is_deleted = false
    )
  );

-- Política INSERT: Solo ADMIN puede crear acciones
CREATE POLICY "acciones_insert_policy" ON public.acciones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE permisos_sistema = 'ADMIN' 
      AND is_active = true 
      AND is_deleted = false
    )
  );

-- Política UPDATE: Solo ADMIN puede actualizar acciones
CREATE POLICY "acciones_update_policy" ON public.acciones
  FOR UPDATE
  TO authenticated
  USING (
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE permisos_sistema = 'ADMIN' 
      AND is_active = true 
      AND is_deleted = false
    )
  );

-- Política DELETE: Bloqueada (usar RPC para soft delete)
CREATE POLICY "acciones_delete_policy" ON public.acciones
  FOR DELETE
  TO authenticated
  USING (false);

-- =============================================
-- POLÍTICAS RLS PARA EXPEDIENTE_SUPERVISORES
-- =============================================

-- Habilitar RLS en expediente_supervisores
ALTER TABLE public.expediente_supervisores ENABLE ROW LEVEL SECURITY;

-- Política SELECT: ADMIN y SUPERVISOR_LIDER ven todas; usuarios ven sus asignaciones
CREATE POLICY "expediente_supervisores_select_policy" ON public.expediente_supervisores
  FOR SELECT
  TO authenticated
  USING (
    -- El usuario debe existir en supervisores y estar activo
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE is_active = true AND is_deleted = false
    )
    AND (
      -- ADMIN puede ver todas las asignaciones
      auth.email() IN (
        SELECT email FROM public.supervisores 
        WHERE permisos_sistema = 'ADMIN' 
        AND is_active = true 
        AND is_deleted = false
      )
      OR
      -- SUPERVISOR_LIDER puede ver todas las asignaciones
      auth.email() IN (
        SELECT email FROM public.supervisores 
        WHERE rol = 'SUPERVISOR_LIDER' 
        AND is_active = true 
        AND is_deleted = false
      )
      OR
      -- Usuario puede ver sus propias asignaciones
      supervisor_id IN (
        SELECT id FROM public.supervisores 
        WHERE email = auth.email()
        AND is_active = true 
        AND is_deleted = false
      )
    )
    -- Para no-ADMIN, solo asignaciones no eliminadas
    AND (
      auth.email() IN (
        SELECT email FROM public.supervisores 
        WHERE permisos_sistema = 'ADMIN' 
        AND is_active = true 
        AND is_deleted = false
      )
      OR is_deleted = false
    )
  );

-- Política INSERT: Solo ADMIN puede crear asignaciones
CREATE POLICY "expediente_supervisores_insert_policy" ON public.expediente_supervisores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE permisos_sistema = 'ADMIN' 
      AND is_active = true 
      AND is_deleted = false
    )
  );

-- Política UPDATE: Solo ADMIN puede actualizar asignaciones
CREATE POLICY "expediente_supervisores_update_policy" ON public.expediente_supervisores
  FOR UPDATE
  TO authenticated
  USING (
    auth.email() IN (
      SELECT email FROM public.supervisores 
      WHERE permisos_sistema = 'ADMIN' 
      AND is_active = true 
      AND is_deleted = false
    )
  );

-- Política DELETE: Bloqueada (usar RPC para soft delete)
CREATE POLICY "expediente_supervisores_delete_policy" ON public.expediente_supervisores
  FOR DELETE
  TO authenticated
  USING (false);
