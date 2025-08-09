/*
  Migration: Phase 08 alignment for avance_monitoreo
  Purpose: Align functions, RPCs, and RLS with specs while keeping 01/02/03 as mirror of live state.
  Note: This file is not applied automatically; adding to repo does NOT modify live Supabase.
*/

-- 1) Helper: fix f_default_accion_por_fecha to use date coverage instead of non-existent "activo"
create or replace function public.f_default_accion_por_fecha(expediente_id_param uuid, fecha_param date)
returns uuid
language sql
stable
security definer
as $$
  select a.id
  from public.acciones a
  where a.expediente_id = expediente_id_param
    and coalesce(a.is_deleted, false) = false
    and a.fecha_inicio is not null
    and (fecha_param >= a.fecha_inicio)
    and (a.fecha_fin is null or fecha_param <= a.fecha_fin)
  order by a.fecha_inicio asc, a.fecha_fin asc nulls last
  limit 1
$$;


-- 2) Tighten RLS INSERT policy on public.monitoreo_puntos to restrict tipo_origen for non-admin
-- Existing policy name confirmed: monitoreo_puntos_insert_policy
 drop policy if exists monitoreo_puntos_insert_policy on public.monitoreo_puntos;

create policy monitoreo_puntos_insert_policy
on public.monitoreo_puntos
as permissive
for insert
to public
with check (
  public.get_current_supervisor() is not null
  and (
    public.is_admin()
    or (
      expediente_id in (
        select es.expediente_id
        from public.expediente_supervisores es
        where es.supervisor_id = public.get_current_supervisor()
          and es.activo = true
          and es.deleted_at is null
      )
      and tipo_origen in ('REPLANTEO','ANADIDO')
    )
  )
);


-- 3) Schema additions: motivos for creation events (per spec) with CHECK constraint
-- These columns do not exist on live; we add them here as part of alignment, but file is not applied automatically.
alter table public.monitoreo_puntos
  add column if not exists replanteo_motivo text,
  add column if not exists anadido_motivo text;

-- Enforce exactly one motivo for each origin type
alter table public.monitoreo_puntos
  drop constraint if exists monitoreo_puntos_tipo_origen_motivo_chk;

alter table public.monitoreo_puntos
  add constraint monitoreo_puntos_tipo_origen_motivo_chk
  check (
    case
      when tipo_origen = 'REPLANTEO' then replanteo_motivo is not null and anadido_motivo is null
      when tipo_origen = 'ANADIDO' then anadido_motivo is not null and replanteo_motivo is null
      else replanteo_motivo is null and anadido_motivo is null
    end
  );


