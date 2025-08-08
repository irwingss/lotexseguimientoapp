# Row Level Security (RLS) Matrix

## Overview
All domain tables implement RLS with a **gatekeeper pattern** as the base security layer. Access is only allowed if the user exists in the `supervisores` table and is active.

## Gatekeeper Policy (Applied to ALL tables)
```sql
-- Base security: User must exist in supervisores table and be active
exists(
  select 1 from public.supervisores s
  where s.email = (auth.jwt() ->> 'email')::citext
  and s.is_active = true
  and s.is_deleted = false
)
```

## Frontend Gatekeeper Implementation (Fase 2)
- **Component**: `components/auth/gatekeeper.tsx`
- **Verification**: Checks user email against `supervisores` table
- **UI States**: Loading, Authorized, Access Denied
- **Integration**: Applied to all protected routes via `(protected)` layout

## Security Functions
- `get_current_supervisor()`: Returns UUID of current user from JWT
- `is_admin()`: Returns boolean if current user has ADMIN role

## RLS Policies by Table

### supervisores
- **Gatekeeper**: ✅ Standard gatekeeper policy
- **Admin Full Access**: ADMIN role has full CRUD access
- **Regular Users**: Can view all active supervisors, cannot modify

### expedientes
- **Gatekeeper**: ✅ Standard gatekeeper policy
- **Access**: All authenticated users can view/modify expedientes
- **Future**: Will be restricted by assignment in later phases

### acciones
- **Gatekeeper**: ✅ Standard gatekeeper policy
- **Access**: All authenticated users can view/modify acciones
- **Cascading**: Automatically deleted when parent expediente is deleted

### expediente_supervisores
- **Gatekeeper**: ✅ Standard gatekeeper policy
- **Access**: All authenticated users can view assignments
- **Future**: Will implement assignment-based restrictions

### monitoreo_puntos
- **Gatekeeper**: ✅ Standard gatekeeper policy
- **Access**: All authenticated users can view/modify monitoring points
- **Future**: Will be restricted by expediente assignment

### vuelos_items
- **Gatekeeper**: ✅ Standard gatekeeper policy
- **Access**: All authenticated users can view/modify flight items
- **Future**: Will be restricted by expediente assignment

### planificacion_diaria
- **Gatekeeper**: ✅ Standard gatekeeper policy
- **Access**: All authenticated users can view/modify daily planning

### planificacion_miembros
- **Gatekeeper**: ✅ Standard gatekeeper policy
- **Access**: All authenticated users can view/modify team members

### planificacion_asignaciones
- **Gatekeeper**: ✅ Standard gatekeeper policy
- **Access**: All authenticated users can view/modify task assignments

### auditoria_eventos
- **Gatekeeper**: ✅ Standard gatekeeper policy
- **Access**: Read-only for all authenticated users
- **Admin**: Full access for ADMIN role

## Security Model Evolution

### Phase 1 (Current): ✅ IMPLEMENTED
- Gatekeeper pattern on all tables
- Basic ADMIN role privileges
- Soft delete protection

### Phase 2 (Planned):
- Assignment-based access control
- Expediente-level permissions
- Team member restrictions

### Phase 3 (Planned):
- Fine-grained permissions
- Role-based feature access
- Audit trail enhancements

## Soft Delete Security
- Hard DELETE operations blocked by triggers
- Soft delete requires `deleted_geom_4326` (location where deleted)
- `deleted_by_supervisor_id` automatically set
- `deleted_at` timestamp automatically set

## Authentication Flow
1. User authenticates via Google OAuth
2. JWT contains email claim
3. Gatekeeper checks if email exists in `supervisores` table
4. If active and not deleted → access granted
5. If not found or inactive → access denied

## Testing RLS Policies
```sql
-- Test as regular user
set role authenticated;
set request.jwt.claims to '{"email": "supervisor@oefa.gob.pe"}';

-- Test as admin
set request.jwt.claims to '{"email": "admin@oefa.gob.pe"}';

-- Reset
reset role;
```

## Security Audit Checklist
- ✅ All domain tables have RLS enabled
- ✅ Gatekeeper policy applied to all tables
- ✅ Hard delete blocked by triggers
- ✅ Soft delete requires proper fields
- ✅ Admin role has appropriate privileges
- ✅ JWT email validation implemented
- ✅ Security functions are SECURITY DEFINER
