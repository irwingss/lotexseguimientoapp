-- 03_functions_and_triggers.sql
-- Functions (helpers, triggers, RPCs) and trigger creation mirrored from live Supabase (iklzduuotmrzqxzdcfji)
-- NOTE: Some live functions reference columns/objects that may not be present locally. We disable body checks to allow creation for fidelity.

begin;
set local search_path = public;
set local check_function_bodies = off;

-- =============================
-- Helper and Trigger Functions
-- =============================

-- get_current_supervisor
create or replace function public.get_current_supervisor()
returns uuid
language sql
security definer
as $function$
  select id from public.supervisores 
  where email = (auth.jwt() ->> 'email')::citext 
  and is_active = true 
  and is_deleted = false;
$function$;

-- get_supervisor_id
create or replace function public.get_supervisor_id(p_email text)
returns uuid
language plpgsql
stable security definer
as $function$
declare
  v_supervisor_id uuid;
begin
  select id into v_supervisor_id
  from public.supervisores
  where email = p_email
  and is_active = true
  and is_deleted = false;
  
  return v_supervisor_id;
end;
$function$;

-- is_admin
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
as $function$
begin
  return exists (
    select 1 from public.supervisores s
    where s.email = (auth.jwt() ->> 'email')::citext
      and s.permisos_sistema = 'ADMIN'
      and coalesce(s.is_deleted, false) = false
  );
end;
$function$;

-- f_verificar_asignacion_expediente
create or replace function public.f_verificar_asignacion_expediente(p_expediente_id uuid)
returns boolean
language sql
security definer
as $function$
  select exists (
    select 1 
    from public.expediente_supervisores es
    join public.supervisores s on es.supervisor_id = s.id
    where es.expediente_id = p_expediente_id
      and s.email = (auth.jwt() ->> 'email')::citext
      and s.is_active = true 
      and s.deleted_at is null
      and es.deleted_at is null
      and es.activo = true
      and (
        s.permisos_sistema = 'ADMIN' or 
        s.rol in ('SUPERVISOR', 'MONITOR', 'SUPERVISOR_LIDER')
      )
  );
$function$;

-- f_auditar_evento
create or replace function public.f_auditar_evento(evento_param text, detalle_param jsonb default null)
returns uuid
language plpgsql
security definer
as $function$
declare
  supervisor_id_actual uuid;
  evento_id uuid;
begin
  -- Get current supervisor ID
  supervisor_id_actual := public.get_current_supervisor();
  
  if supervisor_id_actual is null then
    raise exception 'Usuario no autorizado para auditoría';
  end if;
  
  -- Insert audit event
  insert into public.auditoria_eventos (
    tabla_afectada,
    registro_id,
    accion,
    datos_nuevos,
    supervisor_id,
    ip_address,
    user_agent
  ) values (
    'SISTEMA',
    gen_random_uuid(),
    evento_param,
    detalle_param,
    supervisor_id_actual,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  ) returning id into evento_id;
  
  return evento_id;
end;
$function$;

-- f_block_hard_delete
create or replace function public.f_block_hard_delete()
returns trigger
language plpgsql
as $function$
begin
  raise exception 'DELETE físico bloqueado. Use soft delete vía RPC para tabla: %', tg_table_name;
  return null;
end;
$function$;

-- f_update_timestamp
create or replace function public.f_update_timestamp()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- f_set_point_geom
create or replace function public.f_set_point_geom()
returns trigger
language plpgsql
as $function$
begin
  -- Derivar geometría UTM 17S (SRID 32717) desde coordenadas este/norte
  new.geom := st_setsrid(st_makepoint(new.este, new.norte), 32717);
  return new;
end;
$function$;

-- f_enforce_replanteo_codes
create or replace function public.f_enforce_replanteo_codes()
returns trigger
language plpgsql
as $function$
declare
  parent_cod_punto text;
  parent_cod_colectora text;
begin
  -- Si tipo_origen=REPLANTEO: exigir parent_punto_id no nulo y validar códigos
  if new.tipo_origen = 'REPLANTEO' then
    -- Verificar que parent_punto_id no sea nulo
    if new.parent_punto_id is null then
      raise exception 'Para tipo_origen=REPLANTEO, parent_punto_id no puede ser nulo';
    end if;

    -- Obtener códigos del punto padre
    select cod_punto_campo, cod_colectora 
    into parent_cod_punto, parent_cod_colectora
    from public.monitoreo_puntos 
    where id = new.parent_punto_id;

    if not found then
      raise exception 'parent_punto_id % no existe', new.parent_punto_id;
    end if;

    -- Validar que cod_punto_campo = parent_cod_punto || 'R'
    if new.cod_punto_campo != parent_cod_punto || 'R' then
      raise exception 'Para REPLANTEO, cod_punto_campo debe ser % pero es %', 
        parent_cod_punto || 'R', new.cod_punto_campo;
    end if;

    -- Validar que cod_colectora = parent_cod_colectora || 'R'
    if new.cod_colectora != parent_cod_colectora || 'R' then
      raise exception 'Para REPLANTEO, cod_colectora debe ser % pero es %', 
        parent_cod_colectora || 'R', new.cod_colectora;
    end if;
  end if;

  return new;
end;
$function$;

