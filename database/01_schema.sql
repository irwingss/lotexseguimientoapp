-- 01_schema.sql
-- Fuente: estado vivo Supabase (proyecto iklzduuotmrzqxzdcfji)
-- Objetivo: reflejar exactamente el esquema (tipos, tablas, constraints, índices)
-- Nota: ejecutar en una base vacía. Requiere extensiones: postgis, pgcrypto, citext

-- Extensiones requeridas
create extension if not exists postgis;
create extension if not exists pgcrypto;
create extension if not exists citext;

-- Enums (orden según live DB)
-- actividad_tipo
create type public.actividad_tipo as enum ('MARCAR','MONITOREAR','VOLAR');
-- asignacion_target
create type public.asignacion_target as enum ('LOCACION','PUNTO_MONITOREO','VUELO_ITEM');
-- estado_avance
create type public.estado_avance as enum ('PENDIENTE','HECHO','DESCARTADO');
-- estado_expediente
create type public.estado_expediente as enum ('ACTIVO','CERRADO','SUSPENDIDO');
-- permisos_sistema
create type public.permisos_sistema as enum ('ADMIN','SUPERVISOR','MONITOR','no_ADMIN');
-- punto_estatus
create type public.punto_estatus as enum (
  'PENDIENTE','MARCADO','MONITOREADO','MARCADO_Y_MONITOREADO','DESCARTADO','REPLANTEADO','ANADIDO'
);
-- rol_supervisor
create type public.rol_supervisor as enum ('SUPERVISOR','SUPERVISOR_LIDER','MONITOR','CONDUCTOR','RESPONSABLE_OIG');
-- status_trabajo
create type public.status_trabajo as enum ('PENDIENTE','HECHO','DESCARTADO');
-- tipo_vuelo (y vuelo_tipo existen ambos en vivo)
create type public.tipo_vuelo as enum ('PAF','PD');
create type public.vuelo_tipo as enum ('PAF','PD');

-- Tabla: public.supervisores
create table if not exists public.supervisores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email citext not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  deleted_by_supervisor_id uuid null,
  deleted_geom_4326 geometry null,
  deleted_precision_m double precision null,
  deleted_reason text null,
  permisos_sistema public.permisos_sistema not null default 'SUPERVISOR',
  rol public.rol_supervisor not null default 'SUPERVISOR',
  constraint supervisores_deleted_by_supervisor_id_fkey foreign key (deleted_by_supervisor_id) references public.supervisores(id)
);
-- índices/únicos
create unique index if not exists supervisores_pkey on public.supervisores (id);
create unique index if not exists supervisores_email_key on public.supervisores (email);
create unique index if not exists unique_email on public.supervisores (email);

