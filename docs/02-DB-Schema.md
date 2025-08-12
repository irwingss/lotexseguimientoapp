# Database Schema - OEFA Lote X App

## Overview
Este documento describe el esquema de base de datos completo para la aplicación OEFA Lote X, incluyendo todas las tablas, enums, índices y relaciones. **Actualizado tras corrección exhaustiva según specs_app.yaml**.

## Extensions
- **postgis**: Para soporte de datos geoespaciales
- **pgcrypto**: Para generación de UUIDs con `gen_random_uuid()`
- **citext**: Para emails case-insensitive

## Enums
```sql
-- Estados posibles de un expediente
create type estado_expediente as enum ('ACTIVO', 'CERRADO', 'SUSPENDIDO');

-- Roles de usuario en el sistema
create type rol_supervisor as enum ('ADMIN', 'SUPERVISOR_LIDER', 'SUPERVISOR', 'MONITOR');

-- Estados de avance para monitoreo y vuelos
create type estado_avance as enum ('PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'DESCARTADO');

-- Estados de trabajo
create type status_trabajo as enum ('PENDIENTE', 'HECHO', 'DESCARTADO');

-- Estados de puntos
create type punto_estatus as enum ('PENDIENTE', 'MARCADO', 'MONITOREADO', 'MARCADO_Y_MONITOREADO', 'DESCARTADO', 'REPLANTEADO', 'ANADIDO');

-- Tipos de vuelo
create type vuelo_tipo as enum ('PAF', 'PD');

-- Objetivos de asignación
create type asignacion_target as enum ('LOCACION', 'PUNTO_MONITOREO', 'VUELO_ITEM');

-- Tipos de actividad
create type actividad_tipo as enum ('MARCAR', 'MONITOREAR', 'VOLAR');
create type tipo_vuelo as enum ('PUNTO', 'LINEA', 'AREA');
```

## Core Tables

### supervisores
**Purpose**: Lista blanca de accesos y roles fijos por persona
- `id`: UUID primary key
- `email`: citext unique (case-insensitive)
- `nombre_completo`: text
- `rol`: rol_supervisor (ADMIN/SUPERVISOR/CONSULTOR)
- `activo`: boolean
- Standard audit fields (created_at, updated_at, deleted_at, etc.)

### expedientes
**Purpose**: Expedientes mensuales con códigos únicos
- `id`: UUID primary key
- `codigo`: text unique
- `nombre`: text
- `descripcion`: text
- `fecha_inicio`: date
- `fecha_fin`: date
- `estado`: estado_expediente

### acciones
**Purpose**: Códigos de acción por expediente
- `id`: UUID primary key
- `expediente_id`: FK to expedientes
- `codigo`: text (unique within expediente)
- `descripcion`: text
- `activo`: boolean

### monitoreo_puntos
**Purpose**: Puntos de monitoreo desde Excel + seguimiento de avance
- Excel data: locacion, cod_celda, cod_grilla, este, norte, prof, etc.
- Geometry: geom_utm_17s (EPSG:32717), geom_4326 (EPSG:4326)
- Progress: estado_avance, fecha_marcado, fecha_monitoreo
- Supervisors: supervisor_marcado_id, supervisor_monitoreo_id

### vuelos_items
**Purpose**: Items de vuelo desde Excel + seguimiento de avance
- Excel data: item, tipo, codigo, este, norte, base
- Geometry: geom_utm_17s, geom_4326
- Progress: estado_avance, fecha_marcado, fecha_volado
- Supervisors: supervisor_marcado_id, supervisor_volado_id

### Planning Tables
- `planificacion_diaria`: Planificación por frentes de trabajo
- `planificacion_miembros`: Miembros asignados por frente/día
- `planificacion_asignaciones`: Asignaciones específicas de tareas

### auditoria_eventos
**Purpose**: Log de auditoría para operaciones críticas
- Tracks INSERT/UPDATE/SOFT_DELETE operations
- Stores before/after data as JSONB
- Records supervisor, timestamp, IP, user agent

