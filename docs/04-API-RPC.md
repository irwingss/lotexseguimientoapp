# API RPC Functions Documentation

## Overview
This document describes all RPC (Remote Procedure Call) functions implemented in Supabase for the OEFA Lote X application. All functions follow security policies and require proper authentication.

## Security Model
- **Authentication**: All RPC functions require valid JWT token
- **Authorization**: Functions check user permissions via `is_admin()` and role-based access
- **Audit Trail**: Critical operations are logged in `auditoria_eventos` table

## Utility Functions

### `f_default_accion_por_fecha(expediente_id, fecha)`
**Purpose**: Returns default action ID for an expedition and date
**Parameters**:
- `expediente_id_param` (uuid): Expedition ID
- `fecha_param` (date): Target date

**Returns**: `uuid` - Action ID or NULL if none found
**Security**: SECURITY DEFINER, STABLE
**Usage**:
```sql
SELECT public.f_default_accion_por_fecha('123e4567-e89b-12d3-a456-426614174000', '2025-01-15');
```

### `f_auditar_evento(evento, detalle)`
**Purpose**: Log audit events with current user context
**Parameters**:
- `evento_param` (text): Event description
- `detalle_param` (jsonb, optional): Additional event details

**Returns**: `uuid` - Audit event ID
**Security**: SECURITY DEFINER
**Usage**:
```sql
SELECT public.f_auditar_evento('USER_LOGIN', '{"ip": "192.168.1.1"}'::jsonb);
```

## Soft Delete Functions

### `rpc_soft_delete_supervisor(id, geom4326, precision_m, reason)`
**Purpose**: Soft delete supervisor (ADMIN only)
**Parameters**:
- `id_param` (uuid): Supervisor ID to delete
- `geom4326_param` (geometry): Location where deletion occurred
- `precision_m_param` (double precision): GPS precision in meters
- `reason_param` (text): Deletion reason

**Returns**: `jsonb` with success status and message
**Security**: ADMIN only
**Usage**:
```sql
SELECT public.rpc_soft_delete_supervisor(
  '123e4567-e89b-12d3-a456-426614174000',
  ST_SetSRID(ST_MakePoint(-77.0428, -12.0464), 4326),
  5.0,
  'Usuario inactivo'
);
```

### `rpc_restore_supervisor(id)`
**Purpose**: Restore soft-deleted supervisor (ADMIN only)
**Parameters**:
- `id_param` (uuid): Supervisor ID to restore

**Returns**: `jsonb` with success status and message
**Security**: ADMIN only

### `rpc_soft_delete_expediente(id, geom4326, precision_m, reason)`
**Purpose**: Soft delete expedition (ADMIN only)
**Parameters**: Same as supervisor soft delete
**Returns**: `jsonb` with success status and message
**Security**: ADMIN only

### `rpc_restore_expediente(id)`
**Purpose**: Restore soft-deleted expedition (ADMIN only)
**Security**: ADMIN only

### `rpc_soft_delete_accion(id, geom4326, precision_m, reason)`
**Purpose**: Soft delete action (ADMIN only)
**Security**: ADMIN only

### `rpc_restore_accion(id)`
**Purpose**: Restore soft-deleted action (ADMIN only)
**Security**: ADMIN only

### `rpc_soft_delete_monitoreo_punto(id, geom4326, precision_m, reason)`
**Purpose**: Soft delete monitoring point (ADMIN only)
**Security**: ADMIN only

### `rpc_restore_monitoreo_punto(id)`
**Purpose**: Restore soft-deleted monitoring point (ADMIN only)
**Security**: ADMIN only

## Export Functions

### `rpc_export_monitoreo(expediente_id)`
**Purpose**: Export monitoring data for Excel generation
**Parameters**:
- `expediente_id_param` (uuid): Expedition ID to export

**Returns**: Table with columns:
- `locacion`, `cod_celda`, `cod_grilla`
- `este`, `norte`, `prof`, `distancia`
- `cod_punto_campo`, `cod_colectora`, `p_superpos`
- `estado_avance`, `fecha_marcado`, `fecha_monitoreo`
- `supervisor_marcado`, `supervisor_monitoreo`
- `motivo_descarte`, `accion_codigo`

