-- =============================================
-- FASE 4: Admin Supervisores - Schema Creation
-- =============================================
-- Basado en specs_app.yaml como única fuente de verdad

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- =============================================
-- ENUMS
-- =============================================

-- Enum para roles de supervisor
CREATE TYPE supervisor_role AS ENUM (
  'SUPERVISOR',
  'SUPERVISOR_LIDER', 
  'MONITOR',
  'CONDUCTOR',
  'RESPONSABLE_OIG'
);

-- Enum para permisos del sistema
CREATE TYPE permisos_sistema AS ENUM (
  'ADMIN',
  'SUPERVISOR', 
  'MONITOR'
);

-- Enum para status de trabajo
CREATE TYPE status_trabajo AS ENUM (
  'PENDIENTE',
  'HECHO',
  'DESCARTADO'
);

-- Enum para estatus de puntos
CREATE TYPE punto_estatus AS ENUM (
  'PENDIENTE',
  'MARCADO',
  'MONITOREADO',
  'MARCADO_Y_MONITOREADO',
  'DESCARTADO',
  'REPLANTEADO',
  'ANADIDO'
);

-- Enum para tipos de vuelo
CREATE TYPE vuelo_tipo AS ENUM (
  'PAF',
  'PD'
);

-- Enum para targets de asignación
CREATE TYPE asignacion_target AS ENUM (
  'LOCACION',
  'PUNTO_MONITOREO',
  'VUELO_ITEM'
);

-- Enum para tipos de actividad
CREATE TYPE actividad_tipo AS ENUM (
  'MARCAR',
  'MONITOREAR',
  'VOLAR'
);

-- =============================================
-- TABLA SUPERVISORES
-- =============================================

CREATE TABLE public.supervisores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email CITEXT UNIQUE NOT NULL,
  rol supervisor_role NOT NULL,
  permisos_sistema permisos_sistema NOT NULL DEFAULT 'SUPERVISOR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by_supervisor_id UUID REFERENCES public.supervisores(id),
  deleted_geom_4326 GEOMETRY(Point, 4326),
  deleted_precision_m DOUBLE PRECISION,
  deleted_reason TEXT
);

-- Índice único para email
CREATE UNIQUE INDEX unique_email ON public.supervisores(email);

-- Comentario de la tabla
COMMENT ON TABLE public.supervisores IS 'Lista blanca de accesos y roles fijos por persona. Gestionable por ADMIN desde la app.';

-- =============================================
-- TABLA EXPEDIENTES (para futuras fases)
-- =============================================

CREATE TABLE public.expedientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  created_by_supervisor_id UUID REFERENCES public.supervisores(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by_supervisor_id UUID REFERENCES public.supervisores(id),
  deleted_geom_4326 GEOMETRY(Point, 4326),
  deleted_precision_m DOUBLE PRECISION,
  deleted_reason TEXT
);

-- Índice para código de expediente
CREATE INDEX idx_expediente_codigo ON public.expedientes USING btree(expediente_codigo);

COMMENT ON TABLE public.expedientes IS 'Expediente mensual (supervisión).';

-- =============================================
-- TABLA ACCIONES (para futuras fases)
-- =============================================

CREATE TABLE public.acciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID REFERENCES public.expedientes(id) ON DELETE CASCADE,
  codigo_accion TEXT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by_supervisor_id UUID REFERENCES public.supervisores(id),
  deleted_geom_4326 GEOMETRY(Point, 4326),
  deleted_precision_m DOUBLE PRECISION,
  deleted_reason TEXT,
  CONSTRAINT unique_expediente_accion UNIQUE(expediente_id, codigo_accion)
);

COMMENT ON TABLE public.acciones IS 'Códigos de acción (1..2) por expediente, con rango de fechas.';

-- =============================================
-- TABLA EXPEDIENTE_SUPERVISORES (para futuras fases)
-- =============================================

CREATE TABLE public.expediente_supervisores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID REFERENCES public.expedientes(id) ON DELETE CASCADE,
  supervisor_id UUID REFERENCES public.supervisores(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by_supervisor_id UUID REFERENCES public.supervisores(id),
  deleted_geom_4326 GEOMETRY(Point, 4326),
  deleted_precision_m DOUBLE PRECISION,
  deleted_reason TEXT,
  CONSTRAINT unique_asignacion UNIQUE(expediente_id, supervisor_id)
);

COMMENT ON TABLE public.expediente_supervisores IS 'Asignación de personal (por rol fijo) a un expediente.';
