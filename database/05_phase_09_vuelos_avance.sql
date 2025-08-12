-- 05_phase_09_vuelos_avance.sql
-- Objetivo: Implementar tabla vuelos_items, RLS, triggers y RPCs de avance (marcado/volado) y soft delete/restore.
-- Fuente de verdad: specs en specs_app.yaml (NO MODIFICAR EL SPEC).

begin;
set local search_path = public;
set local check_function_bodies = off;

-- =============================
-- Enum updates
-- =============================
-- Asegurar que vuelo_tipo incluya 'CHECKPOINT'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'vuelo_tipo') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'vuelo_tipo' AND e.enumlabel = 'CHECKPOINT'
    ) THEN
      ALTER TYPE public.vuelo_tipo ADD VALUE 'CHECKPOINT';
    END IF;
  ELSE
    CREATE TYPE public.vuelo_tipo AS ENUM ('PAF','PD','CHECKPOINT');
  END IF;
END$$;

-- =============================
-- Tabla: public.vuelos_items
-- =============================
create table if not exists public.vuelos_items (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes(id) on delete cascade,
  item integer not null,
  tipo public.vuelo_tipo not null,
  codigo text not null,
  este double precision not null,
  norte double precision not null,
  base text null,
  geom geometry(Point, 32717) null,
  marcado_status public.status_trabajo not null default 'PENDIENTE',
  marcado_motivo text null,
  volado_status public.status_trabajo not null default 'PENDIENTE',
  volado_motivo text null,
  captura_geom_4326 geometry(Point, 4326) null,
  captura_precision_m double precision null,
  captura_at timestamptz null,
  captura_fuente text null default 'MANUAL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz null,
  deleted_by_supervisor_id uuid null references public.supervisores(id),
  deleted_geom_4326 geometry(Point, 4326) null,
  deleted_precision_m double precision null,
  deleted_reason text null,
  constraint chk_marcado_motivo_descartado check (
    marcado_status <> 'DESCARTADO' OR (marcado_motivo is not null and length(trim(marcado_motivo)) > 0)
  ),
  constraint chk_volado_motivo_descartado check (
    volado_status <> 'DESCARTADO' OR (volado_motivo is not null and length(trim(volado_motivo)) > 0)
  )
);

comment on table public.vuelos_items is 'TABLA DE VUELO (Excel de items PAF/PD) y avance de marcado/volado. Campos de captura opcionales para registrar ubicación del dispositivo. Soft delete habilitado.';

-- Constraints/índices
create unique index if not exists vuelos_items_pkey on public.vuelos_items (id);
create unique index if not exists unique_por_expediente_codigo on public.vuelos_items (expediente_id, codigo);
create index if not exists idx_vuelos_expediente on public.vuelos_items (expediente_id);
create index if not exists idx_vuelos_geom on public.vuelos_items using gist (geom);

-- =============================
-- RLS
-- =============================
alter table if exists public.vuelos_items enable row level security;

-- Limpieza de políticas previas si existieran
drop policy if exists vuelos_items_select_policy on public.vuelos_items;
drop policy if exists vuelos_items_insert_policy on public.vuelos_items;
drop policy if exists vuelos_items_update_policy on public.vuelos_items;
drop policy if exists vuelos_items_delete_policy on public.vuelos_items;

-- SELECT: asignados al expediente o ADMIN; no_ADMIN solo is_deleted=false
create policy vuelos_items_select_policy on public.vuelos_items
  for select to public
  using (
    (public.get_current_supervisor() is not null)
    and (
      public.is_admin() or (
        expediente_id in (
          select es.expediente_id
          from public.expediente_supervisores es
          where es.supervisor_id = public.get_current_supervisor()
            and es.activo = true
            and es.deleted_at is null
        )
      )
    )
    and (is_deleted = false)
  );

-- INSERT: solo ADMIN (importación)
create policy vuelos_items_insert_policy on public.vuelos_items
  for insert to public
  with check (public.is_admin());