## Spatial Data (PostGIS)
- **Coordinate System**: UTM Zone 17S (EPSG:32717) for Peru's north coast
- **Storage**: Both UTM and WGS84 (EPSG:4326) geometries maintained
- **Auto-population**: Triggers automatically populate geometry fields from este/norte coordinates

## Constraints and Business Rules
- Soft delete only (hard DELETE blocked by triggers)
- Estado DESCARTADO requires motivo_descarte
- Date validation: fecha_marcado <= fecha_monitoreo/fecha_volado
- Unique constraints on key business combinations
- All tables have standard audit fields

## Indexes
- Performance indexes on frequently queried fields
- Spatial indexes (GIST) on geometry columns
- Partial indexes excluding soft-deleted records
- Composite indexes for common query patterns

## Migration Status
✅ All 8 migrations successfully applied:
1. Initial schema setup (extensions, enums)
2. Core tables (supervisores, expedientes, acciones)
3. Monitoring tables (monitoreo_puntos, vuelos_items)
4. Planning tables + audit log
5. Security functions
6. Triggers (soft delete protection, timestamps)
7. RLS policies
8. Indexes and geometry functions

---

## Fase 9 — Vuelos Avance (Esquema y Triggers)

### Tabla `public.vuelos_items` (detalle relevante a avance)
- __Campos de avance__:
  - `marcado_status` `status_trabajo` default `PENDIENTE`
  - `marcado_motivo` `text` (obligatorio si `marcado_status=DESCARTADO`)
  - `volado_status` `status_trabajo` default `PENDIENTE`
  - `volado_motivo` `text` (obligatorio si `volado_status=DESCARTADO`)
- __Captura opcional__ (para futuras geolocalizaciones):
  - `captura_geom_4326` `geometry(Point,4326)`
  - `captura_precision_m` `double precision`
  - `captura_at` `timestamptz`
  - `captura_fuente` `text` default `'MANUAL'`
- __Soft delete__:
  - `is_deleted` `boolean` default false
  - `deleted_at`, `deleted_by_supervisor_id`, `deleted_geom_4326`, `deleted_precision_m`, `deleted_reason`

### Constraints
- `chk_marcado_motivo_descartado`: obliga `marcado_motivo` cuando `marcado_status='DESCARTADO'`.
- `chk_volado_motivo_descartado`: obliga `volado_motivo` cuando `volado_status='DESCARTADO'`.

### Índices
- `unique_por_expediente_codigo (expediente_id, codigo)`
- `idx_vuelos_expediente (expediente_id)`
- `idx_vuelos_geom` GIST sobre `geom`

### Triggers y Funciones
- `f_set_point_geom` → Autocompleta `geom` (UTM 17S) desde `este`/`norte` en INSERT/UPDATE.
- `f_update_timestamp` → Actualiza `updated_at` en INSERT/UPDATE.
- `f_enforce_vuelos_update_columns` → No-ADMIN solo pueden modificar columnas de avance/captura.
- `trg_vuelos_items_audit_avance` (AFTER UPDATE) → Audita cambios en marcado/volado/captura.
- `f_block_hard_delete` + trigger → Bloquea DELETE físico.

### Seguridad y RLS (resumen)
- RLS activo. SELECT/UPDATE permitido a `ADMIN` o supervisores asignados al `expediente_id` vía `expediente_supervisores` y `is_deleted=false`.
- INSERT restringido a `ADMIN` (importación). DELETE bloqueado (usar soft delete vía RPC).

### RPCs Relacionadas (Security Definer)
- `rpc_set_vuelo_marcado(...)` y `rpc_set_vuelo_volado(...)` → actualizan estado/motivo y opcional captura.
- `rpc_soft_delete_vuelo_item(...)` y `rpc_restore_vuelo_item(id)` → administración de borrado lógico (solo `ADMIN`).

