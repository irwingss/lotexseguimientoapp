-- =============================================
-- FASE 5: Expedientes y Acciones - RPC Functions
-- =============================================
-- Funciones RPC para CRUD seguro de expedientes, acciones y expediente_supervisores

-- =============================================
-- FUNCIONES RPC PARA EXPEDIENTES
-- =============================================

-- =============================================
-- FUNCIÓN RPC: Listar expedientes con filtros
-- =============================================

CREATE OR REPLACE FUNCTION public.get_expedientes(
  p_include_deleted BOOLEAN DEFAULT false,
  p_search_term TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  expediente_codigo TEXT,
  nombre TEXT,
  created_by_supervisor_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_deleted BOOLEAN,
  deleted_at TIMESTAMPTZ,
  deleted_reason TEXT,
  supervisor_creador JSONB,
  acciones JSONB,
  supervisores_asignados JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario tiene permisos para ver expedientes
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
    e.id,
    e.expediente_codigo,
    e.nombre,
    e.created_by_supervisor_id,
    e.created_at,
    e.updated_at,
    e.is_deleted,
    e.deleted_at,
    e.deleted_reason,
    -- Supervisor creador
    CASE 
      WHEN sc.id IS NOT NULL THEN
        jsonb_build_object(
          'id', sc.id,
          'nombre', sc.nombre,
          'email', sc.email
        )
      ELSE NULL
    END as supervisor_creador,
    -- Acciones del expediente
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'codigo_accion', a.codigo_accion,
          'fecha_inicio', a.fecha_inicio,
          'fecha_fin', a.fecha_fin,
          'is_deleted', a.is_deleted
        )
      )
      FROM public.acciones a 
      WHERE a.expediente_id = e.id
      AND (p_include_deleted OR a.is_deleted = false)
      ), '[]'::jsonb
    ) as acciones,
    -- Supervisores asignados
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'supervisor', jsonb_build_object(
            'id', s.id,
            'nombre', s.nombre,
            'email', s.email,
            'rol', s.rol
          ),
          'assigned_at', es.assigned_at,
          'is_deleted', es.is_deleted
        )
      )
      FROM public.expediente_supervisores es
      JOIN public.supervisores s ON es.supervisor_id = s.id
      WHERE es.expediente_id = e.id
      AND (p_include_deleted OR es.is_deleted = false)
      ), '[]'::jsonb
    ) as supervisores_asignados
  FROM public.expedientes e
  LEFT JOIN public.supervisores sc ON e.created_by_supervisor_id = sc.id
  WHERE 
    -- Filtro por eliminados
    (p_include_deleted OR e.is_deleted = false)
    -- Filtro por búsqueda
    AND (
      p_search_term IS NULL 
      OR e.expediente_codigo ILIKE '%' || p_search_term || '%'
      OR e.nombre ILIKE '%' || p_search_term || '%'
    )
    -- RLS: Solo expedientes que el usuario puede ver
    AND (
      -- ADMIN puede ver todos
      auth.email() IN (
        SELECT email FROM public.supervisores 
        WHERE permisos_sistema = 'ADMIN' 
        AND is_active = true 
        AND is_deleted = false
      )
      OR
      -- Usuario asignado al expediente
      e.id IN (
        SELECT es.expediente_id 
        FROM public.expediente_supervisores es
        JOIN public.supervisores s ON es.supervisor_id = s.id
        WHERE s.email = auth.email()
        AND s.is_active = true 
        AND s.is_deleted = false
        AND es.is_deleted = false
      )
    )
  ORDER BY e.created_at DESC;
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Crear expediente con acciones
-- =============================================

