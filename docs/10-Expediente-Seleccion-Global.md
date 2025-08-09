# Fase 07 — Expediente Selección Global

Este documento describe el diseño, seguridad (RLS), funciones RPC y flujo UI/UX para la selección global de expediente, requisito para que solo un expediente esté disponible a usuarios no-ADMIN y que sea definido por ADMIN.

## Resumen

- Fuente de verdad: `public.expediente_seleccion_global` (singleton `id=1`).
- Solo ADMIN puede escribir/cambiar la selección. Todos pueden leer.
- Usuarios no-ADMIN solo pueden acceder al expediente seleccionado.
- Observabilidad: badge global visible en toda la app con el expediente seleccionado.
- UI ADMIN dedicada: `/admin/seleccion` para buscar/seleccionar expediente.

## Esquema y Seguridad

- Tabla: `public.expediente_seleccion_global`
  - Columnas relevantes: `id bigint`, `expediente_id uuid`, `seleccionado_by_supervisor_id uuid`, `seleccionado_at timestamptz`.
  - FK a `public.expedientes (id)` y `public.supervisores (id)`.
  - RLS activo:
    - `select` para `authenticated`.
    - `insert/update/delete` solo para ADMIN, validado con `public.is_admin()`.

- Función ADMIN: `public.is_admin()`
  - Determina rol a partir de `supervisores.permisos_sistema = 'ADMIN'`.

## RPCs

- `public.rpc_get_expediente_seleccionado()` → uuid | null
  - Devuelve el `expediente_id` seleccionado.

- `public.rpc_set_expediente_seleccionado(p_expediente_id uuid)` → void
  - Solo ADMIN. Actualiza el singleton y registra auditoría.

- `public.rpc_list_expedientes(p_q text, p_limit int, p_offset int)` → listado (id, expediente_codigo, nombre, created_at)
  - Lectura con RLS aplicado. Permite buscar por código/nombre.

- `public.rpc_get_expediente_seleccionado_detail()` → jsonb
  - Devuelve `{ id, expediente_codigo, nombre, seleccionado_at }` para mostrar en badge/UI.

Todas las funciones tienen `grant execute to authenticated` salvo las restricciones implícitas por RLS y validación ADMIN.

## Gating de Acceso

- Página de detalle `app/expedientes/[expediente-id]/page.tsx` (RSC):
  - Llama `is_admin()` y `rpc_get_expediente_seleccionado()`.
  - Usuarios no-ADMIN:
    - Si no hay seleccionado → 403 con instrucción para ADMIN.
    - Si la URL no coincide con el seleccionado → 403.
  - ADMIN: acceso sin restricción.

## UI /UX

- Badge global (observabilidad):
  - Implementado en `app/layout.tsx`: se llama `rpc_get_expediente_seleccionado_detail()` y se muestra en una barra superior en todas las páginas.
- Página ADMIN de selección rápida: `app/admin/seleccion/page.tsx`:
  - Búsqueda de expedientes vía `rpc_list_expedientes`.
  - Acción de servidor para `rpc_set_expediente_seleccionado`.
  - Muestra el seleccionado actual.
- Dashboard ADMIN (`/admin/page.tsx`): tarjeta de acceso rápido a Selección Global.

## Pestaña de Vuelos

- La pestaña "Vuelos" se muestra siempre en `app/expedientes/[expediente-id]/page.tsx`, independientemente de si hay datos.

## Consideraciones de RLS y Auditoría

- RLS aplicado a todas las tablas sensibles (ver especificaciones del proyecto).
- Los cambios de selección global están auditados a nivel de función/trigger (según convenciones del proyecto).
- No se omite RLS en ningún flujo UI: todo acceso pasa por RPCs o por select con RLS activo.

## DoD (Definition of Done)

- [x] Tabla singleton con RLS y FKs.
- [x] RPCs de lectura y escritura con grants apropiados.
- [x] Gating en `expedientes/[expediente-id]` para no-ADMIN.
- [x] UI ADMIN `/admin/seleccion` con búsqueda y seteo.
- [x] Badge global con expediente seleccionado.
- [x] Documentación actualizada (este archivo) para SS&T Gate.

## SS&T Gate Checklist

- Seguridad
  - [x] RLS valida: select abierto, write solo ADMIN.
  - [x] RPCs con `security invoker` y grants a `authenticated`.
- Usabilidad
  - [x] Selección rápida y búsqueda por código/nombre.
  - [x] Feedback visual del seleccionado actual (badge global + en páginas de detalle).
- Observabilidad
  - [x] Badge global en layout. Posible telemetría adicional vía logs/auditoría.
- Cumplimiento de Especificaciones
  - [x] App Router, TS, Tailwind, shadcn/ui, Supabase (RLS). Sin dependencias fuera del spec.
  - [x] Sin soluciones temporales. Persistencia y seguridad completas.
