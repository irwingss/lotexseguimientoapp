-- =============================================
-- FASE 4: Admin Supervisores - RPC Functions
-- =============================================
-- Funciones RPC para CRUD de supervisores con soft delete

-- =============================================
-- FUNCIÓN RPC: Listar supervisores con filtros
-- =============================================

CREATE OR REPLACE FUNCTION public.get_supervisores(
  p_include_deleted BOOLEAN DEFAULT false,
  p_rol_filter supervisor_role DEFAULT NULL,
  p_active_filter BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  email CITEXT,
  rol supervisor_role,
  permisos_sistema permisos_sistema,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  is_deleted BOOLEAN,
  deleted_at TIMESTAMPTZ,
  deleted_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario tiene permisos para ver supervisores
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autorizado';
  END IF;

  RETURN QUERY
  SELECT 
    s.id,
    s.nombre,
    s.email,
    s.rol,
    s.permisos_sistema,
    s.is_active,
    s.created_at,
    s.is_deleted,
    s.deleted_at,
    s.deleted_reason
  FROM public.supervisores s
  WHERE 
    (NOT p_include_deleted AND s.is_deleted = false) OR
    (p_include_deleted)
  AND
    (p_rol_filter IS NULL OR s.rol = p_rol_filter)
  AND
    (p_active_filter IS NULL OR s.is_active = p_active_filter)
  ORDER BY s.created_at DESC;
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Crear supervisor
-- =============================================

CREATE OR REPLACE FUNCTION public.create_supervisor(
  p_nombre TEXT,
  p_email CITEXT,
  p_rol supervisor_role,
  p_permisos_sistema permisos_sistema DEFAULT 'SUPERVISOR',
  p_is_active BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_supervisor_id UUID;
BEGIN
  -- Verificar permisos ADMIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: solo ADMIN puede crear supervisores';
  END IF;

  -- Validar datos de entrada
  IF p_nombre IS NULL OR trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre es requerido';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'El email es requerido';
  END IF;

  -- Verificar que el email no existe (incluyendo eliminados)
  IF EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = p_email
  ) THEN
    RAISE EXCEPTION 'Ya existe un supervisor con este email';
  END IF;

  -- Insertar nuevo supervisor
  INSERT INTO public.supervisores (
    nombre,
    email,
    rol,
    permisos_sistema,
    is_active
  ) VALUES (
    trim(p_nombre),
    lower(trim(p_email)),
    p_rol,
    p_permisos_sistema,
    p_is_active
  ) RETURNING id INTO new_supervisor_id;

  RETURN new_supervisor_id;
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Actualizar supervisor
-- =============================================

CREATE OR REPLACE FUNCTION public.update_supervisor(
  p_supervisor_id UUID,
  p_nombre TEXT,
  p_email CITEXT,
  p_rol supervisor_role,
  p_permisos_sistema permisos_sistema,
  p_is_active BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar permisos ADMIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: solo ADMIN puede actualizar supervisores';
  END IF;

  -- Verificar que el supervisor existe y no está eliminado
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE id = p_supervisor_id AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Supervisor no encontrado o eliminado';
  END IF;

  -- Validar datos de entrada
  IF p_nombre IS NULL OR trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre es requerido';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'El email es requerido';
  END IF;

  -- Verificar que el email no existe en otro supervisor
  IF EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = p_email AND id != p_supervisor_id
  ) THEN
    RAISE EXCEPTION 'Ya existe otro supervisor con este email';
  END IF;

  -- Actualizar supervisor
  UPDATE public.supervisores SET
    nombre = trim(p_nombre),
    email = lower(trim(p_email)),
    rol = p_rol,
    permisos_sistema = p_permisos_sistema,
    is_active = p_is_active
  WHERE id = p_supervisor_id AND is_deleted = false;

  RETURN FOUND;
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Soft delete supervisor
-- =============================================

CREATE OR REPLACE FUNCTION public.delete_supervisor(
  p_supervisor_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_geom_lat DOUBLE PRECISION DEFAULT NULL,
  p_geom_lng DOUBLE PRECISION DEFAULT NULL,
  p_precision_m DOUBLE PRECISION DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_supervisor_id UUID;
  geom_point GEOMETRY(Point, 4326);
BEGIN
  -- Verificar permisos ADMIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: solo ADMIN puede eliminar supervisores';
  END IF;

  -- Obtener ID del supervisor actual
  current_supervisor_id := public.get_current_supervisor_id();
  
  IF current_supervisor_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo identificar al supervisor actual';
  END IF;

  -- Verificar que el supervisor existe y no está eliminado
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE id = p_supervisor_id AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Supervisor no encontrado o ya eliminado';
  END IF;

  -- No permitir auto-eliminación
  IF p_supervisor_id = current_supervisor_id THEN
    RAISE EXCEPTION 'No puedes eliminarte a ti mismo';
  END IF;

  -- Crear punto de geometría si se proporcionaron coordenadas
  IF p_geom_lat IS NOT NULL AND p_geom_lng IS NOT NULL THEN
    geom_point := ST_SetSRID(ST_MakePoint(p_geom_lng, p_geom_lat), 4326);
  END IF;

  -- Realizar soft delete
  UPDATE public.supervisores SET
    is_deleted = true,
    deleted_at = now(),
    deleted_by_supervisor_id = current_supervisor_id,
    deleted_reason = p_reason,
    deleted_geom_4326 = geom_point,
    deleted_precision_m = p_precision_m,
    is_active = false  -- También desactivar
  WHERE id = p_supervisor_id AND is_deleted = false;

  RETURN FOUND;
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Restaurar supervisor eliminado
-- =============================================

CREATE OR REPLACE FUNCTION public.restore_supervisor(
  p_supervisor_id UUID
)
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  email CITEXT,
  rol supervisor_role,
  permisos_sistema permisos_sistema,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  is_deleted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario tiene permisos
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND permisos_sistema = 'ADMIN'
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo usuarios ADMIN pueden restaurar supervisores';
  END IF;

  -- Verificar que el supervisor existe y está eliminado
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE public.supervisores.id = p_supervisor_id 
    AND is_deleted = true
  ) THEN
    RAISE EXCEPTION 'Supervisor no encontrado o no está eliminado';
  END IF;

  -- Restaurar supervisor
  UPDATE public.supervisores 
  SET 
    is_deleted = false,
    deleted_at = NULL,
    deleted_by_supervisor_id = NULL,
    deleted_geom_4326 = NULL,
    deleted_precision_m = NULL,
    deleted_reason = NULL
  WHERE public.supervisores.id = p_supervisor_id;

  -- Retornar supervisor restaurado
  RETURN QUERY
  SELECT 
    s.id,
    s.nombre,
    s.email,
    s.rol,
    s.permisos_sistema,
    s.is_active,
    s.created_at,
    s.is_deleted
  FROM public.supervisores s
  WHERE s.id = p_supervisor_id;
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Obtener estadísticas de supervisores
-- =============================================

CREATE OR REPLACE FUNCTION public.get_supervisores_stats()
RETURNS TABLE (
  total_supervisores BIGINT,
  supervisores_activos BIGINT,
  supervisores_eliminados BIGINT,
  por_rol JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario tiene permisos
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autorizado';
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(*) as total_supervisores,
    COUNT(*) FILTER (WHERE is_active = true AND is_deleted = false) as supervisores_activos,
    COUNT(*) FILTER (WHERE is_deleted = true) as supervisores_eliminados,
    json_object_agg(rol, count_rol) as por_rol
  FROM (
    SELECT 
      rol,
      COUNT(*) as count_rol
    FROM public.supervisores
    WHERE is_deleted = false
    GROUP BY rol
  ) rol_counts;
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Bulk update marcado por locación
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_bulk_update_locacion_marcado(
  p_expediente_id UUID,
  p_locacion TEXT,
  p_status status_trabajo,
  p_motivo TEXT DEFAULT NULL,
  p_only_unset BOOLEAN DEFAULT TRUE,
  p_dry_run BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_supervisor_id UUID;
  total_puntos INTEGER;
  puntos_afectados INTEGER;
  result_json JSONB;
BEGIN
  -- Verificar que el usuario tiene permisos
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autorizado';
  END IF;

  -- Obtener ID del supervisor actual
  current_supervisor_id := public.get_current_supervisor_id();
  
  IF current_supervisor_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo identificar al supervisor actual';
  END IF;

  -- Validar parámetros
  IF p_expediente_id IS NULL THEN
    RAISE EXCEPTION 'expediente_id es requerido';
  END IF;

  IF p_locacion IS NULL OR trim(p_locacion) = '' THEN
    RAISE EXCEPTION 'locacion es requerida';
  END IF;

  -- Si status es DESCARTADO, motivo es obligatorio
  IF p_status = 'DESCARTADO' AND (p_motivo IS NULL OR trim(p_motivo) = '') THEN
    RAISE EXCEPTION 'Motivo es obligatorio cuando status es DESCARTADO';
  END IF;

  -- Contar total de puntos en la locación
  SELECT COUNT(*) INTO total_puntos
  FROM public.monitoreo_puntos
  WHERE expediente_id = p_expediente_id 
    AND locacion = p_locacion 
    AND is_deleted = false;

  -- Contar puntos que serán afectados
  IF p_only_unset THEN
    SELECT COUNT(*) INTO puntos_afectados
    FROM public.monitoreo_puntos
    WHERE expediente_id = p_expediente_id 
      AND locacion = p_locacion 
      AND is_deleted = false
      AND marcado_status = 'PENDIENTE';
  ELSE
    puntos_afectados := total_puntos;
  END IF;

  -- Si es dry_run, solo retornar conteos
  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'total_puntos', total_puntos,
      'puntos_afectados', puntos_afectados,
      'expediente_id', p_expediente_id,
      'locacion', p_locacion,
      'nuevo_status', p_status,
      'motivo', p_motivo
    );
  END IF;

  -- Realizar la actualización masiva
  IF p_only_unset THEN
    UPDATE public.monitoreo_puntos SET
      marcado_status = p_status,
      marcado_motivo = CASE WHEN p_status = 'DESCARTADO' THEN p_motivo ELSE NULL END,
      marcado_at = CASE WHEN p_status = 'HECHO' THEN now() ELSE marcado_at END,
      updated_at = now()
    WHERE expediente_id = p_expediente_id 
      AND locacion = p_locacion 
      AND is_deleted = false
      AND marcado_status = 'PENDIENTE';
  ELSE
    UPDATE public.monitoreo_puntos SET
      marcado_status = p_status,
      marcado_motivo = CASE WHEN p_status = 'DESCARTADO' THEN p_motivo ELSE NULL END,
      marcado_at = CASE WHEN p_status = 'HECHO' THEN now() ELSE marcado_at END,
      updated_at = now()
    WHERE expediente_id = p_expediente_id 
      AND locacion = p_locacion 
      AND is_deleted = false;
  END IF;

  GET DIAGNOSTICS puntos_afectados = ROW_COUNT;

  -- Auditar la operación
  PERFORM public.f_auditar_evento('BULK_UPDATE_MARCADO', jsonb_build_object(
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'status', p_status,
    'motivo', p_motivo,
    'only_unset', p_only_unset,
    'puntos_afectados', puntos_afectados,
    'supervisor_id', current_supervisor_id
  ));

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'total_puntos', total_puntos,
    'puntos_afectados', puntos_afectados,
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'nuevo_status', p_status,
    'motivo', p_motivo
  );
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Bulk update monitoreo por locación
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_bulk_update_locacion_monitoreo(
  p_expediente_id UUID,
  p_locacion TEXT,
  p_status status_trabajo,
  p_accion_id UUID DEFAULT NULL,
  p_motivo TEXT DEFAULT NULL,
  p_only_unset BOOLEAN DEFAULT TRUE,
  p_dry_run BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_supervisor_id UUID;
  total_puntos INTEGER;
  puntos_afectados INTEGER;
  auto_accion_id UUID;
  result_json JSONB;
BEGIN
  -- Verificar que el usuario tiene permisos
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autorizado';
  END IF;

  -- Obtener ID del supervisor actual
  current_supervisor_id := public.get_current_supervisor_id();
  
  IF current_supervisor_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo identificar al supervisor actual';
  END IF;

  -- Validar parámetros
  IF p_expediente_id IS NULL THEN
    RAISE EXCEPTION 'expediente_id es requerido';
  END IF;

  IF p_locacion IS NULL OR trim(p_locacion) = '' THEN
    RAISE EXCEPTION 'locacion es requerida';
  END IF;

  -- Si status es DESCARTADO, motivo es obligatorio
  IF p_status = 'DESCARTADO' AND (p_motivo IS NULL OR trim(p_motivo) = '') THEN
    RAISE EXCEPTION 'Motivo es obligatorio cuando status es DESCARTADO';
  END IF;

  -- Si status es HECHO y no hay accion_id, auto-asignar por fecha
  IF p_status = 'HECHO' AND p_accion_id IS NULL THEN
    auto_accion_id := public.f_default_accion_por_fecha(p_expediente_id, CURRENT_DATE);
  ELSE
    auto_accion_id := p_accion_id;
  END IF;

  -- Contar total de puntos en la locación
  SELECT COUNT(*) INTO total_puntos
  FROM public.monitoreo_puntos
  WHERE expediente_id = p_expediente_id 
    AND locacion = p_locacion 
    AND is_deleted = false;

  -- Contar puntos que serán afectados
  IF p_only_unset THEN
    SELECT COUNT(*) INTO puntos_afectados
    FROM public.monitoreo_puntos
    WHERE expediente_id = p_expediente_id 
      AND locacion = p_locacion 
      AND is_deleted = false
      AND monitoreado_status = 'PENDIENTE';
  ELSE
    puntos_afectados := total_puntos;
  END IF;

  -- Si es dry_run, solo retornar conteos
  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'total_puntos', total_puntos,
      'puntos_afectados', puntos_afectados,
      'expediente_id', p_expediente_id,
      'locacion', p_locacion,
      'nuevo_status', p_status,
      'accion_id', auto_accion_id,
      'motivo', p_motivo
    );
  END IF;

  -- Realizar la actualización masiva
  IF p_only_unset THEN
    UPDATE public.monitoreo_puntos SET
      monitoreado_status = p_status,
      monitoreado_accion_id = CASE WHEN p_status = 'HECHO' THEN auto_accion_id ELSE monitoreado_accion_id END,
      monitoreado_motivo = CASE WHEN p_status = 'DESCARTADO' THEN p_motivo ELSE NULL END,
      monitoreado_at = CASE WHEN p_status = 'HECHO' THEN now() ELSE monitoreado_at END,
      updated_at = now()
    WHERE expediente_id = p_expediente_id 
      AND locacion = p_locacion 
      AND is_deleted = false
      AND monitoreado_status = 'PENDIENTE';
  ELSE
    UPDATE public.monitoreo_puntos SET
      monitoreado_status = p_status,
      monitoreado_accion_id = CASE WHEN p_status = 'HECHO' THEN auto_accion_id ELSE monitoreado_accion_id END,
      monitoreado_motivo = CASE WHEN p_status = 'DESCARTADO' THEN p_motivo ELSE NULL END,
      monitoreado_at = CASE WHEN p_status = 'HECHO' THEN now() ELSE monitoreado_at END,
      updated_at = now()
    WHERE expediente_id = p_expediente_id 
      AND locacion = p_locacion 
      AND is_deleted = false;
  END IF;

  GET DIAGNOSTICS puntos_afectados = ROW_COUNT;

  -- Auditar la operación
  PERFORM public.f_auditar_evento('BULK_UPDATE_MONITOREO', jsonb_build_object(
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'status', p_status,
    'accion_id', auto_accion_id,
    'motivo', p_motivo,
    'only_unset', p_only_unset,
    'puntos_afectados', puntos_afectados,
    'supervisor_id', current_supervisor_id
  ));

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'total_puntos', total_puntos,
    'puntos_afectados', puntos_afectados,
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'nuevo_status', p_status,
    'accion_id', auto_accion_id,
    'motivo', p_motivo
  );
END;
$$;
