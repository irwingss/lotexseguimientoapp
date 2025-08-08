-- =============================================
-- FASE 1: Bulk Actions y Funciones RPC Avanzadas
-- =============================================
-- Funciones RPC críticas según specs_app.yaml que faltaban en la implementación inicial

-- =============================================
-- FUNCIÓN AUXILIAR: Obtener acción por fecha
-- =============================================

CREATE OR REPLACE FUNCTION public.f_default_accion_por_fecha(
  p_expediente_id UUID,
  p_fecha DATE
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id 
  FROM public.acciones
  WHERE expediente_id = p_expediente_id
    AND p_fecha BETWEEN fecha_inicio AND fecha_fin
    AND is_deleted = false
  LIMIT 1;
$$;

-- =============================================
-- FUNCIÓN AUXILIAR: Auditar eventos
-- =============================================

CREATE OR REPLACE FUNCTION public.f_auditar_evento(
  p_evento TEXT,
  p_detalle JSONB
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO public.auditoria_eventos (
    tabla_afectada,
    registro_id,
    accion,
    datos_nuevos,
    supervisor_id,
    timestamp_evento
  ) VALUES (
    'bulk_action',
    gen_random_uuid(),
    p_evento,
    p_detalle,
    public.get_current_supervisor_id(),
    now()
  );
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

-- =============================================
-- FUNCIÓN RPC: Crear replanteo
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_crear_replanteo(
  p_original_id UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_supervisor_id UUID;
  original_punto RECORD;
  nuevo_punto_id UUID;
  motivo_descartado TEXT;
BEGIN
  -- Verificar que el usuario tiene permisos
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND is_active = true 
    AND is_deleted = false
    AND permisos_sistema IN ('SUPERVISOR', 'MONITOR', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autorizado para crear replanteos';
  END IF;

  -- Obtener ID del supervisor actual
  current_supervisor_id := public.get_current_supervisor_id();
  
  IF current_supervisor_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo identificar al supervisor actual';
  END IF;

  -- Validar parámetros
  IF p_original_id IS NULL THEN
    RAISE EXCEPTION 'original_id es requerido';
  END IF;

  -- Extraer motivo del payload
  motivo_descartado := p_payload->>'motivo_descartado';
  
  IF motivo_descartado IS NULL OR trim(motivo_descartado) = '' THEN
    RAISE EXCEPTION 'motivo_descartado es requerido en el payload';
  END IF;

  -- Obtener el punto original
  SELECT * INTO original_punto
  FROM public.monitoreo_puntos
  WHERE id = p_original_id 
    AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Punto original no encontrado o eliminado';
  END IF;

  -- Verificar que el usuario tiene acceso al expediente
  IF NOT EXISTS (
    SELECT 1 FROM public.expediente_supervisores es
    WHERE es.expediente_id = original_punto.expediente_id
      AND es.supervisor_id = current_supervisor_id
      AND es.is_deleted = false
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a este expediente';
  END IF;

  -- Transacción atómica: DESCARTAR original + INSERT nuevo
  BEGIN
    -- 1. Descartar el punto original
    UPDATE public.monitoreo_puntos SET
      estatus = 'DESCARTADO',
      marcado_status = 'DESCARTADO',
      marcado_motivo = motivo_descartado,
      updated_at = now()
    WHERE id = p_original_id;

    -- 2. Crear nuevo punto con tipo_origen=REPLANTEO
    INSERT INTO public.monitoreo_puntos (
      expediente_id,
      locacion,
      cod_celda,
      cod_grilla,
      este,
      norte,
      prof,
      p_superpos,
      cod_punto_campo,
      cod_colectora,
      distancia,
      tipo_origen,
      parent_punto_id,
      created_at,
      updated_at
    ) VALUES (
      original_punto.expediente_id,
      original_punto.locacion,
      original_punto.cod_celda,
      original_punto.cod_grilla,
      (p_payload->>'este')::DOUBLE PRECISION,
      (p_payload->>'norte')::DOUBLE PRECISION,
      (p_payload->>'prof')::DOUBLE PRECISION,
      original_punto.p_superpos,
      original_punto.cod_punto_campo || 'R',
      original_punto.cod_colectora || 'R',
      (p_payload->>'distancia')::DOUBLE PRECISION,
      'REPLANTEO',
      p_original_id,
      now(),
      now()
    ) RETURNING id INTO nuevo_punto_id;

    -- 3. Auditar la operación
    PERFORM public.f_auditar_evento('CREAR_REPLANTEO', jsonb_build_object(
      'original_id', p_original_id,
      'nuevo_id', nuevo_punto_id,
      'motivo_descartado', motivo_descartado,
      'supervisor_id', current_supervisor_id,
      'expediente_id', original_punto.expediente_id
    ));

  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Error en transacción de replanteo: %', SQLERRM;
  END;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'original', jsonb_build_object(
      'id', p_original_id,
      'status', 'DESCARTADO',
      'motivo', motivo_descartado
    ),
    'nuevo', jsonb_build_object(
      'id', nuevo_punto_id,
      'tipo_origen', 'REPLANTEO',
      'parent_punto_id', p_original_id,
      'cod_punto_campo', original_punto.cod_punto_campo || 'R',
      'cod_colectora', original_punto.cod_colectora || 'R'
    )
  );
END;
$$;

-- =============================================
-- FUNCIÓN RPC: Crear punto añadido
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_crear_anadido(
  p_expediente_id UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_supervisor_id UUID;
  nuevo_punto_id UUID;
  locacion_val TEXT;
  cod_punto_campo_val TEXT;
  cod_colectora_val TEXT;
BEGIN
  -- Verificar que el usuario tiene permisos
  IF NOT EXISTS (
    SELECT 1 FROM public.supervisores 
    WHERE email = auth.email()
    AND is_active = true 
    AND is_deleted = false
    AND permisos_sistema IN ('SUPERVISOR', 'MONITOR', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: usuario no autorizado para crear puntos añadidos';
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

  -- Verificar que el usuario tiene acceso al expediente
  IF NOT EXISTS (
    SELECT 1 FROM public.expediente_supervisores es
    WHERE es.expediente_id = p_expediente_id
      AND es.supervisor_id = current_supervisor_id
      AND es.is_deleted = false
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a este expediente';
  END IF;

  -- Extraer valores del payload
  locacion_val := p_payload->>'locacion';
  cod_punto_campo_val := p_payload->>'cod_punto_campo';
  cod_colectora_val := p_payload->>'cod_colectora';

  -- Validar campos requeridos
  IF locacion_val IS NULL OR trim(locacion_val) = '' THEN
    RAISE EXCEPTION 'locacion es requerida en el payload';
  END IF;

  IF cod_punto_campo_val IS NULL OR trim(cod_punto_campo_val) = '' THEN
    RAISE EXCEPTION 'cod_punto_campo es requerido en el payload';
  END IF;

  IF cod_colectora_val IS NULL OR trim(cod_colectora_val) = '' THEN
    RAISE EXCEPTION 'cod_colectora es requerido en el payload';
  END IF;

  -- Verificar unicidad por expediente
  IF EXISTS (
    SELECT 1 FROM public.monitoreo_puntos
    WHERE expediente_id = p_expediente_id
      AND cod_punto_campo = cod_punto_campo_val
      AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Ya existe un punto con cod_punto_campo % en este expediente', cod_punto_campo_val;
  END IF;

  -- Insertar nuevo punto añadido
  INSERT INTO public.monitoreo_puntos (
    expediente_id,
    locacion,
    cod_celda,
    cod_grilla,
    este,
    norte,
    prof,
    p_superpos,
    cod_punto_campo,
    cod_colectora,
    distancia,
    tipo_origen,
    estatus,
    created_at,
    updated_at
  ) VALUES (
    p_expediente_id,
    locacion_val,
    p_payload->>'cod_celda',
    p_payload->>'cod_grilla',
    (p_payload->>'este')::DOUBLE PRECISION,
    (p_payload->>'norte')::DOUBLE PRECISION,
    (p_payload->>'prof')::DOUBLE PRECISION,
    (p_payload->>'p_superpos')::DOUBLE PRECISION,
    cod_punto_campo_val,
    cod_colectora_val,
    (p_payload->>'distancia')::DOUBLE PRECISION,
    'ANADIDO',
    'ANADIDO',
    now(),
    now()
  ) RETURNING id INTO nuevo_punto_id;

  -- Auditar la operación
  PERFORM public.f_auditar_evento('CREAR_ANADIDO', jsonb_build_object(
    'nuevo_id', nuevo_punto_id,
    'expediente_id', p_expediente_id,
    'locacion', locacion_val,
    'cod_punto_campo', cod_punto_campo_val,
    'supervisor_id', current_supervisor_id,
    'payload', p_payload
  ));

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'nuevo_punto', jsonb_build_object(
      'id', nuevo_punto_id,
      'expediente_id', p_expediente_id,
      'locacion', locacion_val,
      'cod_punto_campo', cod_punto_campo_val,
      'cod_colectora', cod_colectora_val,
      'tipo_origen', 'ANADIDO',
      'estatus', 'ANADIDO'
    )
  );
END;
$$;