**Security**: User must have access to expedition or be ADMIN
**Usage**:
```sql
SELECT * FROM public.rpc_export_monitoreo('123e4567-e89b-12d3-a456-426614174000');
```

### `rpc_export_vuelos(expediente_id)`
**Purpose**: Export flight data for Excel generation
**Returns**: Table with flight-specific columns
**Security**: Same as monitoring export

### `rpc_get_expediente_summary(expediente_id)`
**Purpose**: Get expedition summary for dashboard
**Returns**: `jsonb` with:
- Expedition details
- Monitoring statistics (total, pending, completed, discarded, completion %)
- Flight statistics
- Overall completion metrics

**Usage**:
```sql
SELECT public.rpc_get_expediente_summary('123e4567-e89b-12d3-a456-426614174000');
```

## Bulk Operations (Critical Functions)

### `rpc_bulk_update_locacion_marcado(expediente_id, locacion, status, motivo?, only_unset?, dry_run?)`
**Purpose**: Mass update marking status for all points in a location
**Parameters**:
- `p_expediente_id` (uuid): Expedition ID
- `p_locacion` (text): Location name
- `p_status` (status_trabajo): New status (PENDIENTE, HECHO, DESCARTADO)
- `p_motivo` (text, optional): Required if status is DESCARTADO
- `p_only_unset` (boolean, default true): Only update PENDIENTE points
- `p_dry_run` (boolean, default false): Preview changes without applying

**Returns**: `jsonb` with operation results and affected point counts
**Security**: Requires active supervisor authentication
**Usage**:
```sql
-- Preview bulk marking as HECHO
SELECT public.rpc_bulk_update_locacion_marcado(
  '123e4567-e89b-12d3-a456-426614174000',
  'SECTOR_A',
  'HECHO'::status_trabajo,
  NULL,
  true,
  true
);

-- Apply bulk discard with reason
SELECT public.rpc_bulk_update_locacion_marcado(
  '123e4567-e89b-12d3-a456-426614174000',
  'SECTOR_A',
  'DESCARTADO'::status_trabajo,
  'Zona inaccesible por condiciones climáticas'
);
```

### `rpc_bulk_update_locacion_monitoreo(expediente_id, locacion, status, accion_id?, motivo?, only_unset?, dry_run?)`
**Purpose**: Mass update monitoring status for all points in a location
**Parameters**:
- `p_expediente_id` (uuid): Expedition ID
- `p_locacion` (text): Location name
- `p_status` (status_trabajo): New status (PENDIENTE, HECHO, DESCARTADO)
- `p_accion_id` (uuid, optional): Action ID (auto-assigned if NULL and status=HECHO)
- `p_motivo` (text, optional): Required if status is DESCARTADO
- `p_only_unset` (boolean, default true): Only update PENDIENTE points
- `p_dry_run` (boolean, default false): Preview changes without applying

**Returns**: `jsonb` with operation results and affected point counts
**Security**: Requires active supervisor authentication
**Usage**:
```sql
-- Bulk monitoring completion with auto action assignment
SELECT public.rpc_bulk_update_locacion_monitoreo(
  '123e4567-e89b-12d3-a456-426614174000',
  'SECTOR_B',
  'HECHO'::status_trabajo
);
```

### `rpc_crear_replanteo(expediente_id, locacion, motivo, puntos_nuevos, dry_run?)`
**Purpose**: Create replanting points with justification
**Parameters**:
- `p_expediente_id` (uuid): Expedition ID
- `p_locacion` (text): Location name
- `p_motivo` (text): Replanting justification (required)
- `p_puntos_nuevos` (jsonb): Array of new points with geometry
- `p_dry_run` (boolean, default false): Preview without inserting

**Returns**: `jsonb` with insertion results and point counts
**Security**: Requires active supervisor authentication
**Usage**:
```sql
SELECT public.rpc_crear_replanteo(
  '123e4567-e89b-12d3-a456-426614174000',
  'SECTOR_C',
  'Replanteo por obstáculos no identificados en planificación inicial',
  '[{"punto_numero": 101, "geom_4326": {"type": "Point", "coordinates": [-75.123, -12.456]}}]'::jsonb
);
```