-- 4) RPCs: align crear_replanteo / crear_anadido with live schema and spec
-- Use captura_geom_4326 instead of non-existent geom_4326, remove punto_numero, persist motivos.
create or replace function public.rpc_crear_replanteo(
  p_expediente_id uuid,
  p_locacion text,
  p_motivo text,
  p_puntos_nuevos jsonb,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  current_supervisor_id uuid;
  puntos_existentes integer;
  puntos_nuevos_count integer;
  punto_record jsonb;
  puntos_insertados integer := 0;
  nuevo_punto_id uuid;
begin
  if not public.f_verificar_asignacion_expediente(p_expediente_id) then
    raise exception 'Acceso denegado: usuario no asignado al expediente o sin permisos suficientes';
  end if;

  current_supervisor_id := public.get_current_supervisor();
  if current_supervisor_id is null then
    raise exception 'No se pudo identificar al supervisor actual';
  end if;

  if p_expediente_id is null then raise exception 'expediente_id es requerido'; end if;
  if p_locacion is null or trim(p_locacion) = '' then raise exception 'locacion es requerida'; end if;
  if p_motivo is null or trim(p_motivo) = '' then raise exception 'motivo es requerido para replanteo'; end if;
  if p_puntos_nuevos is null or jsonb_array_length(p_puntos_nuevos) = 0 then
    raise exception 'puntos_nuevos es requerido y debe contener al menos un punto';
  end if;

  select count(*) into puntos_existentes
  from public.monitoreo_puntos
  where expediente_id = p_expediente_id and locacion = p_locacion and deleted_at is null;

  puntos_nuevos_count := jsonb_array_length(p_puntos_nuevos);

  if p_dry_run then
    return jsonb_build_object(
      'dry_run', true,
      'expediente_id', p_expediente_id,
      'locacion', p_locacion,
      'motivo', p_motivo,
      'puntos_existentes', puntos_existentes,
      'puntos_nuevos_count', puntos_nuevos_count
    );
  end if;

  for punto_record in
    select value from jsonb_array_elements(p_puntos_nuevos)
  loop
    -- require parent_punto_id for replanteo; codes validated by trigger f_enforce_replanteo_codes
    if (punto_record->>'parent_punto_id') is null then
      raise exception 'Cada elemento debe incluir parent_punto_id para REPLANTEO';
    end if;

    insert into public.monitoreo_puntos (
      expediente_id,
      locacion,
      cod_punto_campo,
      cod_colectora,
      captura_geom_4326,
      marcado_status,
      monitoreado_status,
      tipo_origen,
      parent_punto_id,
      replanteo_motivo,
      created_at,
      updated_at
    )
    values (
      p_expediente_id,
      p_locacion,
      nullif(punto_record->>'cod_punto_campo',''),
      nullif(punto_record->>'cod_colectora',''),
      st_geomfromgeojson(punto_record->>'captura_geom_4326'),
      'PENDIENTE'::status_trabajo,
      'PENDIENTE'::status_trabajo,
      'REPLANTEO',
      (punto_record->>'parent_punto_id')::uuid,
      p_motivo,
      now(),
      now()
    )
    returning id into nuevo_punto_id;

    puntos_insertados := puntos_insertados + 1;
  end loop;

  perform public.f_auditar_evento('CREAR_REPLANTEO', jsonb_build_object(
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'motivo', p_motivo,
    'puntos_existentes', puntos_existentes,
    'puntos_insertados', puntos_insertados,
    'supervisor_id', current_supervisor_id
  ));

  return jsonb_build_object(
    'success', true,
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'motivo', p_motivo,
    'puntos_existentes', puntos_existentes,
    'puntos_insertados', puntos_insertados
  );
end;
$$;

create or replace function public.rpc_crear_anadido(
  p_expediente_id uuid,
  p_locacion text,
  p_motivo text,
  p_puntos_nuevos jsonb,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  current_supervisor_id uuid;
  puntos_existentes integer;
  puntos_nuevos_count integer;
  punto_record jsonb;
  puntos_insertados integer := 0;
  nuevo_punto_id uuid;
begin
  if not public.f_verificar_asignacion_expediente(p_expediente_id) then
    raise exception 'Acceso denegado: usuario no asignado al expediente o sin permisos suficientes';
  end if;

  current_supervisor_id := public.get_current_supervisor();
  if current_supervisor_id is null then
    raise exception 'No se pudo identificar al supervisor actual';
  end if;

  if p_expediente_id is null then raise exception 'expediente_id es requerido'; end if;
  if p_locacion is null or trim(p_locacion) = '' then raise exception 'locacion es requerida'; end if;
  if p_motivo is null or trim(p_motivo) = '' then raise exception 'motivo es requerido para añadido'; end if;
  if p_puntos_nuevos is null or jsonb_array_length(p_puntos_nuevos) = 0 then
    raise exception 'puntos_nuevos es requerido y debe contener al menos un punto';
  end if;

  select count(*) into puntos_existentes
  from public.monitoreo_puntos
  where expediente_id = p_expediente_id and locacion = p_locacion and deleted_at is null;

  puntos_nuevos_count := jsonb_array_length(p_puntos_nuevos);

  if p_dry_run then
    return jsonb_build_object(
      'dry_run', true,
      'expediente_id', p_expediente_id,
      'locacion', p_locacion,
      'motivo', p_motivo,
      'puntos_existentes', puntos_existentes,
      'puntos_nuevos_count', puntos_nuevos_count
    );
  end if;

  for punto_record in
    select value from jsonb_array_elements(p_puntos_nuevos)
  loop
    if nullif(punto_record->>'cod_punto_campo','') is null
       or nullif(punto_record->>'cod_colectora','') is null then
      raise exception 'Cada elemento debe incluir cod_punto_campo y cod_colectora';
    end if;

    insert into public.monitoreo_puntos (
      expediente_id,
      locacion,
      cod_punto_campo,
      cod_colectora,
      captura_geom_4326,
      marcado_status,
      monitoreado_status,
      tipo_origen,
      anadido_motivo,
      created_at,
      updated_at
    )
    values (
      p_expediente_id,
      p_locacion,
      punto_record->>'cod_punto_campo',
      punto_record->>'cod_colectora',
      st_geomfromgeojson(punto_record->>'captura_geom_4326'),
      'PENDIENTE'::status_trabajo,
      'PENDIENTE'::status_trabajo,
      'ANADIDO',
      p_motivo,
      now(),
      now()
    )
    returning id into nuevo_punto_id;

    puntos_insertados := puntos_insertados + 1;
  end loop;

  perform public.f_auditar_evento('CREAR_ANADIDO', jsonb_build_object(
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'motivo', p_motivo,
    'puntos_existentes', puntos_existentes,
    'puntos_insertados', puntos_insertados,
    'supervisor_id', current_supervisor_id
  ));

  return jsonb_build_object(
    'success', true,
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'motivo', p_motivo,
    'puntos_existentes', puntos_existentes,
    'puntos_insertados', puntos_insertados
  );
end;
$$;


-- 5) Bulk update RPCs: correct supervisor checks (is_active=true and not deleted)
-- Replace only the permission blocks; bodies mirror live behavior.
create or replace function public.rpc_bulk_update_locacion_marcado(
  p_expediente_id uuid,
  p_locacion text,
  p_status status_trabajo,
  p_motivo text default null,
  p_only_unset boolean default true,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  current_supervisor_id uuid;
  total_puntos integer;
  puntos_afectados integer;
begin
  -- Updated supervisor check
  current_supervisor_id := public.get_current_supervisor();
  if current_supervisor_id is null or not exists (
    select 1 from public.supervisores s
    where s.id = current_supervisor_id and s.is_active = true and s.is_deleted = false
  ) then
    raise exception 'Acceso denegado: usuario no autorizado';
  end if;

  if p_expediente_id is null then
    raise exception 'expediente_id es requerido';
  end if;

  if p_locacion is null or trim(p_locacion) = '' then
    raise exception 'locacion es requerida';
  end if;

  if p_status = 'DESCARTADO' and (p_motivo is null or trim(p_motivo) = '') then
    raise exception 'Motivo es obligatorio cuando status es DESCARTADO';
  end if;

  select count(*) into total_puntos
  from public.monitoreo_puntos
  where expediente_id = p_expediente_id and locacion = p_locacion and deleted_at is null;

  if p_only_unset then
    select count(*) into puntos_afectados
    from public.monitoreo_puntos
    where expediente_id = p_expediente_id and locacion = p_locacion and deleted_at is null
      and marcado_status = 'PENDIENTE';
  else
    puntos_afectados := total_puntos;
  end if;

  if p_dry_run then
    return jsonb_build_object(
      'dry_run', true,
      'total_puntos', total_puntos,
      'puntos_afectados', puntos_afectados,
      'expediente_id', p_expediente_id,
      'locacion', p_locacion,
      'nuevo_status', p_status,
      'motivo', p_motivo
    );
  end if;

  if p_only_unset then
    update public.monitoreo_puntos set
      marcado_status = p_status,
      marcado_motivo = case when p_status = 'DESCARTADO' then p_motivo else null end,
      marcado_at = case when p_status = 'HECHO' then now() else marcado_at end,
      updated_at = now()
    where expediente_id = p_expediente_id and locacion = p_locacion and deleted_at is null
      and marcado_status = 'PENDIENTE';
  else
    update public.monitoreo_puntos set
      marcado_status = p_status,
      marcado_motivo = case when p_status = 'DESCARTADO' then p_motivo else null end,
      marcado_at = case when p_status = 'HECHO' then now() else marcado_at end,
      updated_at = now()
    where expediente_id = p_expediente_id and locacion = p_locacion and deleted_at is null;
  end if;

  get diagnostics puntos_afectados = row_count;

  perform public.f_auditar_evento('BULK_UPDATE_MARCADO', jsonb_build_object(
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'status', p_status,
    'motivo', p_motivo,
    'only_unset', p_only_unset,
    'puntos_afectados', puntos_afectados,
    'supervisor_id', current_supervisor_id
  ));

  return jsonb_build_object(
    'success', true,
    'total_puntos', total_puntos,
    'puntos_afectados', puntos_afectados,
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'nuevo_status', p_status,
    'motivo', p_motivo
  );
end;
$$;

create or replace function public.rpc_bulk_update_locacion_monitoreo(
  p_expediente_id uuid,
  p_locacion text,
  p_status status_trabajo,
  p_accion_id uuid default null,
  p_motivo text default null,
  p_only_unset boolean default true,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  current_supervisor_id uuid;
  total_puntos integer;
  puntos_afectados integer;
  auto_accion_id uuid;
begin
  -- Updated supervisor check
  current_supervisor_id := public.get_current_supervisor();
  if current_supervisor_id is null or not exists (
    select 1 from public.supervisores s
    where s.id = current_supervisor_id and s.is_active = true and s.is_deleted = false
  ) then
    raise exception 'Acceso denegado: usuario no autorizado';
  end if;

  if p_expediente_id is null then
    raise exception 'expediente_id es requerido';
  end if;

  if p_locacion is null or trim(p_locacion) = '' then
    raise exception 'locacion es requerida';
  end if;

  if p_status = 'DESCARTADO' and (p_motivo is null or trim(p_motivo) = '') then
    raise exception 'Motivo es obligatorio cuando status es DESCARTADO';
  end if;

  if p_status = 'HECHO' and p_accion_id is null then
    auto_accion_id := public.f_default_accion_por_fecha(p_expediente_id, current_date);
  else
    auto_accion_id := p_accion_id;
  end if;

  select count(*) into total_puntos
  from public.monitoreo_puntos
  where expediente_id = p_expediente_id and locacion = p_locacion and deleted_at is null;

  if p_only_unset then
    select count(*) into puntos_afectados
    from public.monitoreo_puntos
    where expediente_id = p_expediente_id and locacion = p_locacion and deleted_at is null
      and monitoreado_status = 'PENDIENTE';
  else
    puntos_afectados := total_puntos;
  end if;

  if p_dry_run then
    return jsonb_build_object(
      'dry_run', true,
      'total_puntos', total_puntos,
      'puntos_afectados', puntos_afectados,
      'expediente_id', p_expediente_id,
      'locacion', p_locacion,
      'nuevo_status', p_status,
      'accion_id', auto_accion_id,
      'motivo', p_motivo
    );
  end if;

  if p_only_unset then
    update public.monitoreo_puntos set
      monitoreado_status = p_status,
      monitoreado_accion_id = case when p_status = 'HECHO' then auto_accion_id else monitoreado_accion_id end,
      monitoreado_motivo = case when p_status = 'DESCARTADO' then p_motivo else null end,
      monitoreado_at = case when p_status = 'HECHO' then now() else monitoreado_at end,
      updated_at = now()
    where expediente_id = p_expediente_id and locacion = p_locacion and deleted_at is null
      and monitoreado_status = 'PENDIENTE';
  else
    update public.monitoreo_puntos set
      monitoreado_status = p_status,
      monitoreado_accion_id = case when p_status = 'HECHO' then auto_accion_id else monitoreado_accion_id end,
      monitoreado_motivo = case when p_status = 'DESCARTADO' then p_motivo else null end,
      monitoreado_at = case when p_status = 'HECHO' then now() else monitoreado_at end,
      updated_at = now()
    where expediente_id = p_expediente_id and locacion = p_locacion and deleted_at is null;
  end if;

  get diagnostics puntos_afectados = row_count;

  perform public.f_auditar_evento('BULK_UPDATE_MONITOREO', jsonb_build_object(
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'status', p_status,
    'accion_id', auto_accion_id,
    'motivo', p_motivo,
    'only_unset', p_only_unset,
    'puntos_afectados', puntos_afectados,
    'supervisor_id', current_supervisor_id
  ));

  return jsonb_build_object(
    'success', true,
    'total_puntos', total_puntos,
    'puntos_afectados', puntos_afectados,
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'nuevo_status', p_status,
    'accion_id', auto_accion_id,
    'motivo', p_motivo
  );
end;
$$;
