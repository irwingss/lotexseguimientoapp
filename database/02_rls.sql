-- 02_rls.sql
-- RLS enablement and policies mirrored from live Supabase (iklzduuotmrzqxzdcfji)

-- Enable RLS on all relevant tables
alter table if exists public.acciones enable row level security;
alter table if exists public.auditoria_eventos enable row level security;
alter table if exists public.expediente_supervisores enable row level security;
alter table if exists public.expedientes enable row level security;
alter table if exists public.monitoreo_puntos enable row level security;
alter table if exists public.supervisores enable row level security;

-- Policies: public.acciones
drop policy if exists acciones_insert_policy on public.acciones;
create policy acciones_insert_policy on public.acciones
  for insert to public
  with check (
    (is_admin() AND (is_admin() OR (expediente_id IN (
      SELECT es.expediente_id FROM expediente_supervisores es
      WHERE ((es.supervisor_id = get_current_supervisor()) AND (es.activo = true))
    ))))
  );

drop policy if exists acciones_select_policy on public.acciones;
create policy acciones_select_policy on public.acciones
  for select to public
  using (
    ((get_current_supervisor() IS NOT NULL)
     AND (is_admin() OR (expediente_id IN (
       SELECT es.expediente_id FROM expediente_supervisores es
       WHERE ((es.supervisor_id = get_current_supervisor()) AND (es.activo = true))
     )))
     AND (is_deleted = false))
  );

drop policy if exists acciones_update_policy on public.acciones;
create policy acciones_update_policy on public.acciones
  for update to public
  using (
    (is_admin()
     AND (is_admin() OR (expediente_id IN (
       SELECT es.expediente_id FROM expediente_supervisores es
       WHERE ((es.supervisor_id = get_current_supervisor()) AND (es.activo = true))
     )))
     AND (is_deleted = false))
  );

-- Policies: public.expediente_supervisores
-- Note: explicit delete policy denies all

drop policy if exists expediente_supervisores_delete_policy on public.expediente_supervisores;
create policy expediente_supervisores_delete_policy on public.expediente_supervisores
  for delete to public
  using (false);

drop policy if exists expediente_supervisores_insert_policy on public.expediente_supervisores;
create policy expediente_supervisores_insert_policy on public.expediente_supervisores
  for insert to public
  with check (is_admin());

drop policy if exists expediente_supervisores_select_policy on public.expediente_supervisores;
create policy expediente_supervisores_select_policy on public.expediente_supervisores
  for select to public
  using (
    (is_admin() OR ((supervisor_id = get_supervisor_id(auth.email())) AND (deleted_at IS NULL)))
  );

drop policy if exists expediente_supervisores_update_policy on public.expediente_supervisores;
create policy expediente_supervisores_update_policy on public.expediente_supervisores
  for update to public
  using (is_admin());

-- Policies: public.expedientes

drop policy if exists expedientes_insert_policy on public.expedientes;
create policy expedientes_insert_policy on public.expedientes
  for insert to public
  with check (is_admin());

drop policy if exists expedientes_select_policy on public.expedientes;
create policy expedientes_select_policy on public.expedientes
  for select to public
  using (
    ((get_current_supervisor() IS NOT NULL)
     AND (is_admin() OR (id IN (
       SELECT es.expediente_id FROM expediente_supervisores es
       WHERE ((es.supervisor_id = get_current_supervisor()) AND (es.activo = true))
     )))
     AND (is_deleted = false))
  );

drop policy if exists expedientes_update_policy on public.expedientes;
create policy expedientes_update_policy on public.expedientes
  for update to public
  using ((is_admin() AND (is_deleted = false)));

-- Policies: public.monitoreo_puntos

drop policy if exists monitoreo_puntos_insert_policy on public.monitoreo_puntos;
create policy monitoreo_puntos_insert_policy on public.monitoreo_puntos
  for insert to public
  with check (
    ((get_current_supervisor() IS NOT NULL)
     AND (is_admin() OR (expediente_id IN (
       SELECT es.expediente_id FROM expediente_supervisores es
       WHERE ((es.supervisor_id = get_current_supervisor()) AND (es.activo = true))
     ))))
  );

drop policy if exists monitoreo_puntos_select_policy on public.monitoreo_puntos;
create policy monitoreo_puntos_select_policy on public.monitoreo_puntos
  for select to public
  using (
    ((get_current_supervisor() IS NOT NULL)
     AND (is_admin() OR (expediente_id IN (
       SELECT es.expediente_id FROM expediente_supervisores es
       WHERE ((es.supervisor_id = get_current_supervisor()) AND (es.activo = true))
     )))
     AND (is_deleted = false))
  );

drop policy if exists monitoreo_puntos_update_policy on public.monitoreo_puntos;
create policy monitoreo_puntos_update_policy on public.monitoreo_puntos
  for update to public
  using (
    ((get_current_supervisor() IS NOT NULL)
     AND (is_admin() OR (expediente_id IN (
       SELECT es.expediente_id FROM expediente_supervisores es
       WHERE ((es.supervisor_id = get_current_supervisor()) AND (es.activo = true))
     )))
     AND (is_deleted = false))
  );

-- Policies: public.supervisores

drop policy if exists supervisores_insert_policy on public.supervisores;
create policy supervisores_insert_policy on public.supervisores
  for insert to public
  with check (is_admin());

drop policy if exists supervisores_select_policy on public.supervisores;
create policy supervisores_select_policy on public.supervisores
  for select to public
  using (
    ((get_current_supervisor() IS NOT NULL)
     AND (is_admin() OR (id = get_current_supervisor()))
     AND (is_deleted = false))
  );

drop policy if exists supervisores_update_policy on public.supervisores;
create policy supervisores_update_policy on public.supervisores
  for update to public
  using ((is_admin() AND (is_deleted = false)));

-- Note: No explicit policies discovered for public.auditoria_eventos; RLS is enabled.