-- UPDATE: asignados al expediente o ADMIN; restricciones de columnas se validan por trigger
create policy vuelos_items_update_policy on public.vuelos_items
  for update to public
  using (
    (public.get_current_supervisor() is not null)
    and (
      public.is_admin() or (
        expediente_id in (
          select es.expediente_id
          from public.expediente_supervisores es
          where es.supervisor_id = public.get_current_supervisor()
            and es.activo = true
            and es.deleted_at is null
        )
      )
    )
    and (is_deleted = false)
  );

-- DELETE: deshabilitado (usar soft delete vía RPC)
create policy vuelos_items_delete_policy on public.vuelos_items
  for delete to public
  using (false);

-- =============================
-- Triggers
-- =============================
-- Actualizar updated_at
create or replace function public.f_update_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

-- Setear geom desde este/norte (UTM 17S)
create or replace function public.f_set_point_geom()
returns trigger language plpgsql as $$
begin
  if new.este is not null and new.norte is not null then
    new.geom := st_setsrid(st_makepoint(new.este, new.norte), 32717);
  end if;
  return new;
end$$;

-- Enforce columnas permitidas en UPDATE para no-ADMIN
create or replace function public.f_enforce_vuelos_update_columns()
returns trigger language plpgsql as $$
begin
  if not public.is_admin() then
    -- Solo permitir cambios en marcado_*, volado_* y campos de captura
    if (coalesce(new.item, old.item) <> old.item) or
       (coalesce(new.tipo, old.tipo) <> old.tipo) or
       (coalesce(new.codigo, old.codigo) <> old.codigo) or
       (coalesce(new.este, old.este) <> old.este) or
       (coalesce(new.norte, old.norte) <> old.norte) or
       (coalesce(new.base, old.base) <> old.base) or
       (coalesce(new.geom, old.geom) is distinct from old.geom) or
       (coalesce(new.created_at, old.created_at) <> old.created_at) or
       (coalesce(new.is_deleted, old.is_deleted) <> old.is_deleted) or
       (coalesce(new.deleted_at, old.deleted_at) is distinct from old.deleted_at) or
       (coalesce(new.deleted_by_supervisor_id, old.deleted_by_supervisor_id) is distinct from old.deleted_by_supervisor_id) or
       (coalesce(new.deleted_geom_4326, old.deleted_geom_4326) is distinct from old.deleted_geom_4326) or
       (coalesce(new.deleted_precision_m, old.deleted_precision_m) is distinct from old.deleted_precision_m) or
       (coalesce(new.deleted_reason, old.deleted_reason) is distinct from old.deleted_reason)
    then
      raise exception 'No autorizado a modificar columnas fuera de avance/captura en vuelos_items';
    end if;
  end if;
  return new;
end$$;

-- Crear triggers si no existen
-- Nota: PostgreSQL no soporta IF NOT EXISTS para CREATE TRIGGER; usar nombres determinísticos y DROP antes
DROP TRIGGER IF EXISTS trg_vuelos_items_set_geom ON public.vuelos_items;
CREATE TRIGGER trg_vuelos_items_set_geom
BEFORE INSERT OR UPDATE ON public.vuelos_items
FOR EACH ROW EXECUTE FUNCTION public.f_set_point_geom();

DROP TRIGGER IF EXISTS trg_vuelos_items_update_ts ON public.vuelos_items;
CREATE TRIGGER trg_vuelos_items_update_ts
BEFORE INSERT OR UPDATE ON public.vuelos_items
FOR EACH ROW EXECUTE FUNCTION public.f_update_timestamp();

DROP TRIGGER IF EXISTS trg_vuelos_items_enforce_update ON public.vuelos_items;
CREATE TRIGGER trg_vuelos_items_enforce_update
BEFORE UPDATE ON public.vuelos_items
FOR EACH ROW EXECUTE FUNCTION public.f_enforce_vuelos_update_columns();

DROP TRIGGER IF EXISTS trg_vuelos_items_block_delete ON public.vuelos_items;
CREATE TRIGGER trg_vuelos_items_block_delete
BEFORE DELETE ON public.vuelos_items
FOR EACH ROW EXECUTE FUNCTION public.f_block_hard_delete();