### `rpc_crear_anadido(expediente_id, locacion, motivo, puntos_nuevos, dry_run?)`
**Purpose**: Create additional points with justification
**Parameters**:
- `p_expediente_id` (uuid): Expedition ID
- `p_locacion` (text): Location name
- `p_motivo` (text): Addition justification (required)
- `p_puntos_nuevos` (jsonb): Array of new points with geometry
- `p_dry_run` (boolean, default false): Preview without inserting

**Returns**: `jsonb` with insertion results and point counts
**Security**: Requires active supervisor authentication
**Usage**:
```sql
SELECT public.rpc_crear_anadido(
  '123e4567-e89b-12d3-a456-426614174000',
  'SECTOR_D',
  'Puntos adicionales por requerimiento técnico de mayor densidad',
  '[{"punto_numero": 201, "geom_4326": {"type": "Point", "coordinates": [-75.789, -12.123]}}]'::jsonb
);
```

## Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "affected_rows": 1
}
```

### Bulk Operation Response
```json
{
  "success": true,
  "total_puntos": 150,
  "puntos_afectados": 45,
  "expediente_id": "123e4567-e89b-12d3-a456-426614174000",
  "locacion": "SECTOR_A",
  "nuevo_status": "HECHO"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "affected_rows": 0
}
```

## Error Handling
- **Authentication Errors**: "Usuario no autorizado"
- **Permission Errors**: "Solo usuarios ADMIN pueden..."
- **Not Found Errors**: "Registro no encontrado o ya eliminado"
- **Validation Errors**: Specific field validation messages

## Audit Trail
All critical operations are automatically logged with:
- Actor (supervisor ID from JWT)
- Timestamp
- IP address
- User agent
- Operation details (JSONB)

## Endpoints HTTP (Next.js App Routes)

### POST /api/monitoreo/bulk-marcado
- Forma: `multipart/form-data`
- Campos:
  - `expediente_id` (uuid) — requerido
  - `locacion` (text) — requerido
  - `status` (text) — uno de: `PENDIENTE`, `HECHO`, `DESCARTADO`
  - `motivo` (text) — requerido si `status=DESCARTADO`
  - `only_unset` (boolean, default: `true`) — si `true`, sólo actualiza puntos en `PENDIENTE`
  - `dry_run` (boolean, default: `false`) — si `true`, previsualiza sin aplicar cambios
- Seguridad:
  - Autenticación Supabase requerida.
  - Debe estar asignado al expediente o ser `ADMIN` (ver `is_admin()`), validado en RPC.
- Respuesta:
  - Éxito: `{ ok: true, result: { dry_run, total_puntos, puntos_afectados, expediente_id, locacion, nuevo_status, motivo? } }`
  - Error: `{ ok: false, error: string }`
- Ejemplos:
```bash
curl -X POST \
  -F expediente_id=11111111-1111-1111-1111-111111111111 \
  -F locacion=L1 \
  -F status=HECHO \
  -F dry_run=true \
  http://localhost:3000/api/monitoreo/bulk-marcado

curl -X POST \
  -F expediente_id=11111111-1111-1111-1111-111111111111 \
  -F locacion=L1 \
  -F status=DESCARTADO \
  -F motivo="Zona inaccesible" \
  http://localhost:3000/api/monitoreo/bulk-marcado
```

### POST /api/monitoreo/bulk-monitoreo
- Forma: `multipart/form-data`
- Campos:
  - `expediente_id` (uuid) — requerido
  - `locacion` (text) — requerido
  - `status` (text) — uno de: `PENDIENTE`, `HECHO`, `DESCARTADO`
  - `accion_id` (uuid) — opcional; si `status=HECHO` y es `NULL`, se autoselecciona por fecha (`f_default_accion_por_fecha`)
  - `motivo` (text) — requerido si `status=DESCARTADO`
  - `only_unset` (boolean, default: `true`)
  - `dry_run` (boolean, default: `false`)
- Seguridad y respuesta: igual a `bulk-marcado`.
- Ejemplo:
```bash
curl -X POST \
  -F expediente_id=11111111-1111-1111-1111-111111111111 \
  -F locacion=L2 \
  -F status=HECHO \
  -F dry_run=true \
  http://localhost:3000/api/monitoreo/bulk-monitoreo