-- f_update_estatus_punto
create or replace function public.f_update_estatus_punto()
returns trigger
language plpgsql
as $function$
begin
  -- Calcular estatus en base a marcado_status, monitoreado_status y tipo_origen
  if new.tipo_origen = 'REPLANTEO' then
    new.estatus := 'REPLANTEADO';
  elsif new.tipo_origen = 'ANADIDO' then
    new.estatus := 'ANADIDO';
  elsif new.marcado_status = 'DESCARTADO' or new.monitoreado_status = 'DESCARTADO' then
    new.estatus := 'DESCARTADO';
  elsif new.marcado_status = 'HECHO' and new.monitoreado_status = 'HECHO' then
    new.estatus := 'MARCADO_Y_MONITOREADO';
  elsif new.marcado_status = 'HECHO' then
    new.estatus := 'MARCADO';
  elsif new.monitoreado_status = 'HECHO' then
    new.estatus := 'MONITOREADO';
  else
    new.estatus := 'PENDIENTE';
  end if;

  -- Si hay transición a monitoreado_status=HECHO: set monitoreado_at=now()
  if new.monitoreado_status = 'HECHO' and (old is null or old.monitoreado_status != 'HECHO') then
    new.monitoreado_at := now();

    -- Si monitoreado_accion_id es null, asignar acción por defecto
    if new.monitoreado_accion_id is null then
      new.monitoreado_accion_id := f_default_accion_por_fecha(new.expediente_id, current_date);
    end if;
  end if;

  return new;
end;
$function$;

-- f_default_accion_por_fecha (live references a non-existent column 'activo')
create or replace function public.f_default_accion_por_fecha(expediente_id_param uuid, fecha_param date)
returns uuid
language sql
stable security definer
as $function$
  select id from public.acciones 
  where expediente_id = expediente_id_param 
  and activo = true 
  and deleted_at is null
  order by created_at asc 
  limit 1;
$function$;

-- ==========
-- RPCs (live)
-- ==========

-- rpc_bulk_update_locacion_marcado
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
as $function$
declare
  current_supervisor_id uuid;
  total_puntos integer;
  puntos_afectados integer;
begin
  -- Verificar que el usuario tiene permisos
  if not exists (
    select 1 from public.supervisores 
    where email = (auth.jwt() ->> 'email')::citext
    and activo = true 
    and deleted_at is null
  ) then
    raise exception 'Acceso denegado: usuario no autorizado';
  end if;

  -- Obtener ID del supervisor actual
  current_supervisor_id := public.get_current_supervisor();
  
  if current_supervisor_id is null then
    raise exception 'No se pudo identificar al supervisor actual';
  end if;

  -- Validar parámetros
  if p_expediente_id is null then
    raise exception 'expediente_id es requerido';
  end if;

  if p_locacion is null or trim(p_locacion) = '' then
    raise exception 'locacion es requerida';
  end if;

  -- Si status es DESCARTADO, motivo es obligatorio
  if p_status = 'DESCARTADO' and (p_motivo is null or trim(p_motivo) = '') then
    raise exception 'Motivo es obligatorio cuando status es DESCARTADO';
  end if;

  -- Contar total de puntos en la locación
  select count(*) into total_puntos
  from public.monitoreo_puntos
  where expediente_id = p_expediente_id 
    and locacion = p_locacion 
    and deleted_at is null;

  -- Contar puntos que serán afectados
  if p_only_unset then
    select count(*) into puntos_afectados
    from public.monitoreo_puntos
    where expediente_id = p_expediente_id 
      and locacion = p_locacion 
      and deleted_at is null
      and marcado_status = 'PENDIENTE';
  else
    puntos_afectados := total_puntos;
  end if;

  -- Si es dry_run, solo retornar conteos
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

  -- Realizar la actualización masiva
  if p_only_unset then
    update public.monitoreo_puntos set
      marcado_status = p_status,
      marcado_motivo = case when p_status = 'DESCARTADO' then p_motivo else null end,
      marcado_at = case when p_status = 'HECHO' then now() else marcado_at end,
      updated_at = now()
    where expediente_id = p_expediente_id 
      and locacion = p_locacion 
      and deleted_at is null
      and marcado_status = 'PENDIENTE';
  else
    update public.monitoreo_puntos set
      marcado_status = p_status,
      marcado_motivo = case when p_status = 'DESCARTADO' then p_motivo else null end,
      marcado_at = case when p_status = 'HECHO' then now() else marcado_at end,
      updated_at = now()
    where expediente_id = p_expediente_id 
      and locacion = p_locacion 
      and deleted_at is null;
  end if;

  get diagnostics puntos_afectados = row_count;

  -- Auditar la operación usando función existente
  perform public.f_auditar_evento('BULK_UPDATE_MARCADO', jsonb_build_object(
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'status', p_status,
    'motivo', p_motivo,
    'only_unset', p_only_unset,
    'puntos_afectados', puntos_afectados,
    'supervisor_id', current_supervisor_id
  ));

  -- Retornar resultado
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
$function$;

-- rpc_bulk_update_locacion_monitoreo
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
as $function$
declare
  current_supervisor_id uuid;
  total_puntos integer;
  puntos_afectados integer;
  auto_accion_id uuid;