-- Auditar cambios de avance/captura aunque no pasen por RPC
create or replace function public.f_audit_vuelos_items_avance()
returns trigger language plpgsql as $$
begin
  if (new.marcado_status is distinct from old.marcado_status)
     or (new.marcado_motivo is distinct from old.marcado_motivo) then
    perform public.f_auditar_evento('VUELO_MARCADO_UPDATE', jsonb_build_object(
      'vuelo_id', new.id,
      'old', jsonb_build_object('status', old.marcado_status, 'motivo', old.marcado_motivo),
      'new', jsonb_build_object('status', new.marcado_status, 'motivo', new.marcado_motivo)
    ));
  end if;

  if (new.volado_status is distinct from old.volado_status)
     or (new.volado_motivo is distinct from old.volado_motivo) then
    perform public.f_auditar_evento('VUELO_VOLADO_UPDATE', jsonb_build_object(
      'vuelo_id', new.id,
      'old', jsonb_build_object('status', old.volado_status, 'motivo', old.volado_motivo),
      'new', jsonb_build_object('status', new.volado_status, 'motivo', new.volado_motivo)
    ));
  end if;

  if (new.captura_geom_4326 is distinct from old.captura_geom_4326)
     or (new.captura_precision_m is distinct from old.captura_precision_m)
     or (new.captura_at is distinct from old.captura_at)
     or (new.captura_fuente is distinct from old.captura_fuente) then
    perform public.f_auditar_evento('VUELO_CAPTURA_UPDATE', jsonb_build_object(
      'vuelo_id', new.id
    ));
  end if;

  return new;
end$$;

DROP TRIGGER IF EXISTS trg_vuelos_items_audit_avance ON public.vuelos_items;
CREATE TRIGGER trg_vuelos_items_audit_avance
AFTER UPDATE OF marcado_status, marcado_motivo, volado_status, volado_motivo, captura_geom_4326, captura_precision_m, captura_at, captura_fuente ON public.vuelos_items
FOR EACH ROW EXECUTE FUNCTION public.f_audit_vuelos_items_avance();

-- =============================
-- RPCs de avance y soft delete/restore
-- =============================

