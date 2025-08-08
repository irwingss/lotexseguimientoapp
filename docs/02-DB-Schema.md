# Database Schema Documentation

## Overview
The database schema follows the specifications in `/specs_app.yaml` with PostgreSQL 15 + PostGIS extensions.

## Extensions Enabled
- `postgis`: Spatial data support
- `pgcrypto`: UUID generation with `gen_random_uuid()`
- `citext`: Case-insensitive text for emails

## Custom Types (Enums)
```sql
-- Estados posibles de un expediente
create type estado_expediente as enum ('ACTIVO', 'CERRADO', 'SUSPENDIDO');

-- Roles de usuario en el sistema
create type rol_supervisor as enum ('ADMIN', 'SUPERVISOR', 'CONSULTOR');

-- Estados de avance para monitoreo y vuelos
create type estado_avance as enum ('PENDIENTE', 'HECHO', 'DESCARTADO');

-- Tipos de vuelo disponibles
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