begin
  -- Verificar que el usuario tiene permisos
  if not exists (
    select 1 from public.supervisores 
    where email = (auth.jwt() ->> 'email')::citext
    and activo = true 
    and deleted_at is null
  ) then
    raise exception 'Acceso denegado: usuario no autorizado';
  end if;

  -- Obtener ID del supervisor actual
  current_supervisor_id := public.get_current_supervisor();
  
  if current_supervisor_id is null then
    raise exception 'No se pudo identificar al supervisor actual';
  end if;

  -- Validar parámetros
  if p_expediente_id is null then
    raise exception 'expediente_id es requerido';
  end if;

  if p_locacion is null or trim(p_locacion) = '' then
    raise exception 'locacion es requerida';
  end if;

  -- Si status es DESCARTADO, motivo es obligatorio
  if p_status = 'DESCARTADO' and (p_motivo is null or trim(p_motivo) = '') then
    raise exception 'Motivo es obligatorio cuando status es DESCARTADO';
  end if;

  -- Si status es HECHO y no hay accion_id, auto-asignar por fecha usando función existente
  if p_status = 'HECHO' and p_accion_id is null then
    auto_accion_id := public.f_default_accion_por_fecha(p_expediente_id, current_date);
  else
    auto_accion_id := p_accion_id;
  end if;

  -- Contar total de puntos en la locación
  select count(*) into total_puntos
  from public.monitoreo_puntos
  where expediente_id = p_expediente_id 
    and locacion = p_locacion 
    and deleted_at is null;

  -- Contar puntos que serán afectados
  if p_only_unset then
    select count(*) into puntos_afectados
    from public.monitoreo_puntos
    where expediente_id = p_expediente_id 
      and locacion = p_locacion 
      and deleted_at is null
      and monitoreado_status = 'PENDIENTE';
  else
    puntos_afectados := total_puntos;
  end if;

  -- Si es dry_run, solo retornar conteos
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

  -- Realizar la actualización masiva
  if p_only_unset then
    update public.monitoreo_puntos set
      monitoreado_status = p_status,
      monitoreado_accion_id = case when p_status = 'HECHO' then auto_accion_id else monitoreado_accion_id end,
      monitoreado_motivo = case when p_status = 'DESCARTADO' then p_motivo else null end,
      monitoreado_at = case when p_status = 'HECHO' then now() else monitoreado_at end,
      updated_at = now()
    where expediente_id = p_expediente_id 
      and locacion = p_locacion 
      and deleted_at is null
      and monitoreado_status = 'PENDIENTE';
  else
    update public.monitoreo_puntos set
      monitoreado_status = p_status,
      monitoreado_accion_id = case when p_status = 'HECHO' then auto_accion_id else monitoreado_accion_id end,
      monitoreado_motivo = case when p_status = 'DESCARTADO' then p_motivo else null end,
      monitoreado_at = case when p_status = 'HECHO' then now() else monitoreado_at end,
      updated_at = now()
    where expediente_id = p_expediente_id 
      and locacion = p_locacion 
      and deleted_at is null;
  end if;

  get diagnostics puntos_afectados = row_count;

  -- Auditar la operación usando función existente
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

  -- Retornar resultado
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
$function$;

-- rpc_crear_anadido
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
as $function$
declare
  current_supervisor_id uuid;
  puntos_existentes integer;
  puntos_nuevos_count integer;
  punto_record record;
  nuevo_punto_id uuid;
  puntos_insertados integer := 0;
begin
  -- Verificar que el usuario tiene permisos según el spec actualizado
  if not public.f_verificar_asignacion_expediente(p_expediente_id) then
    raise exception 'Acceso denegado: usuario no asignado al expediente o sin permisos suficientes (requiere SUPERVISOR/MONITOR/SUPERVISOR_LIDER/ADMIN)';
  end if;

  -- Obtener ID del supervisor actual
  current_supervisor_id := public.get_current_supervisor();
  
  if current_supervisor_id is null then
    raise exception 'No se pudo identificar al supervisor actual';
  end if;

  -- Validar parámetros
  if p_expediente_id is null then
    raise exception 'expediente_id es requerido';
  end if;

  if p_locacion is null or trim(p_locacion) = '' then
    raise exception 'locacion es requerida';
  end if;

  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'motivo es requerido para añadido';
  end if;

  if p_puntos_nuevos is null or jsonb_array_length(p_puntos_nuevos) = 0 then
    raise exception 'puntos_nuevos es requerido y debe contener al menos un punto';
  end if;

  -- Contar puntos existentes en la locación
  select count(*) into puntos_existentes
  from public.monitoreo_puntos
  where expediente_id = p_expediente_id 
    and locacion = p_locacion 
    and deleted_at is null;

  -- Contar puntos nuevos a insertar
  puntos_nuevos_count := jsonb_array_length(p_puntos_nuevos);

  -- Si es dry_run, solo retornar información
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

  -- Insertar los nuevos puntos
  for punto_record in 
    select * from jsonb_array_elements(p_puntos_nuevos) as punto
  loop
    insert into public.monitoreo_puntos (
      expediente_id,
      locacion,
      punto_numero,
      geom_4326,
      marcado_status,
      monitoreado_status,
      anadido_motivo,
      created_at,
      updated_at
    ) values (
      p_expediente_id,
      p_locacion,
      (punto_record.punto->>'punto_numero')::integer,
      st_geomfromgeojson(punto_record.punto->>'geom_4326'),
      'PENDIENTE'::status_trabajo,
      'PENDIENTE'::status_trabajo,
      p_motivo,
      now(),
      now()
    ) returning id into nuevo_punto_id;
    
    puntos_insertados := puntos_insertados + 1;
  end loop;

  -- Auditar la operación
  perform public.f_auditar_evento('CREAR_ANADIDO', jsonb_build_object(
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'motivo', p_motivo,
    'puntos_existentes', puntos_existentes,
    'puntos_insertados', puntos_insertados,
    'supervisor_id', current_supervisor_id
  ));

  -- Retornar resultado
  return jsonb_build_object(
    'success', true,
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'motivo', p_motivo,
    'puntos_existentes', puntos_existentes,
    'puntos_insertados', puntos_insertados
  );
end;
$function$;

-- rpc_crear_replanteo
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
as $function$
declare
  current_supervisor_id uuid;
  puntos_existentes integer;
  puntos_nuevos_count integer;
  punto_record record;
  nuevo_punto_id uuid;
  puntos_insertados integer := 0;
