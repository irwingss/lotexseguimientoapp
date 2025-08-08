# OEFA Lote X - Project Overview

## Project Information
- **Project**: OEFA – Seguimiento de actividades de supervisión ambiental (Lote X)
- **Owner**: OEFA, Perú
- **Version**: 0.1
- **Language**: es-PE
- **Timezone**: America/Lima

## Objectives
- Autenticación con Google restringida por lista blanca (tabla supervisores)
- Carga de catálogos por ADMIN (puntos de monitoreo y vuelo desde Excel)
- Gestión de expedientes (mes a mes) y códigos de acción asociados
- Asignación de personal a expedientes y planificación diaria por frentes
- Registro de avance (marcado/monitoreo/volado) con motivos de descarte
- Dashboard con métricas de completitud (global y por frente/día/locación)

## Tech Stack
- **Frontend**: Next.js (TypeScript) + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL 15 + PostGIS + RLS + Edge Functions)
- **Authentication**: Google OAuth with whitelist
- **Deployment**: Vercel + Supabase
- **PWA**: Mandatory installation on mobile devices

## Key Principles
- Build backend-first: schema + RLS + RPC before UI
- Single source of truth: `/specs_app.yaml` (immutable)
- Soft delete only (hard delete blocked by triggers)
- Row Level Security (RLS) on all domain tables
- SS&T Gate: Sealed, Sanitized, Tested documentation required

## Phase 1 Status: ✅ COMPLETED
- Database schema created with all required tables
- RLS policies implemented with gatekeeper pattern
- Triggers for soft delete protection and auto-timestamps
- Geometry functions for UTM 17S ↔ WGS84 conversion
- Indexes for performance optimization
- All migrations successfully applied to Supabase

## Next Steps
- Phase 2: RPC Functions and Edge Functions
- Phase 3: Authentication and User Management
- Phase 4: Frontend UI Components
