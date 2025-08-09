-- =============================================
-- FASE 5: Expedientes y Acciones - Triggers
-- =============================================
-- Triggers para auditoría y protección contra DELETE físico

-- =============================================
-- FUNCIÓN PARA BLOQUEAR DELETE FÍSICO
-- =============================================

CREATE OR REPLACE FUNCTION public.f_block_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'DELETE físico bloqueado. Use soft delete vía RPC para tabla: %', TG_TABLE_NAME;
  RETURN NULL;
END;
$$;

-- =============================================
-- TRIGGERS PARA BLOQUEAR DELETE FÍSICO
-- =============================================

-- Trigger para expedientes
DROP TRIGGER IF EXISTS trigger_block_hard_delete_expedientes ON public.expedientes;
CREATE TRIGGER trigger_block_hard_delete_expedientes
  BEFORE DELETE ON public.expedientes
  FOR EACH ROW
  EXECUTE FUNCTION public.f_block_hard_delete();

-- Trigger para acciones
DROP TRIGGER IF EXISTS trigger_block_hard_delete_acciones ON public.acciones;
CREATE TRIGGER trigger_block_hard_delete_acciones
  BEFORE DELETE ON public.acciones
  FOR EACH ROW
  EXECUTE FUNCTION public.f_block_hard_delete();

-- Trigger para expediente_supervisores
DROP TRIGGER IF EXISTS trigger_block_hard_delete_expediente_supervisores ON public.expediente_supervisores;
CREATE TRIGGER trigger_block_hard_delete_expediente_supervisores
  BEFORE DELETE ON public.expediente_supervisores
  FOR EACH ROW
  EXECUTE FUNCTION public.f_block_hard_delete();

-- =============================================
-- FUNCIÓN PARA AUDITORÍA AUTOMÁTICA
-- =============================================

CREATE OR REPLACE FUNCTION public.f_audit_expedientes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supervisor_id UUID;
  v_operation TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  -- Obtener ID del supervisor actual
  SELECT id INTO v_supervisor_id
  FROM public.supervisores 
  WHERE email = auth.email()
  AND is_active = true 
  AND is_deleted = false;

  -- Determinar operación
  IF TG_OP = 'DELETE' THEN
    v_operation := 'DELETE';
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_operation := 'UPDATE';
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'INSERT' THEN
    v_operation := 'INSERT';
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  END IF;

  -- Insertar evento de auditoría si existe la tabla
  BEGIN
    INSERT INTO public.auditoria_eventos (
      tabla_afectada,
      registro_id,
      operacion,
      datos_anteriores,
      datos_nuevos,
      supervisor_id,
      timestamp_evento
    ) VALUES (
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      v_operation,
      v_old_data,
      v_new_data,
      v_supervisor_id,
      now()
    );
  EXCEPTION
    WHEN undefined_table THEN
      -- Tabla de auditoría no existe, continuar sin auditar
      NULL;
  END;

  -- Retornar registro apropiado
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- =============================================
-- TRIGGERS DE AUDITORÍA
-- =============================================

-- Trigger de auditoría para expedientes
DROP TRIGGER IF EXISTS trigger_audit_expedientes ON public.expedientes;
CREATE TRIGGER trigger_audit_expedientes
  AFTER INSERT OR UPDATE OR DELETE ON public.expedientes
  FOR EACH ROW
  EXECUTE FUNCTION public.f_audit_expedientes();

-- Trigger de auditoría para acciones
DROP TRIGGER IF EXISTS trigger_audit_acciones ON public.acciones;
CREATE TRIGGER trigger_audit_acciones
  AFTER INSERT OR UPDATE OR DELETE ON public.acciones
  FOR EACH ROW
  EXECUTE FUNCTION public.f_audit_expedientes();

-- Trigger de auditoría para expediente_supervisores
DROP TRIGGER IF EXISTS trigger_audit_expediente_supervisores ON public.expediente_supervisores;
CREATE TRIGGER trigger_audit_expediente_supervisores
  AFTER INSERT OR UPDATE OR DELETE ON public.expediente_supervisores
  FOR EACH ROW
  EXECUTE FUNCTION public.f_audit_expedientes();

-- =============================================
-- FUNCIÓN PARA VALIDAR FECHAS EN ACCIONES
-- =============================================

CREATE OR REPLACE FUNCTION public.f_validate_accion_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validar que fecha_inicio <= fecha_fin
  IF NEW.fecha_inicio > NEW.fecha_fin THEN
    RAISE EXCEPTION 'La fecha de inicio (%) no puede ser mayor que la fecha de fin (%)', 
      NEW.fecha_inicio, NEW.fecha_fin;
  END IF;

  -- Validar que no existan más de 2 acciones por expediente
  IF TG_OP = 'INSERT' THEN
    IF (
      SELECT COUNT(*) 
      FROM public.acciones 
      WHERE expediente_id = NEW.expediente_id 
      AND is_deleted = false
    ) >= 2 THEN
      RAISE EXCEPTION 'Un expediente puede tener máximo 2 acciones';
    END IF;
  END IF;

  -- Validar código único por expediente
  IF EXISTS (
    SELECT 1 FROM public.acciones 
    WHERE expediente_id = NEW.expediente_id
    AND codigo_accion = NEW.codigo_accion
    AND id != NEW.id
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Ya existe una acción con el código % en este expediente', NEW.codigo_accion;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================
-- TRIGGER PARA VALIDAR ACCIONES
-- =============================================

DROP TRIGGER IF EXISTS trigger_validate_acciones ON public.acciones;
CREATE TRIGGER trigger_validate_acciones
  BEFORE INSERT OR UPDATE ON public.acciones
  FOR EACH ROW
  EXECUTE FUNCTION public.f_validate_accion_dates();

-- =============================================
-- FUNCIÓN PARA VALIDAR ASIGNACIONES ÚNICAS
-- =============================================

CREATE OR REPLACE FUNCTION public.f_validate_unique_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validar que no exista ya la asignación
  IF EXISTS (
    SELECT 1 FROM public.expediente_supervisores 
    WHERE expediente_id = NEW.expediente_id
    AND supervisor_id = NEW.supervisor_id
    AND id != NEW.id
    AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'El supervisor ya está asignado a este expediente';
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================
-- TRIGGER PARA VALIDAR ASIGNACIONES
-- =============================================

DROP TRIGGER IF EXISTS trigger_validate_assignments ON public.expediente_supervisores;
CREATE TRIGGER trigger_validate_assignments
  BEFORE INSERT OR UPDATE ON public.expediente_supervisores
  FOR EACH ROW
  EXECUTE FUNCTION public.f_validate_unique_assignment();