begin
  -- Verificar que el usuario tiene permisos según el spec actualizado
  if not public.f_verificar_asignacion_expediente(p_expediente_id) then
    raise exception 'Acceso denegado: usuario no asignado al expediente o sin permisos suficientes (requiere SUPERVISOR/MONITOR/SUPERVISOR_LIDER/ADMIN)';
  end if;

  -- Obtener ID del supervisor actual
  current_supervisor_id := public.get_current_supervisor();
  
  if current_supervisor_id is null then
    raise exception 'No se pudo identificar al supervisor actual';
  end if;

  -- Validar parámetros
  if p_expediente_id is null then
    raise exception 'expediente_id es requerido';
  end if;

  if p_locacion is null or trim(p_locacion) = '' then
    raise exception 'locacion es requerida';
  end if;

  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'motivo es requerido para replanteo';
  end if;

  if p_puntos_nuevos is null or jsonb_array_length(p_puntos_nuevos) = 0 then
    raise exception 'puntos_nuevos es requerido y debe contener al menos un punto';
  end if;

  -- Contar puntos existentes en la locación
  select count(*) into puntos_existentes
  from public.monitoreo_puntos
  where expediente_id = p_expediente_id 
    and locacion = p_locacion 
    and deleted_at is null;

  -- Contar puntos nuevos a insertar
  puntos_nuevos_count := jsonb_array_length(p_puntos_nuevos);

  -- Si es dry_run, solo retornar información
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

  -- Insertar los nuevos puntos
  for punto_record in 
    select * from jsonb_array_elements(p_puntos_nuevos) as punto
  loop
    insert into public.monitoreo_puntos (
      expediente_id,
      locacion,
      punto_numero,
      geom_4326,
      marcado_status,
      monitoreado_status,
      replanteo_motivo,
      created_at,
      updated_at
    ) values (
      p_expediente_id,
      p_locacion,
      (punto_record.punto->>'punto_numero')::integer,
      st_geomfromgeojson(punto_record.punto->>'geom_4326'),
      'PENDIENTE'::status_trabajo,
      'PENDIENTE'::status_trabajo,
      p_motivo,
      now(),
      now()
    ) returning id into nuevo_punto_id;
    
    puntos_insertados := puntos_insertados + 1;
  end loop;

  -- Auditar la operación
  perform public.f_auditar_evento('CREAR_REPLANTEO', jsonb_build_object(
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'motivo', p_motivo,
    'puntos_existentes', puntos_existentes,
    'puntos_insertados', puntos_insertados,
    'supervisor_id', current_supervisor_id
  ));

  -- Retornar resultado
  return jsonb_build_object(
    'success', true,
    'expediente_id', p_expediente_id,
    'locacion', p_locacion,
    'motivo', p_motivo,
    'puntos_existentes', puntos_existentes,
    'puntos_insertados', puntos_insertados
  );
end;
$function$;

-- rpc_export_monitoreo
create or replace function public.rpc_export_monitoreo(expediente_id_param uuid)
returns table(
  locacion text,
  cod_celda text,
  cod_grilla text,
  este numeric,
  norte numeric,
  prof numeric,
  p_superpos text,
  cod_punto_campo text,
  cod_colectora text,
  distancia numeric,
  estado_avance estado_avance,
  fecha_marcado date,
  fecha_monitoreo date,
  supervisor_marcado text,
  supervisor_monitoreo text,
  motivo_descarte text,
  accion_codigo text
)
language sql
stable security definer
as $function$
  select 
    mp.locacion,
    mp.cod_celda,
    mp.cod_grilla,
    mp.este,
    mp.norte,
    mp.prof,
    mp.p_superpos,
    mp.cod_punto_campo,
    mp.cod_colectora,
    mp.distancia,
    mp.estado_avance,
    mp.fecha_marcado,
    mp.fecha_monitoreo,
    sm.nombre_completo as supervisor_marcado,
    smon.nombre_completo as supervisor_monitoreo,
    mp.motivo_descarte,
    a.codigo as accion_codigo
  from public.monitoreo_puntos mp
  left join public.supervisores sm on mp.supervisor_marcado_id = sm.id
  left join public.supervisores smon on mp.supervisor_monitoreo_id = smon.id
  left join public.acciones a on mp.accion_id = a.id
  where mp.expediente_id = expediente_id_param
    and mp.deleted_at is null
    and (
      exists(
        select 1 from public.expediente_supervisores es
        where es.expediente_id = expediente_id_param
        and es.supervisor_id = public.get_current_supervisor()
        and es.activo = true
        and es.deleted_at is null
      )
      or public.is_admin()
    )
  order by mp.locacion, mp.cod_celda, mp.cod_grilla;
$function$;

-- rpc_get_expediente_seleccionado
create or replace function public.rpc_get_expediente_seleccionado()
returns uuid
language plpgsql
as $function$
declare
  selected uuid;
begin
  select expediente_id into selected from public.expediente_seleccion_global where id = 1;
  return selected;
end;
$function$;

-- rpc_get_expediente_seleccionado_detail
create or replace function public.rpc_get_expediente_seleccionado_detail()
returns jsonb
language sql
as $function$
  select to_jsonb(x) from (
    select esg.expediente_id as id,
           e.expediente_codigo,
           e.nombre,
           esg.seleccionado_at
    from public.expediente_seleccion_global esg
    left join public.expedientes e on e.id = esg.expediente_id
    where esg.id = 1
  ) x;
$function$;