-- rpc_set_vuelo_marcado: actualizar marcado_status/motivo y opcional captura
create or replace function public.rpc_set_vuelo_marcado(
  p_vuelo_id uuid,
  p_status public.status_trabajo,
  p_motivo text default null,
  p_captura_geom geometry(Point, 4326) default null,
  p_captura_precision double precision default null,
  p_captura_fuente text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_expediente_id uuid;
begin
  if p_vuelo_id is null then
    raise exception 'vuelo_id es requerido';
  end if;

  if p_status = 'DESCARTADO' and (p_motivo is null or trim(p_motivo) = '') then
    raise exception 'Motivo es obligatorio cuando status es DESCARTADO';
  end if;

  select expediente_id into v_expediente_id from public.vuelos_items where id = p_vuelo_id and is_deleted = false;
  if v_expediente_id is null then
    raise exception 'Vuelo item no encontrado';
  end if;

  if not (public.is_admin() or public.f_verificar_asignacion_expediente(v_expediente_id)) then
    raise exception 'Acceso denegado: no asignado al expediente';
  end if;

  update public.vuelos_items set
    marcado_status = p_status,
    marcado_motivo = case when p_status = 'DESCARTADO' then p_motivo else null end,
    captura_geom_4326 = coalesce(p_captura_geom, captura_geom_4326),
    captura_precision_m = coalesce(p_captura_precision, captura_precision_m),
    captura_fuente = coalesce(p_captura_fuente, captura_fuente),
    captura_at = case when p_captura_geom is not null then now() else captura_at end,
    updated_at = now()
  where id = p_vuelo_id;

  perform public.f_auditar_evento('VUELO_SET_MARCADO', jsonb_build_object(
    'vuelo_id', p_vuelo_id,
    'status', p_status,
    'motivo', p_motivo
  ));

  return jsonb_build_object('success', true);
end$$;

-- rpc_set_vuelo_volado: actualizar volado_status/motivo y opcional captura
create or replace function public.rpc_set_vuelo_volado(
  p_vuelo_id uuid,
  p_status public.status_trabajo,
  p_motivo text default null,
  p_captura_geom geometry(Point, 4326) default null,
  p_captura_precision double precision default null,
  p_captura_fuente text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_expediente_id uuid;
begin
  if p_vuelo_id is null then
    raise exception 'vuelo_id es requerido';
  end if;

  if p_status = 'DESCARTADO' and (p_motivo is null or trim(p_motivo) = '') then
    raise exception 'Motivo es obligatorio cuando status es DESCARTADO';
  end if;

  select expediente_id into v_expediente_id from public.vuelos_items where id = p_vuelo_id and is_deleted = false;
  if v_expediente_id is null then
    raise exception 'Vuelo item no encontrado';
  end if;

  if not (public.is_admin() or public.f_verificar_asignacion_expediente(v_expediente_id)) then
    raise exception 'Acceso denegado: no asignado al expediente';
  end if;

  update public.vuelos_items set
    volado_status = p_status,
    volado_motivo = case when p_status = 'DESCARTADO' then p_motivo else null end,
    captura_geom_4326 = coalesce(p_captura_geom, captura_geom_4326),
    captura_precision_m = coalesce(p_captura_precision, captura_precision_m),
    captura_fuente = coalesce(p_captura_fuente, captura_fuente),
    captura_at = case when p_captura_geom is not null then now() else captura_at end,
    updated_at = now()
  where id = p_vuelo_id;

  perform public.f_auditar_evento('VUELO_SET_VOLADO', jsonb_build_object(
    'vuelo_id', p_vuelo_id,
    'status', p_status,
    'motivo', p_motivo
  ));

  return jsonb_build_object('success', true);
end$$;

-- rpc_soft_delete_vuelo_item
create or replace function public.rpc_soft_delete_vuelo_item(
  id_param uuid,
  geom4326_param geometry(Point, 4326),
  precision_m_param double precision,
  reason_param text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  supervisor_actual_id uuid;
  affected_rows integer;
begin
  if not public.is_admin() then
    raise exception 'Solo usuarios ADMIN pueden eliminar items de vuelo';
  end if;

  supervisor_actual_id := public.get_current_supervisor();

  update public.vuelos_items set
    is_deleted = true,
    deleted_at = now(),
    deleted_by_supervisor_id = supervisor_actual_id,
    deleted_geom_4326 = geom4326_param,
    deleted_precision_m = precision_m_param,
    deleted_reason = reason_param,
    updated_at = now()
  where id = id_param and is_deleted = false;

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    raise exception 'Item de vuelo no encontrado o ya eliminado';
  end if;

  perform public.f_auditar_evento('SOFT_DELETE_VUELO_ITEM', jsonb_build_object(
    'vuelo_id', id_param,
    'reason', reason_param
  ));

  return jsonb_build_object('success', true, 'message', 'Item de vuelo eliminado correctamente');
end$$;

-- rpc_restore_vuelo_item
create or replace function public.rpc_restore_vuelo_item(
  id_param uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  affected_rows integer;
begin
  if not public.is_admin() then
    raise exception 'Solo usuarios ADMIN pueden restaurar items de vuelo';
  end if;

  update public.vuelos_items set
    is_deleted = false,
    deleted_at = null,
    deleted_by_supervisor_id = null,
    deleted_geom_4326 = null,
    deleted_precision_m = null,
    deleted_reason = null,
    updated_at = now()
  where id = id_param;

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    raise exception 'Item de vuelo no encontrado';
  end if;

  perform public.f_auditar_evento('RESTORE_VUELO_ITEM', jsonb_build_object('vuelo_id', id_param));

  return jsonb_build_object('success', true, 'message', 'Item de vuelo restaurado correctamente');
end$$;

commit;