```

Notas:
- Ambos endpoints hacen `revalidatePath('/expedientes')` cuando `dry_run=false` para refrescar UI.
- Validaciones de motivo y acceso se aplican antes de invocar los RPCs.

## Testing
Use the following test queries to verify RPC functions:
```sql
-- Test audit function
SELECT public.f_auditar_evento('TEST_EVENT', '{"test": true}'::jsonb);

-- Test export function (replace with valid expedition ID)
SELECT COUNT(*) FROM public.rpc_export_monitoreo('your-expedition-id');

-- Test summary function
SELECT public.rpc_get_expediente_summary('your-expedition-id');
```

### Testing HTTP Bulk Endpoints

Pruebas manuales para `/api/monitoreo/bulk-marcado` y `/api/monitoreo/bulk-monitoreo`.

- __Dry-run marcado por locación__
  ```bash
  curl -X POST \
    -F expediente_id=<uuid> \
    -F locacion=L1 \
    -F status=HECHO \
    -F dry_run=true \
    http://localhost:3000/api/monitoreo/bulk-marcado
  ```
  - Esperado: `ok=true`, `result.dry_run=true`, conteos sin cambios aplicados.

- __DESCARTADO exige motivo (marcado)__
  ```bash
  curl -X POST \
    -F expediente_id=<uuid> \
    -F locacion=L1 \
    -F status=DESCARTADO \
    http://localhost:3000/api/monitoreo/bulk-marcado
  ```
  - Esperado: `400`, `ok=false`, `error` indica que el motivo es obligatorio.

- __Monitoreo HECHO sin accion_id (autoselección por fecha)__
  ```bash
  curl -X POST \
    -F expediente_id=<uuid> \
    -F locacion=L2 \
    -F status=HECHO \
    -F dry_run=true \
    http://localhost:3000/api/monitoreo/bulk-monitoreo
  ```
  - Esperado: `ok=true`, se aplica lógica de selección por rango de fechas en el RPC.

- __Solo actualiza PENDIENTE (only_unset)__
  ```bash
  curl -X POST \
    -F expediente_id=<uuid> \
    -F locacion=L1 \
    -F status=HECHO \
    -F only_unset=true \
    -F dry_run=true \
    http://localhost:3000/api/monitoreo/bulk-marcado
  ```
  - Esperado: `puntos_afectados` no incluye registros ya establecidos.

- __RLS/Permisos__ (usuario no asignado)
  - Enviar cualquier solicitud con sesión de usuario no asignado al expediente.
  - Esperado: `ok=false` con `error` del RPC por falta de permisos.

- __Aplicación real (sin dry_run)__
  ```bash
  curl -X POST \
    -F expediente_id=<uuid> \
    -F locacion=L1 \
    -F status=HECHO \
    http://localhost:3000/api/monitoreo/bulk-marcado
  ```
  - Esperado: `ok=true`, cambios aplicados y refresco de `/expedientes`.

- __Offline Queue (UI)__
  - En `/expedientes`, activar modo offline en DevTools.
  - Enviar formulario en `BulkLocacionActions`.
  - Esperado: acción encolada localmente; al volver online, se envía automáticamente.

## Vuelos Avance (RPCs y Endpoints HTTP)

### RPCs

#### `rpc_set_vuelo_marcado(p_vuelo_id, p_status, p_motivo?, p_captura_geom?, p_captura_precision?, p_captura_fuente?)`
- **Propósito**: Actualiza el avance de marcado de un item de vuelo.
- **Parámetros**:
  - `p_vuelo_id` (uuid) — requerido
  - `p_status` (`status_trabajo`) — `PENDIENTE` | `HECHO` | `DESCARTADO`
  - `p_motivo` (text, opcional) — requerido si `p_status=DESCARTADO`
  - `p_captura_geom` (geometry(Point, 4326), opcional) — captura geográfica (actualmente puede enviarse `NULL`)
  - `p_captura_precision` (double precision, opcional)
  - `p_captura_fuente` (text, opcional) — e.g., `MANUAL`, `GPS`
- **Validaciones**:
  - Verifica existencia del vuelo y que no esté soft-deleted
  - Requiere asignación al expediente o rol `ADMIN`
  - Obliga `p_motivo` cuando `p_status=DESCARTADO`
- **Auditoría**: Evento `VUELO_SET_MARCADO`
- **Retorna**: `jsonb` `{ "success": true }`

#### `rpc_set_vuelo_volado(p_vuelo_id, p_status, p_motivo?, p_captura_geom?, p_captura_precision?, p_captura_fuente?)`
- Igual a `rpc_set_vuelo_marcado` pero aplica a los campos de volado.
- **Auditoría**: Evento `VUELO_SET_VOLADO`

#### `rpc_soft_delete_vuelo_item(id_param, geom4326_param, precision_m_param, reason_param)`
- **Propósito**: Soft delete de un item de vuelo.
- **Seguridad**: Solo `ADMIN`.
- **Auditoría**: Evento `SOFT_DELETE_VUELO_ITEM`
- **Retorna**: `jsonb` `{ success, message }`

#### `rpc_restore_vuelo_item(id_param)`
- **Propósito**: Restaurar item de vuelo eliminado lógicamente.
- **Seguridad**: Solo `ADMIN`.
- **Retorna**: `jsonb` `{ success, message }`

---

## Endpoints HTTP (Vuelos)

### POST /api/vuelos/marcado
- **Forma**: `multipart/form-data`
- **Campos**:
  - `vuelo_id` (uuid) — requerido
  - `status` (text) — `PENDIENTE` | `HECHO` | `DESCARTADO`
  - `motivo` (text) — requerido si `status=DESCARTADO`
  - `precision` (number, opcional)
  - `fuente` (text, opcional)
  - `lat`, `lon` (opcionales; captura geográfica reservada, por ahora se envía `null`)
- **Seguridad**:
  - Autenticación Supabase requerida
  - Asignado al expediente del vuelo o `ADMIN` (validado en RPC y RLS)
- **Respuesta**:
  - Éxito: `{ ok: true, data: { success: true } }`
  - Error validación: `400` con `{ error }`
- **Ejemplos**:
```bash
curl -X POST \
  -F vuelo_id=11111111-1111-1111-1111-111111111111 \
  -F status=HECHO \
  http://localhost:3000/api/vuelos/marcado