-- rpc_get_expediente_summary
create or replace function public.rpc_get_expediente_summary(expediente_id_param uuid)
returns jsonb
language sql
stable security definer
as $function$
  select jsonb_build_object(
    'expediente', (
      select jsonb_build_object(
        'id', e.id,
        'codigo', e.expediente_codigo,
        'nombre', e.nombre,
        'estado', null,
        'fecha_inicio', null,
        'fecha_fin', null
      )
      from public.expedientes e
      where e.id = expediente_id_param and coalesce(e.is_deleted, false) = false
    ),
    'monitoreo_stats', (
      select jsonb_build_object(
        'total', count(*),
        'pendiente', count(*) filter (where monitoreado_status = 'PENDIENTE'),
        'hecho', count(*) filter (where monitoreado_status = 'HECHO'),
        'descartado', count(*) filter (where monitoreado_status = 'DESCARTADO'),
        'porcentaje_completitud', 
          case 
            when count(*) > 0 then 
              round((count(*) filter (where monitoreado_status = 'HECHO')::numeric / count(*)::numeric) * 100, 2)
            else 0
          end
      )
      from public.monitoreo_puntos mp
      where mp.expediente_id = expediente_id_param and coalesce(mp.is_deleted, false) = false
    ),
    'vuelos_stats', (
      select jsonb_build_object(
        'total', count(*),
        'pendiente', count(*) filter (where volado_status = 'PENDIENTE'),
        'hecho', count(*) filter (where volado_status = 'HECHO'),
        'descartado', count(*) filter (where volado_status = 'DESCARTADO'),
        'porcentaje_completitud', 
          case 
            when count(*) > 0 then 
              round((count(*) filter (where volado_status = 'HECHO')::numeric / count(*)::numeric) * 100, 2)
            else 0
          end
      )
      from public.vuelos_items vi
      where vi.expediente_id = expediente_id_param and coalesce(vi.is_deleted, false) = false
    )
  )
  where (
    exists(
      select 1 from public.expediente_supervisores es
      where es.expediente_id = expediente_id_param
      and es.supervisor_id = public.get_current_supervisor()
      and es.activo = true
      and es.deleted_at is null
    )
    or public.is_admin()
  );
$function$;