CREATE OR REPLACE FUNCTION public.create_expediente(
  p_expediente_codigo TEXT,
  p_nombre TEXT,
  p_acciones JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  id UUID,
  expediente_codigo TEXT,
  nombre TEXT,
  created_at TIMESTAMPTZ,
  acciones_creadas JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expediente_id UUID;
  v_supervisor_id UUID;
  v_accion JSONB;
  v_acciones_result JSONB := '[]'::jsonb;
BEGIN
  -- Verificar que el usuario tiene permisos ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND permisos_sistema = 'ADMIN'
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo usuarios ADMIN pueden crear expedientes';
  END IF;

  -- Obtener ID del supervisor actual
  SELECT s.id INTO v_supervisor_id
  FROM public.supervisores s
  WHERE s.email = auth.email()
  AND s.is_active = true 
  AND s.is_deleted = false;

  -- Validar que el código de expediente no exista
  IF EXISTS (
    SELECT 1 FROM public.expedientes 
    WHERE expediente_codigo = p_expediente_codigo
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Ya existe un expediente con el código: %', p_expediente_codigo;
  END IF;

  -- Validar máximo 2 acciones
  IF jsonb_array_length(p_acciones) > 2 THEN
    RAISE EXCEPTION 'Un expediente puede tener máximo 2 acciones';
  END IF;

  -- Crear expediente
  INSERT INTO public.expedientes (
    expediente_codigo,
    nombre,
    created_by_supervisor_id
  ) VALUES (
    p_expediente_codigo,
    p_nombre,
    v_supervisor_id
  ) RETURNING public.expedientes.id INTO v_expediente_id;

  -- Crear acciones si se proporcionaron
  FOR v_accion IN SELECT * FROM jsonb_array_elements(p_acciones)
  LOOP
    -- Validar campos requeridos
    IF NOT (v_accion ? 'codigo_accion' AND v_accion ? 'fecha_inicio' AND v_accion ? 'fecha_fin') THEN
      RAISE EXCEPTION 'Cada acción debe tener codigo_accion, fecha_inicio y fecha_fin';
    END IF;

    -- Validar fechas
    IF (v_accion->>'fecha_inicio')::date > (v_accion->>'fecha_fin')::date THEN
      RAISE EXCEPTION 'La fecha de inicio no puede ser mayor que la fecha de fin';
    END IF;

    -- Insertar acción
    INSERT INTO public.acciones (
      expediente_id,
      codigo_accion,
      fecha_inicio,
      fecha_fin
    ) VALUES (
      v_expediente_id,
      v_accion->>'codigo_accion',
      (v_accion->>'fecha_inicio')::date,
      (v_accion->>'fecha_fin')::date
    );

    -- Agregar a resultado
    v_acciones_result := v_acciones_result || jsonb_build_object(
      'codigo_accion', v_accion->>'codigo_accion',
      'fecha_inicio', v_accion->>'fecha_inicio',
      'fecha_fin', v_accion->>'fecha_fin'
    );
  END LOOP;

  -- Retornar expediente creado
  RETURN QUERY
  SELECT 
    v_expediente_id,
    p_expediente_codigo,
    p_nombre,
    now(),
    v_acciones_result;
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Actualizar expediente
-- =============================================

CREATE OR REPLACE FUNCTION public.update_expediente(
  p_expediente_id UUID,
  p_expediente_codigo TEXT DEFAULT NULL,
  p_nombre TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  expediente_codigo TEXT,
  nombre TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario tiene permisos ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND permisos_sistema = 'ADMIN'
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo usuarios ADMIN pueden actualizar expedientes';
  END IF;

  -- Verificar que el expediente existe
  IF NOT EXISTS (
    SELECT 1 FROM public.expedientes 
    WHERE public.expedientes.id = p_expediente_id 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Expediente no encontrado';
  END IF;

  -- Validar código único si se proporciona
  IF p_expediente_codigo IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.expedientes 
    WHERE expediente_codigo = p_expediente_codigo
    AND public.expedientes.id != p_expediente_id
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Ya existe un expediente con el código: %', p_expediente_codigo;
  END IF;

  -- Actualizar expediente
  UPDATE public.expedientes 
  SET 
    expediente_codigo = COALESCE(p_expediente_codigo, expediente_codigo),
    nombre = COALESCE(p_nombre, nombre),
    updated_at = now()
  WHERE public.expedientes.id = p_expediente_id;

  -- Retornar expediente actualizado
  RETURN QUERY
  SELECT 
    e.id,
    e.expediente_codigo,
    e.nombre,
    e.updated_at
  FROM public.expedientes e
  WHERE e.id = p_expediente_id;
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Eliminar expediente (soft delete)
-- =============================================

CREATE OR REPLACE FUNCTION public.delete_expediente(
  p_expediente_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_geom_lat DOUBLE PRECISION DEFAULT NULL,
  p_geom_lng DOUBLE PRECISION DEFAULT NULL,
  p_precision_m DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  expediente_codigo TEXT,
  nombre TEXT,
  deleted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supervisor_id UUID;
  v_geom GEOMETRY;
BEGIN
  -- Verificar que el usuario tiene permisos ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND permisos_sistema = 'ADMIN'
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo usuarios ADMIN pueden eliminar expedientes';
  END IF;

  -- Obtener ID del supervisor actual
  SELECT s.id INTO v_supervisor_id
  FROM public.supervisores s
  WHERE s.email = auth.email()
  AND s.is_active = true 
  AND s.is_deleted = false;

  -- Verificar que el expediente existe
  IF NOT EXISTS (
    SELECT 1 FROM public.expedientes 
    WHERE public.expedientes.id = p_expediente_id 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Expediente no encontrado';
  END IF;

  -- Crear geometría si se proporcionan coordenadas
  IF p_geom_lat IS NOT NULL AND p_geom_lng IS NOT NULL THEN
    v_geom := ST_SetSRID(ST_MakePoint(p_geom_lng, p_geom_lat), 4326);
  END IF;

  -- Soft delete del expediente
  UPDATE public.expedientes 
  SET 
    is_deleted = true,
    deleted_at = now(),
    deleted_by_supervisor_id = v_supervisor_id,
    deleted_geom_4326 = v_geom,
    deleted_precision_m = p_precision_m,
    deleted_reason = p_reason
  WHERE public.expedientes.id = p_expediente_id;

  -- Retornar expediente eliminado
  RETURN QUERY
  SELECT 
    e.id,
    e.expediente_codigo,
    e.nombre,
    e.deleted_at
  FROM public.expedientes e
  WHERE e.id = p_expediente_id;
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Restaurar expediente eliminado
-- =============================================

CREATE OR REPLACE FUNCTION public.restore_expediente(
  p_expediente_id UUID
)
RETURNS TABLE (
  id UUID,
  expediente_codigo TEXT,
  nombre TEXT,
  is_deleted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario tiene permisos ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND permisos_sistema = 'ADMIN'
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo usuarios ADMIN pueden restaurar expedientes';
  END IF;

  -- Verificar que el expediente existe y está eliminado
  IF NOT EXISTS (
    SELECT 1 FROM public.expedientes 
    WHERE public.expedientes.id = p_expediente_id 
    AND is_deleted = true
  ) THEN
    RAISE EXCEPTION 'Expediente no encontrado o no está eliminado';
  END IF;

  -- Restaurar expediente
  UPDATE public.expedientes 
  SET 
    is_deleted = false,
    deleted_at = NULL,
    deleted_by_supervisor_id = NULL,
    deleted_geom_4326 = NULL,
    deleted_precision_m = NULL,
    deleted_reason = NULL
  WHERE public.expedientes.id = p_expediente_id;

  -- Retornar expediente restaurado
  RETURN QUERY
  SELECT 
    e.id,
    e.expediente_codigo,
    e.nombre,
    e.is_deleted
  FROM public.expedientes e
  WHERE e.id = p_expediente_id;
END;
$$;

-- =============================================
-- FUNCIONES RPC PARA ACCIONES
-- =============================================

-- =============================================
-- FUNCIÓN RPC: Crear acción
-- =============================================

CREATE OR REPLACE FUNCTION public.create_accion(
  p_expediente_id UUID,
  p_codigo_accion TEXT,
  p_fecha_inicio DATE,
  p_fecha_fin DATE
)
RETURNS TABLE (
  id UUID,
  expediente_id UUID,
  codigo_accion TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_accion_id UUID;
BEGIN
  -- Verificar que el usuario tiene permisos ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND permisos_sistema = 'ADMIN'
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo usuarios ADMIN pueden crear acciones';
  END IF;

  -- Verificar que el expediente existe
  IF NOT EXISTS (
    SELECT 1 FROM public.expedientes 
    WHERE public.expedientes.id = p_expediente_id 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Expediente no encontrado';
  END IF;

  -- Validar que no exista acción con el mismo código en el expediente
  IF EXISTS (
    SELECT 1 FROM public.acciones 
    WHERE expediente_id = p_expediente_id
    AND codigo_accion = p_codigo_accion
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Ya existe una acción con el código % en este expediente', p_codigo_accion;
  END IF;

  -- Validar máximo 2 acciones por expediente
  IF (
    SELECT COUNT(*) 
    FROM public.acciones 
    WHERE expediente_id = p_expediente_id 
    AND is_deleted = false
  ) >= 2 THEN
    RAISE EXCEPTION 'Un expediente puede tener máximo 2 acciones';
  END IF;

  -- Validar fechas
  IF p_fecha_inicio > p_fecha_fin THEN
    RAISE EXCEPTION 'La fecha de inicio no puede ser mayor que la fecha de fin';
  END IF;

  -- Crear acción
  INSERT INTO public.acciones (
    expediente_id,
    codigo_accion,
    fecha_inicio,
    fecha_fin
  ) VALUES (
    p_expediente_id,
    p_codigo_accion,
    p_fecha_inicio,
    p_fecha_fin
  ) RETURNING public.acciones.id INTO v_accion_id;

  -- Retornar acción creada
  RETURN QUERY
  SELECT 
    a.id,
    a.expediente_id,
    a.codigo_accion,
    a.fecha_inicio,
    a.fecha_fin,
    a.created_at
  FROM public.acciones a
  WHERE a.id = v_accion_id;
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Eliminar acción (soft delete)
-- =============================================

CREATE OR REPLACE FUNCTION public.delete_accion(
  p_accion_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_geom_lat DOUBLE PRECISION DEFAULT NULL,
  p_geom_lng DOUBLE PRECISION DEFAULT NULL,
  p_precision_m DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  codigo_accion TEXT,
  deleted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supervisor_id UUID;
  v_geom GEOMETRY;
BEGIN
  -- Verificar que el usuario tiene permisos ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND permisos_sistema = 'ADMIN'
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo usuarios ADMIN pueden eliminar acciones';
  END IF;

  -- Obtener ID del supervisor actual
  SELECT s.id INTO v_supervisor_id
  FROM public.supervisores s
  WHERE s.email = auth.email()
  AND s.is_active = true 
  AND s.is_deleted = false;

  -- Verificar que la acción existe
  IF NOT EXISTS (
    SELECT 1 FROM public.acciones 
    WHERE public.acciones.id = p_accion_id 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acción no encontrada';
  END IF;

  -- Crear geometría si se proporcionan coordenadas
  IF p_geom_lat IS NOT NULL AND p_geom_lng IS NOT NULL THEN
    v_geom := ST_SetSRID(ST_MakePoint(p_geom_lng, p_geom_lat), 4326);
  END IF;

  -- Soft delete de la acción
  UPDATE public.acciones 
  SET 
    is_deleted = true,
    deleted_at = now(),
    deleted_by_supervisor_id = v_supervisor_id,
    deleted_geom_4326 = v_geom,
    deleted_precision_m = p_precision_m,
    deleted_reason = p_reason
  WHERE public.acciones.id = p_accion_id;

  -- Retornar acción eliminada
  RETURN QUERY
  SELECT 
    a.id,
    a.codigo_accion,
    a.deleted_at
  FROM public.acciones a
  WHERE a.id = p_accion_id;
END;
$$;

-- =============================================
-- FUNCIONES RPC PARA EXPEDIENTE_SUPERVISORES
-- =============================================

-- =============================================
-- FUNCIÓN RPC: Asignar supervisor a expediente
-- =============================================

CREATE OR REPLACE FUNCTION public.assign_supervisor_to_expediente(
  p_expediente_id UUID,
  p_supervisor_id UUID
)
RETURNS TABLE (
  id UUID,
  expediente_id UUID,
  supervisor_id UUID,
  assigned_at TIMESTAMPTZ,
  supervisor_info JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignment_id UUID;
BEGIN
  -- Verificar que el usuario tiene permisos ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND permisos_sistema = 'ADMIN'
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo usuarios ADMIN pueden asignar supervisores';
  END IF;

  -- Verificar que el expediente existe
  IF NOT EXISTS (
    SELECT 1 FROM public.expedientes 
    WHERE public.expedientes.id = p_expediente_id 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Expediente no encontrado';
  END IF;

  -- Verificar que el supervisor existe y está activo
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE public.supervisores.id = p_supervisor_id 
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Supervisor no encontrado o inactivo';
  END IF;

  -- Verificar que no existe ya la asignación
  IF EXISTS (
    SELECT 1 FROM public.expediente_supervisores 
    WHERE expediente_id = p_expediente_id
    AND supervisor_id = p_supervisor_id
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'El supervisor ya está asignado a este expediente';
  END IF;

  -- Crear asignación
  INSERT INTO public.expediente_supervisores (
    expediente_id,
    supervisor_id
  ) VALUES (
    p_expediente_id,
    p_supervisor_id
  ) RETURNING public.expediente_supervisores.id INTO v_assignment_id;

  -- Retornar asignación creada
  RETURN QUERY
  SELECT 
    es.id,
    es.expediente_id,
    es.supervisor_id,
    es.assigned_at,
    jsonb_build_object(
      'id', s.id,
      'nombre', s.nombre,
      'email', s.email,
      'rol', s.rol
    ) as supervisor_info
  FROM public.expediente_supervisores es
  JOIN public.supervisores s ON es.supervisor_id = s.id
  WHERE es.id = v_assignment_id;
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Remover supervisor de expediente
-- =============================================

CREATE OR REPLACE FUNCTION public.remove_supervisor_from_expediente(
  p_expediente_id UUID,
  p_supervisor_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_geom_lat DOUBLE PRECISION DEFAULT NULL,
  p_geom_lng DOUBLE PRECISION DEFAULT NULL,
  p_precision_m DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  expediente_id UUID,
  supervisor_id UUID,
  deleted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_supervisor_id UUID;
  v_geom GEOMETRY;
BEGIN
  -- Verificar que el usuario tiene permisos ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND permisos_sistema = 'ADMIN'
    AND is_active = true 
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: solo usuarios ADMIN pueden remover supervisores';
  END IF;

  -- Obtener ID del supervisor actual
  SELECT s.id INTO v_current_supervisor_id
  FROM public.supervisores s
  WHERE s.email = auth.email()
  AND s.is_active = true 
  AND s.is_deleted = false;

  -- Verificar que la asignación existe
  IF NOT EXISTS (
    SELECT 1 FROM public.expediente_supervisores 
    WHERE expediente_id = p_expediente_id
    AND supervisor_id = p_supervisor_id
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Asignación no encontrada';
  END IF;

  -- Crear geometría si se proporcionan coordenadas
  IF p_geom_lat IS NOT NULL AND p_geom_lng IS NOT NULL THEN
    v_geom := ST_SetSRID(ST_MakePoint(p_geom_lng, p_geom_lat), 4326);
  END IF;

  -- Soft delete de la asignación
  UPDATE public.expediente_supervisores 
  SET 
    is_deleted = true,
    deleted_at = now(),
    deleted_by_supervisor_id = v_current_supervisor_id,
    deleted_geom_4326 = v_geom,
    deleted_precision_m = p_precision_m,
    deleted_reason = p_reason
  WHERE expediente_id = p_expediente_id
  AND supervisor_id = p_supervisor_id;

  -- Retornar asignación eliminada
  RETURN QUERY
  SELECT 
    es.id,
    es.expediente_id,
    es.supervisor_id,
    es.deleted_at
  FROM public.expediente_supervisores es
  WHERE es.expediente_id = p_expediente_id
  AND es.supervisor_id = p_supervisor_id;
END;
$$;