-- Tabla: public.expedientes
create table if not exists public.expedientes (
  id uuid primary key default gen_random_uuid(),
  expediente_codigo text not null,
  nombre text not null,
  created_by_supervisor_id uuid null references public.supervisores(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  deleted_by_supervisor_id uuid null references public.supervisores(id),
  deleted_geom_4326 geometry null,
  deleted_precision_m double precision null,
  deleted_reason text null
);
-- índices
create unique index if not exists expedientes_pkey on public.expedientes (id);
create index if not exists idx_expediente_codigo on public.expedientes (expediente_codigo);

-- Tabla: public.acciones
create table if not exists public.acciones (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes(id) on delete cascade,
  codigo_accion text not null,
  descripcion text null,
  fecha_inicio date not null,
  fecha_fin date not null,
  created_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  deleted_by_supervisor_id uuid null references public.supervisores(id),
  deleted_geom_4326 geometry null,
  deleted_precision_m double precision null,
  deleted_reason text null
);
-- índices/únicos
create unique index if not exists acciones_pkey on public.acciones (id);
create unique index if not exists unique_expediente_accion on public.acciones (expediente_id, codigo_accion);

-- Tabla: public.expediente_supervisores
create table if not exists public.expediente_supervisores (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null,
  supervisor_id uuid not null,
  fecha_asignacion date not null default current_date,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  deleted_by_supervisor_id uuid null,
  deleted_geom_4326 geometry null
);
-- índices/únicos
create unique index if not exists expediente_supervisores_pkey on public.expediente_supervisores (id);
create unique index if not exists expediente_supervisores_expediente_id_supervisor_id_key on public.expediente_supervisores (expediente_id, supervisor_id);
create unique index if not exists unique_asignacion on public.expediente_supervisores (expediente_id, supervisor_id);

-- Tabla: public.monitoreo_puntos
create table if not exists public.monitoreo_puntos (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null,
  locacion text not null,
  cod_celda text not null,
  cod_grilla text not null,
  este double precision not null,
  norte double precision not null,
  prof double precision null,
  p_superpos text null,
  cod_punto_campo text not null,
  cod_colectora text not null,
  distancia text null,
  geom geometry null,
  marcado_status public.status_trabajo not null default 'PENDIENTE',
  marcado_motivo text null,
  monitoreado_status public.status_trabajo not null default 'PENDIENTE',
  monitoreado_motivo text null,
  monitoreado_accion_id uuid null,
  monitoreado_at timestamptz null,
  estatus public.punto_estatus not null default 'PENDIENTE',
  captura_geom_4326 geometry null,
  captura_precision_m double precision null,
  captura_at timestamptz null,
  captura_fuente text null default 'MANUAL',
  tipo_origen text not null default 'ORIGINAL',
  parent_punto_id uuid null references public.monitoreo_puntos(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  deleted_by_supervisor_id uuid null,
  deleted_geom_4326 geometry null,
  deleted_precision_m double precision null,
  deleted_reason text null
);
-- índices/únicos (incl. espaciales)
create unique index if not exists monitoreo_puntos_pkey on public.monitoreo_puntos (id);
create unique index if not exists unique_por_expediente_cod_punto on public.monitoreo_puntos (expediente_id, cod_punto_campo);
create unique index if not exists unique_por_expediente_cod_colectora on public.monitoreo_puntos (expediente_id, cod_colectora);
create index if not exists idx_monitoreo_puntos_expediente_id on public.monitoreo_puntos (expediente_id);
create index if not exists idx_monitoreo_puntos_geom on public.monitoreo_puntos using gist (geom);
create index if not exists idx_monitoreo_puntos_captura_geom on public.monitoreo_puntos using gist (captura_geom_4326);
create index if not exists idx_monitoreo_puntos_estatus on public.monitoreo_puntos (estatus);
create index if not exists idx_monitoreo_puntos_marcado_status on public.monitoreo_puntos (marcado_status);
create index if not exists idx_monitoreo_puntos_monitoreado_status on public.monitoreo_puntos (monitoreado_status);
create index if not exists idx_monitoreo_puntos_is_deleted on public.monitoreo_puntos (is_deleted);
create index if not exists idx_monitoreo_puntos_tipo_origen on public.monitoreo_puntos (tipo_origen);

-- Tabla: public.auditoria_eventos
create table if not exists public.auditoria_eventos (
  id uuid primary key default gen_random_uuid(),
  tabla_afectada text not null,
  registro_id uuid not null,
  accion text not null,
  datos_anteriores jsonb null,
  datos_nuevos jsonb null,
  supervisor_id uuid null,
  timestamp_evento timestamptz not null default now(),
  ip_address inet null,
  user_agent text null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  deleted_by_supervisor_id uuid null,
  deleted_geom_4326 geometry null,
  constraint auditoria_eventos_pkey primary key (id),
  constraint auditoria_eventos_accion_check check (
    accion = any (array[
      'INSERT','UPDATE','SOFT_DELETE','RESTORE_SUPERVISOR','RESTORE_EXPEDIENTE','RESTORE_ACCION','RESTORE_MONITOREO_PUNTO'
    ])
  )
);
-- índice PK
create unique index if not exists auditoria_eventos_pkey on public.auditoria_eventos (id);