-- rpc_get_monitoreo_puntos
create or replace function public.rpc_get_monitoreo_puntos(
  p_expediente_id uuid,
  p_locacion text default null,
  p_estatus_filter punto_estatus[] default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns setof monitoreo_puntos
language sql
stable
as $function$
  select *
  from public.monitoreo_puntos mp
  where mp.is_deleted = false
    and mp.expediente_id = p_expediente_id
    and (p_locacion is null or mp.locacion = p_locacion)
    and (p_estatus_filter is null or mp.estatus = any(p_estatus_filter))
    and (p_search is null or mp.cod_punto_campo ilike '%'||p_search||'%')
  order by mp.updated_at desc
  limit p_limit offset p_offset
$function$;

-- rpc_get_monitoreo_puntos_counts
create or replace function public.rpc_get_monitoreo_puntos_counts(p_expediente_id uuid)
returns table(estatus punto_estatus, total bigint)
language sql
stable
as $function$
  select mp.estatus, count(*)::bigint as total
  from public.monitoreo_puntos mp
  where mp.is_deleted = false and mp.expediente_id = p_expediente_id
  group by mp.estatus
  order by mp.estatus
$function$;

-- rpc_get_vuelos_items
create or replace function public.rpc_get_vuelos_items(
  p_expediente_id uuid,
  p_tipo vuelo_tipo[] default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns setof vuelos_items
language sql
stable
as $function$
  select *
  from public.vuelos_items vi
  where vi.is_deleted = false and vi.expediente_id = p_expediente_id
    and (p_tipo is null or vi.tipo = any(p_tipo))
    and (p_search is null or vi.codigo ilike '%'||p_search||'%')
  order by vi.updated_at desc
  limit p_limit offset p_offset
$function$;

-- rpc_get_vuelos_items_counts
create or replace function public.rpc_get_vuelos_items_counts(p_expediente_id uuid)
returns table(kind text, status status_trabajo, total bigint)
language sql
stable
as $function$
  select 'marcado'::text as kind, vi.marcado_status as status, count(*)::bigint
  from public.vuelos_items vi
  where vi.is_deleted = false and vi.expediente_id = p_expediente_id
  group by vi.marcado_status
  union all
  select 'volado'::text, vi.volado_status, count(*)::bigint
  from public.vuelos_items vi
  where vi.is_deleted = false and vi.expediente_id = p_expediente_id
  group by vi.volado_status
$function$;

-- rpc_list_expedientes
create or replace function public.rpc_list_expedientes(
  p_q text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(id uuid, expediente_codigo text, nombre text, created_at timestamptz)
language sql
as $function$
  select e.id, e.expediente_codigo, e.nombre, e.created_at
  from public.expedientes e
  where e.is_deleted = false
    and (
      p_q is null
      or e.expediente_codigo ilike '%' || p_q || '%'
      or e.nombre ilike '%' || p_q || '%'
    )
  order by e.created_at desc
  limit p_limit offset p_offset;
$function$;

-- rpc_restore_accion
create or replace function public.rpc_restore_accion(id_param uuid)
returns jsonb
language plpgsql
security definer
as $function$
declare
  affected_rows integer;
begin
  if not public.is_admin() then
    raise exception 'Solo usuarios ADMIN pueden restaurar acciones';
  end if;
  
  update public.acciones 
  set 
    deleted_at = null,
    deleted_by_supervisor_id = null,
    deleted_geom_4326 = null,
    updated_at = now()
  where id = id_param and deleted_at is not null;
  
  get diagnostics affected_rows = row_count;
  
  if affected_rows = 0 then
    raise exception 'Acción no encontrada o no estaba eliminada';
  end if;
  
  perform public.f_auditar_evento('RESTORE_ACCION', jsonb_build_object('accion_id', id_param));
  
  return jsonb_build_object('success', true, 'message', 'Acción restaurada correctamente');
end;
$function$;

-- rpc_restore_expediente
create or replace function public.rpc_restore_expediente(expediente_id uuid)
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_user_email text;
  v_supervisor_id uuid;
  v_expediente_exists integer;
  v_result jsonb;
begin
  -- Obtener email del usuario autenticado
  v_user_email := auth.email();
  
  -- Log parámetros de entrada
  raise log 'rpc_restore_expediente called: user=%, expediente_id=%', 
    v_user_email, expediente_id;

  -- Verificar que el usuario existe y obtener su ID
  select id into v_supervisor_id
  from public.supervisores s
  where s.email = v_user_email
  and s.is_active = true 
  and s.is_deleted = false;
  
  if v_supervisor_id is null then
    raise log 'Supervisor not found for user: %', v_user_email;
    raise exception 'Usuario no encontrado o inactivo: %', v_user_email;
  end if;
  
  raise log 'Found supervisor_id: % for user: %', v_supervisor_id, v_user_email;

  -- Verificar que el expediente existe y está eliminado
  select count(*) into v_expediente_exists
  from public.expedientes e
  where e.id = expediente_id
  and e.is_deleted = true;
  
  if v_expediente_exists = 0 then
    raise log 'Expediente not found or not deleted: %', expediente_id;
    raise exception 'Expediente no encontrado o no está eliminado: %', expediente_id;
  end if;

  -- Restaurar expediente
  update public.expedientes 
  set 
    is_deleted = false,
    deleted_at = null,
    deleted_by_supervisor_id = null,
    deleted_reason = null
  where id = expediente_id;
  
  -- Restaurar todas las acciones asociadas
  update public.acciones 
  set 
    is_deleted = false,
    deleted_at = null,
    deleted_by_supervisor_id = null,
    deleted_reason = null
  where expediente_id = expediente_id
  and is_deleted = true;
  
  raise log 'Successfully restored expediente: %', expediente_id;

  -- Retornar resultado
  v_result := jsonb_build_object(
    'success', true,
    'expediente_id', expediente_id,
    'restored_at', now(),
    'restored_by', v_supervisor_id
  );

  return v_result;
end;
$function$;

-- rpc_restore_monitoreo_punto
create or replace function public.rpc_restore_monitoreo_punto(id_param uuid)
returns jsonb
language plpgsql
security definer
as $function$
declare
  affected_rows integer;
begin
  if not public.is_admin() then
    raise exception 'Solo usuarios ADMIN pueden restaurar puntos de monitoreo';
  end if;
  
  update public.monitoreo_puntos 
  set 
    deleted_at = null,
    deleted_by_supervisor_id = null,
    deleted_geom_4326 = null,
    updated_at = now()
  where id = id_param and deleted_at is not null;
  
  get diagnostics affected_rows = row_count;
  
  if affected_rows = 0 then
    raise exception 'Punto de monitoreo no encontrado o no estaba eliminado';
  end if;
  
  perform public.f_auditar_evento('RESTORE_MONITOREO_PUNTO', jsonb_build_object('punto_id', id_param));
  
  return jsonb_build_object('success', true, 'message', 'Punto de monitoreo restaurado correctamente');
end;
$function$;

-- rpc_restore_supervisor
create or replace function public.rpc_restore_supervisor(id_param uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_email text;
  v_admin_supervisor_id uuid;
  affected_rows integer;
begin
  -- Obtener email del usuario autenticado
  v_user_email := auth.email();
  
  -- Log parámetros de entrada
  raise log 'rpc_restore_supervisor called: user=%, supervisor_id=%', 
    v_user_email, id_param;

  -- Verificar que el usuario existe y es ADMIN (misma lógica que delete_supervisor)
  select id into v_admin_supervisor_id
  from public.supervisores s
  where s.email = v_user_email
  and s.permisos_sistema = 'ADMIN'
  and s.is_active = true 
  and s.is_deleted = false;
  
  if v_admin_supervisor_id is null then
    raise log 'Access denied: user % is not admin', v_user_email;
    raise exception 'Acceso denegado: solo administradores pueden restaurar supervisores (user: %)', v_user_email;
  end if;
  
  raise log 'Admin access confirmed for user: %', v_user_email;

  -- Verificar que el supervisor existe y está eliminado
  if not exists (
    select 1 from public.supervisores 
    where id = id_param and is_deleted = true
  ) then
    raise log 'Supervisor not found or not deleted: %', id_param;
    raise exception 'Supervisor no encontrado o no estaba eliminado: %', id_param;
  end if;
  
  -- Perform restore
  update public.supervisores 
  set 
    deleted_at = null,
    deleted_by_supervisor_id = null,
    deleted_geom_4326 = null,
    is_active = true,
    is_deleted = false,
    deleted_precision_m = null,
    deleted_reason = null
  where id = id_param and is_deleted = true;
  
  get diagnostics affected_rows = row_count;
  
  raise log 'Successfully restored supervisor: %, affected_rows: %', id_param, affected_rows;

  -- Log audit event
  perform public.f_auditar_evento('RESTORE_SUPERVISOR', jsonb_build_object(
    'supervisor_id', id_param,
    'restored_by', v_admin_supervisor_id
  ));
  
  return jsonb_build_object(
    'success', true,
    'message', 'Supervisor restaurado correctamente',
    'affected_rows', affected_rows
  );
end;
$function$;

-- rpc_set_expediente_seleccionado
create or replace function public.rpc_set_expediente_seleccionado(p_expediente_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  setter_id uuid;
begin
  -- Validar ADMIN explícitamente
  if not public.is_admin() then
    raise exception 'Acceso denegado: solo ADMIN puede cambiar el expediente seleccionado';
  end if;

  -- Resolver supervisor actual (para auditoría)
  setter_id := public.get_current_supervisor();
  if setter_id is null then
    raise exception 'No se pudo identificar al supervisor actual';
  end if;

  -- Upsert singleton
  insert into public.expediente_seleccion_global as esg (id, expediente_id, seleccionado_por, seleccionado_at)
  values (1, p_expediente_id, setter_id, now())
  on conflict (id) do update set
    expediente_id = excluded.expediente_id,
    seleccionado_por = excluded.seleccionado_por,
    seleccionado_at = excluded.seleccionado_at;

  -- Auditoría: usar una acción válida según el CHECK constraint
  perform public.f_auditar_evento('UPDATE', jsonb_build_object(
    'evento', 'SET_EXPEDIENTE_SELECCIONADO',
    'expediente_id', p_expediente_id,
    'seleccionado_por', setter_id
  ));

  return jsonb_build_object('success', true, 'expediente_id', p_expediente_id);
end;
$function$;

-- rpc_soft_delete_accion
create or replace function public.rpc_soft_delete_accion(
  id_param uuid,
  geom4326_param geometry,
  precision_m_param double precision,
  reason_param text
)
returns jsonb
language plpgsql
security definer
as $function$
declare
  supervisor_actual_id uuid;
  affected_rows integer;
begin
  if not public.is_admin() then
    raise exception 'Solo usuarios ADMIN pueden eliminar acciones';
  end if;
  
  supervisor_actual_id := public.get_current_supervisor();
  
  update public.acciones 
  set 
    deleted_at = now(),
    deleted_by_supervisor_id = supervisor_actual_id,
    deleted_geom_4326 = geom4326_param,
    updated_at = now()
  where id = id_param and deleted_at is null;
  
  get diagnostics affected_rows = row_count;
  
  if affected_rows = 0 then
    raise exception 'Acción no encontrada o ya eliminada';
  end if;
  
  perform public.f_auditar_evento('SOFT_DELETE_ACCION', jsonb_build_object(
    'accion_id', id_param,
    'reason', reason_param
  ));
  
  return jsonb_build_object('success', true, 'message', 'Acción eliminada correctamente');
end;
$function$;

-- rpc_soft_delete_expediente
create or replace function public.rpc_soft_delete_expediente(expediente_id uuid, delete_reason text default null)
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_user_email text;
  v_supervisor_id uuid;
  v_expediente_exists integer;
  v_result jsonb;
begin
  -- Obtener email del usuario autenticado
  v_user_email := auth.email();
  
  -- Log parámetros de entrada
  raise log 'rpc_soft_delete_expediente called: user=%, expediente_id=%, reason=%', 
    v_user_email, expediente_id, delete_reason;

  -- Verificar que el usuario existe y obtener su ID
  select id into v_supervisor_id
  from public.supervisores s
  where s.email = v_user_email
  and s.is_active = true 
  and s.is_deleted = false;
  
  if v_supervisor_id is null then
    raise log 'Supervisor not found for user: %', v_user_email;
    raise exception 'Usuario no encontrado o inactivo: %', v_user_email;
  end if;
  
  raise log 'Found supervisor_id: % for user: %', v_supervisor_id, v_user_email;

  -- Verificar que el expediente existe y no está eliminado
  select count(*) into v_expediente_exists
  from public.expedientes e
  where e.id = expediente_id
  and e.is_deleted = false;
  
  if v_expediente_exists = 0 then
    raise log 'Expediente not found or already deleted: %', expediente_id;
    raise exception 'Expediente no encontrado o ya eliminado: %', expediente_id;
  end if;

  -- Realizar soft delete del expediente
  update public.expedientes 
  set 
    is_deleted = true,
    deleted_at = now(),
    deleted_by_supervisor_id = v_supervisor_id,
    deleted_reason = delete_reason
  where id = expediente_id;
  
  -- Realizar soft delete de todas las acciones asociadas (CORREGIDO: sin ambigüedad)
  update public.acciones a
  set 
    is_deleted = true,
    deleted_at = now(),
    deleted_by_supervisor_id = v_supervisor_id,
    deleted_reason = 'Eliminado junto con expediente: ' || coalesce(delete_reason, 'Sin razón especificada')
  where a.expediente_id = rpc_soft_delete_expediente.expediente_id
  and a.is_deleted = false;
  
  raise log 'Successfully soft deleted expediente: %', expediente_id;

  -- Retornar resultado
  v_result := jsonb_build_object(
    'success', true,
    'expediente_id', expediente_id,
    'deleted_at', now(),
    'deleted_by', v_supervisor_id,
    'reason', delete_reason
  );

  return v_result;
end;
$function$;

-- rpc_soft_delete_monitoreo_punto
create or replace function public.rpc_soft_delete_monitoreo_punto(
  id_param uuid,
  geom4326_param geometry,
  precision_m_param double precision,
  reason_param text
)
returns jsonb
language plpgsql
security definer
as $function$
declare
  supervisor_actual_id uuid;
  affected_rows integer;
begin
  if not public.is_admin() then
    raise exception 'Solo usuarios ADMIN pueden eliminar puntos de monitoreo';
  end if;
  
  supervisor_actual_id := public.get_current_supervisor();
  
  update public.monitoreo_puntos 
  set 
    deleted_at = now(),
    deleted_by_supervisor_id = supervisor_actual_id,
    deleted_geom_4326 = geom4326_param,
    updated_at = now()
  where id = id_param and deleted_at is null;
  
  get diagnostics affected_rows = row_count;
  
  if affected_rows = 0 then
    raise exception 'Punto de monitoreo no encontrado o ya eliminado';
  end if;
  
  perform public.f_auditar_evento('SOFT_DELETE_MONITOREO_PUNTO', jsonb_build_object(
    'punto_id', id_param,
    'reason', reason_param
  ));
  
  return jsonb_build_object('success', true, 'message', 'Punto de monitoreo eliminado correctamente');
end;
$function$;

-- rpc_soft_delete_supervisor (boolean variant)
create or replace function public.rpc_soft_delete_supervisor(
  p_supervisor_id uuid,
  p_delete_reason text default 'Eliminado por administrador'
)
returns boolean
language plpgsql
security definer
as $function$
declare
  current_supervisor_id uuid;
  current_geom geometry(point, 4326);
  current_precision double precision;
begin
  -- Verificar permisos ADMIN directamente
  if not exists (
    select 1 from public.supervisores 
    where email = auth.email()
    and permisos_sistema = 'ADMIN'
    and is_active = true 
    and is_deleted = false
  ) then
    raise exception 'Acceso denegado: solo usuarios con permisos ADMIN pueden eliminar supervisores';
  end if;

  -- Obtener ID del supervisor actual
  select id into current_supervisor_id
  from public.supervisores 
  where email = auth.email()
  and is_active = true 
  and is_deleted = false;

  -- Verificar que el supervisor existe y no está eliminado
  if not exists (select 1 from public.supervisores where id = p_supervisor_id and is_deleted = false) then
    raise exception 'Supervisor no encontrado o ya eliminado';
  end if;

  -- No permitir auto-eliminación
  if p_supervisor_id = current_supervisor_id then
    raise exception 'No puedes eliminarte a ti mismo';
  end if;

  -- Placeholder de ubicación actual
  current_geom := st_setsrid(st_makepoint(0, 0), 4326);
  current_precision := 0.0;

  -- Realizar soft delete
  update public.supervisores set
    is_deleted = true,
    deleted_at = now(),
    deleted_by_supervisor_id = current_supervisor_id,
    deleted_geom_4326 = current_geom,
    deleted_precision_m = current_precision,
    deleted_reason = p_delete_reason
  where id = p_supervisor_id;

  return true;
end;
$function$;

-- rpc_soft_delete_supervisor (jsonb variant)
create or replace function public.rpc_soft_delete_supervisor(
  id_param uuid,
  geom4326_param geometry default null,
  precision_m_param double precision default null,
  reason_param text default null
)
returns jsonb
language plpgsql
security definer
as $function$
declare
  supervisor_actual_id uuid;
  affected_rows integer;
begin
  -- Check if user is ADMIN
  if not public.is_admin() then
    raise exception 'Solo usuarios ADMIN pueden eliminar supervisores';
  end if;
  
  supervisor_actual_id := public.get_current_supervisor();
  
  -- Perform soft delete
  update public.supervisores 
  set 
    deleted_at = now(),
    deleted_by_supervisor_id = supervisor_actual_id,
    deleted_geom_4326 = geom4326_param,
    is_active = false,
    deleted_precision_m = precision_m_param,
    deleted_reason = reason_param,
    is_deleted = true
  where id = id_param and is_deleted = false;
  
  get diagnostics affected_rows = row_count;
  
  if affected_rows = 0 then
    raise exception 'Supervisor no encontrado o ya eliminado';
  end if;
  
  -- Log audit event
  perform public.f_auditar_evento('SOFT_DELETE_SUPERVISOR', jsonb_build_object(
    'supervisor_id', id_param,
    'reason', reason_param,
    'precision_m', precision_m_param
  ));
  
  return jsonb_build_object(
    'success', true,
    'message', 'Supervisor eliminado correctamente',
    'affected_rows', affected_rows
  );
end;
$function$;

-- =====================
-- Triggers (live state)
-- =====================

-- acciones: block hard delete
drop trigger if exists trigger_block_hard_delete_acciones on public.acciones;
create trigger trigger_block_hard_delete_acciones before delete on public.acciones for each row execute function f_block_hard_delete();

-- auditoria_eventos: block delete, update timestamp
drop trigger if exists tr_auditoria_eventos_block_delete on public.auditoria_eventos;
create trigger tr_auditoria_eventos_block_delete before delete on public.auditoria_eventos for each row execute function f_block_hard_delete();

drop trigger if exists tr_auditoria_eventos_update_timestamp on public.auditoria_eventos;
create trigger tr_auditoria_eventos_update_timestamp before update on public.auditoria_eventos for each row execute function f_update_timestamp();

-- expediente_supervisores: block delete, update timestamp
drop trigger if exists tr_expediente_supervisores_block_delete on public.expediente_supervisores;
create trigger tr_expediente_supervisores_block_delete before delete on public.expediente_supervisores for each row execute function f_block_hard_delete();

drop trigger if exists tr_expediente_supervisores_update_timestamp on public.expediente_supervisores;
create trigger tr_expediente_supervisores_update_timestamp before update on public.expediente_supervisores for each row execute function f_update_timestamp();

-- (duplicate legacy name) block delete on expediente_supervisores
drop trigger if exists trigger_block_hard_delete_expediente_supervisores on public.expediente_supervisores;
create trigger trigger_block_hard_delete_expediente_supervisores before delete on public.expediente_supervisores for each row execute function f_block_hard_delete();

-- expedientes: block delete
drop trigger if exists trigger_block_hard_delete_expedientes on public.expedientes;
create trigger trigger_block_hard_delete_expedientes before delete on public.expedientes for each row execute function f_block_hard_delete();

-- monitoreo_puntos: block delete, enforce replanteo, set geom, update estatus
drop trigger if exists tr_monitoreo_puntos_block_delete on public.monitoreo_puntos;
create trigger tr_monitoreo_puntos_block_delete before delete on public.monitoreo_puntos for each row execute function f_block_hard_delete();

drop trigger if exists tr_monitoreo_puntos_enforce_replanteo on public.monitoreo_puntos;
create trigger tr_monitoreo_puntos_enforce_replanteo before insert or update on public.monitoreo_puntos for each row execute function f_enforce_replanteo_codes();

drop trigger if exists tr_monitoreo_puntos_set_geom on public.monitoreo_puntos;
create trigger tr_monitoreo_puntos_set_geom before insert or update on public.monitoreo_puntos for each row execute function f_set_point_geom();

drop trigger if exists tr_monitoreo_puntos_update_estatus on public.monitoreo_puntos;
create trigger tr_monitoreo_puntos_update_estatus before insert or update on public.monitoreo_puntos for each row execute function f_update_estatus_punto();

-- Reset validation
set local check_function_bodies = on;
commit;