curl -X POST \
  -F vuelo_id=11111111-1111-1111-1111-111111111111 \
  -F status=DESCARTADO \
  -F motivo="Base inaccesible" \
  http://localhost:3000/api/vuelos/marcado
```

### POST /api/vuelos/volado
- Igual a `/api/vuelos/marcado`, invoca `rpc_set_vuelo_volado`.

### POST /api/vuelos/soft-delete (ADMIN)
- **Campos**:
  - `id` (uuid) — id del item de vuelo
  - `reason` (text, opcional)
  - `precision` (number, opcional)
  - `lat`, `lon` (opcionales; `geom` reservado)
- **Respuesta**: `{ ok: true, data: { success: true, message } }`

### POST /api/vuelos/restore (ADMIN)
- **Campos**:
  - `id` (uuid) — id del item de vuelo a restaurar
- **Respuesta**: `{ ok: true, data: { success: true, message } }`

### Notas de Validación y Seguridad
- `status` válido: `PENDIENTE` | `HECHO` | `DESCARTADO`.
- `motivo` es obligatorio cuando `status=DESCARTADO` (validación en API y en RPC).
- RLS limita `SELECT/UPDATE` a supervisores asignados al expediente o `ADMIN`.
- Soft delete/restore es exclusivamente `ADMIN` y queda auditado.

### Integración Offline
- Formularios en UI usan `OfflineQueueForm` para encolar mutaciones cuando no hay red.
- Al reconectar, la cola se procesa automáticamente.
- Componentes: `components/work/VueloAvanceActions.tsx` integra botones de marcado/volado y envía a `/api/vuelos/*`.
