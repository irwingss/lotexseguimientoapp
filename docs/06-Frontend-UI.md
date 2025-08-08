# Frontend UI - Fase 2: Autenticación y Guardas

## Overview
Implementación del sistema de autenticación con Google OAuth y guardas de acceso para el sistema OEFA Lote X.

## Arquitectura de Autenticación

### Flujo de Login
1. **Página de Login** (`/login`)
   - Botón de "Iniciar sesión con Google"
   - Redirección automática si ya está autenticado
   - UI limpia con branding OEFA

2. **Callback de Autenticación** (`/auth/callback`)
   - Manejo SSR del código de autorización
   - Intercambio seguro por sesión de Supabase
   - Redirección a dashboard o página solicitada

3. **Middleware de Autenticación**
   - Verificación automática de sesión en todas las rutas
   - Redirección a `/login` si no hay sesión válida
   - Refresco automático de tokens

### Sistema de Guardas (Gatekeeper)

#### Componente Gatekeeper
- **Ubicación**: `components/auth/gatekeeper.tsx`
- **Función**: Verificar que el email del usuario autenticado esté en la tabla `supervisores` y sea activo
- **Estados**:
  - Loading: Spinner mientras verifica
  - Autorizado: Permite acceso al contenido
  - No autorizado: Pantalla de acceso denegado

#### Verificación de Acceso
```sql
SELECT id, email, is_active, is_deleted 
FROM public.supervisores 
WHERE email = user.email 
  AND is_active = true 
  AND is_deleted = false
```

### Estructura de Rutas

#### Rutas Públicas
- `/login` - Página de login
- `/auth/callback` - Callback OAuth
- `/auth/auth-code-error` - Error de autenticación

#### Rutas Protegidas
- `/(protected)/` - Layout con gatekeeper
- `/(protected)/page.tsx` - Dashboard principal

### Componentes UI

#### Login Page
- **Tecnología**: Next.js Client Component
- **Dependencias**: Supabase Auth, shadcn/ui
- **Características**:
  - Botón Google OAuth con icono
  - Manejo de estados de carga
  - Mensajes de error
  - Responsive design

#### Dashboard
- **Header**: Información del usuario + logout
- **Contenido**: Cards de funcionalidades futuras
- **Permisos**: Secciones admin solo para usuarios ADMIN

#### Gatekeeper
- **Pantalla de acceso denegado**:
  - Mensaje claro de error
  - Email del usuario mostrado
  - Instrucciones para contactar admin
  - Botón de logout

### Configuración de Supabase

#### Client Configuration
```typescript
// lib/supabase/client.ts
createBrowserClient(
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY
)
```

#### Server Configuration
```typescript
// lib/supabase/server.ts
createServerClient con manejo de cookies
```

### Variables de Entorno
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE=your_supabase_service_role_key
```

### Flujo de Usuario

1. **Usuario no autenticado**:
   - Accede a cualquier ruta → Redirect a `/login`
   - Click en "Iniciar sesión con Google"
   - OAuth flow → Callback → Verificación gatekeeper

2. **Usuario autenticado pero no autorizado**:
   - Gatekeeper verifica email en `supervisores`
   - Si no existe o no activo → Pantalla de acceso denegado
   - Opción de logout disponible

3. **Usuario autorizado**:
   - Acceso completo al dashboard
   - Header con información del usuario
   - Funcionalidades según permisos (ADMIN/SUPERVISOR/MONITOR)

### Manejo de Sesiones

#### Refresco Automático
- Middleware verifica y refresca tokens automáticamente
- Cookies seguras con configuración SSR
- Manejo de errores de sesión expirada

#### Logout
- Limpia sesión de Supabase
- Redirect a página de login
- Limpia cookies y estado local

### Seguridad

#### Protecciones Implementadas
- Verificación de sesión en middleware
- Gatekeeper a nivel de base de datos
- Cookies seguras con httpOnly
- Validación de email en lista blanca

#### RLS Integration
- Todas las consultas usan RLS automáticamente
- Email del JWT se usa para políticas de acceso
- Sin acceso directo a datos sin autorización

### Testing Manual

#### Casos de Prueba
1. **Login exitoso**: Usuario en supervisores activo
2. **Login denegado**: Usuario no en supervisores
3. **Usuario inactivo**: is_active = false
4. **Usuario eliminado**: is_deleted = true
5. **Logout**: Limpia sesión correctamente
6. **Refresco de sesión**: Mantiene sesión activa

### Próximas Fases
- Fase 3: PWA con instalación obligatoria móvil
- Fase 4: CRUD de supervisores (solo ADMIN)
- Integración con funcionalidades específicas del dominio

### Dependencias
```json
{
  "@supabase/ssr": "latest",
  "@supabase/supabase-js": "latest",
  "@radix-ui/react-slot": "latest",
  "class-variance-authority": "latest"
}
```

## Estado de Implementación
- ✅ Login con Google OAuth
- ✅ Callback SSR seguro
- ✅ Middleware de autenticación
- ✅ Gatekeeper con verificación DB
- ✅ Layouts protegidos
- ✅ Manejo de errores
- ✅ UI responsive con shadcn/ui
- ✅ Documentación completa
