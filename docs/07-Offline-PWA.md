# 07 - Offline PWA

## Resumen
Implementación de Progressive Web App (PWA) con capacidades offline para el sistema de seguimiento OEFA Lote X. Permite trabajar sin conexión en campo con sincronización automática al recuperar conectividad.

## Arquitectura PWA

### Configuración Base
- **Framework PWA**: `@ducanh2912/next-pwa` v4.x
- **Base de datos offline**: Dexie (IndexedDB wrapper)
- **Estrategia de cache**: Stale-while-revalidate para APIs, cache-first para assets
- **Service Worker**: Generado automáticamente por next-pwa

### Archivos Clave
```
├── next.config.ts              # Configuración PWA
├── public/manifest.json        # Manifiesto PWA
├── lib/
│   ├── db.ts                  # Schema IndexedDB (Dexie)
│   └── pwa-utils.ts           # Utilidades de detección PWA
└── components/pwa/
    ├── install-gate.tsx       # Gate de instalación obligatoria
    ├── preload-screen.tsx     # Pantalla de precarga de datos
    └── offline-indicator.tsx  # Indicador de estado offline
```

## Install Gate (Instalación Obligatoria)

### Comportamiento por Dispositivo
- **Móviles (iOS/Android)**: Instalación **obligatoria** - bloquea acceso hasta instalar
- **Desktop**: Instalación **opcional** - permite continuar sin instalar

### Detección de Dispositivo
```typescript
// Detección móvil
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Detección modo standalone (instalado)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                     navigator.standalone === true;
```

### Flujo de Instalación
1. **Android**: Usa `beforeinstallprompt` event para instalación nativa
2. **iOS**: Muestra instrucciones manuales (Safari → Compartir → Añadir a pantalla de inicio)
3. **Desktop**: Banner no bloqueante con opción de instalar

### Variable de Control
```env
NEXT_PUBLIC_REQUIRE_INSTALL=MOBILE_ONLY
# Opciones: ALWAYS | MOBILE_ONLY | NEVER
```

## Precarga de Datos

### Pantalla de Precarga
Aparece tras el login exitoso, permite seleccionar:
- **Expediente activo**: Lista de expedientes asignados al usuario
- **Fecha de trabajo**: Calendario para seleccionar día de trabajo

### Proceso de Descarga
1. **Asignaciones** (20%): Carga `expediente_supervisores` del expediente seleccionado
2. **Puntos de monitoreo** (60%): Carga `monitoreo_puntos` con coordenadas y estado
3. **Limpieza** (90%): Elimina cache expirado (>24h)
4. **Finalización** (100%): Marca como "Listo para offline"

### Almacenamiento Local
```typescript
// Información de precarga en localStorage
{
  expediente_id: string,
  fecha: string,
  timestamp: number
}
```

## IndexedDB Schema

### Stores Implementados
```typescript
// assignments_cache: Asignaciones de personal
{
  id: string,
  expediente_id: string,
  supervisor_id: string,
  fecha_asignacion: string,
  cached_at: number
}

// points_cache: Puntos de monitoreo
{
  id: string,
  expediente_id: string,
  locacion: string,
  cod_punto_campo: string,
  este: number,
  norte: number,
  estatus: string,
  cached_at: number
}

// mutations_queue: Cola de mutaciones offline
{
  id: number,
  type: 'UPDATE_POINT_STATUS' | 'CREATE_ASSIGNMENT' | 'DELETE_ASSIGNMENT',
  payload: any,
  timestamp: number,
  retry_count: number,
  status: 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED'
}
```

### Gestión de Cache
- **TTL**: 24 horas para datos cached
- **Limpieza automática**: Al hacer nueva precarga
- **Tamaño**: Monitoreo de cantidad de registros por store

## Indicador Offline

### Estados Visuales
- **🟢 En línea**: Conectado, sin mutaciones pendientes
- **🟡 Sincronizando**: Conectado, con mutaciones pendientes
- **🔵 Modo offline**: Sin conexión, con datos cached
- **🔴 Sin conexión - Sin datos**: Sin conexión ni cache

### Información Mostrada
- Estado de conectividad actual
- Cantidad de datos en cache (asignaciones, puntos)
- Número de mutaciones pendientes
- Última sincronización exitosa
- Opciones de limpieza de cache

## Funcionamiento Offline

### Capacidades sin Conexión
1. **Visualización**: Mostrar datos precargados (expedientes, puntos, asignaciones)
2. **Mutaciones**: Encolar cambios de estado de puntos
3. **Navegación**: Funcionalidad completa de la UI
4. **Persistencia**: Mantener estado entre sesiones

### Sincronización al Reconectar
1. **Detección automática**: Event listeners para `online`/`offline`
2. **Procesamiento de cola**: Envío secuencial de mutaciones pendientes
3. **Manejo de errores**: Reintentos con backoff exponencial
4. **Actualización de cache**: Refresh de datos tras sincronización exitosa

## Configuración de Producción

### Variables de Entorno Requeridas
```env
NEXT_PUBLIC_SITE_URL=https://tu-dominio.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_REQUIRE_INSTALL=MOBILE_ONLY
```

### Manifest PWA
```json
{
  "name": "OEFA - Seguimiento Lote X",
  "short_name": "Lote X",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#059669",
  "background_color": "#ffffff",
  "orientation": "portrait-primary"
}
```

### Service Worker
- **Generación**: Automática via next-pwa
- **Estrategias**: 
  - Cache-first para assets estáticos
  - Network-first para APIs
  - Stale-while-revalidate para datos frecuentes

## Testing y Validación

### Casos de Prueba Offline
1. **Instalación móvil**: Verificar bloqueo hasta instalar
2. **Precarga**: Confirmar descarga de datos a IndexedDB
3. **Modo offline**: Navegar y usar app sin conexión
4. **Mutaciones**: Encolar cambios sin conexión
5. **Sincronización**: Procesar cola al reconectar

### Herramientas de Debug
- **Chrome DevTools**: Application → Storage → IndexedDB
- **Network throttling**: Simular conexión lenta/offline
- **PWA audit**: Lighthouse para validar PWA compliance

## Limitaciones y Consideraciones

### Limitaciones Técnicas
- **Tamaño de cache**: IndexedDB limitado por cuota del navegador
- **Sincronización**: Requiere conexión estable para procesar cola
- **Conflictos**: No maneja conflictos de datos concurrentes

### Consideraciones de UX
- **Feedback visual**: Siempre mostrar estado de conectividad
- **Educación del usuario**: Explicar beneficios de instalación
- **Gestión de expectativas**: Indicar qué funciona offline

## Métricas y Monitoreo

### KPIs a Monitorear
- **Tasa de instalación**: % usuarios que instalan PWA
- **Uso offline**: Tiempo promedio sin conexión
- **Éxito de sincronización**: % mutaciones sincronizadas exitosamente
- **Tamaño de cache**: Promedio de datos almacenados localmente

---

**Fase completada**: ✅ 3_pwa_instalacion_y_precarga  
**Fecha**: 2025-08-08  
**DoD verificado**: Modo offline funcional + mutaciones encoladas  
**Próxima fase**: 4_admin_supervisores

---

## Fase 9 — Mutaciones Offline para Vuelos Avance

### Integración
- Los formularios de avance de vuelos usan `components/work/VueloAvanceActions.tsx` con `OfflineQueueForm`.
- Endpoints utilizados:
  - `POST /api/vuelos/marcado`
  - `POST /api/vuelos/volado`

### Payload (multipart/form-data)
- `vuelo_id` (uuid) — requerido
- `status` (`PENDIENTE|HECHO|DESCARTADO`) — requerido
- `motivo` (text) — requerido si `status=DESCARTADO`
- `precision` (number, opcional)
- `fuente` (text, opcional)
- `lat`, `lon` (opcionales; captura reservada; actualmente puede ir `null`)

### Comportamiento de la Cola
- Si está offline, el `FormData` se guarda en `mutations_queue` (IndexedDB vía Dexie; wrapper localStorage si aplica).
- Al recuperar conexión:
  - Se hace flush automático en orden FIFO hacia el endpoint objetivo.
  - Reintentos con backoff exponencial en errores transitorios.
- Los envíos online directos siguen funcionando (no redirigen de página).

### Estados de UI
- Botones muestran loading durante intento de envío.
- `components/pwa/offline-indicator.tsx` refleja cantidad de mutaciones pendientes y conectividad.

### Pruebas Manuales
1. Forzar offline en DevTools.
2. En `/expedientes`, cambiar estado de un vuelo a `HECHO`.
3. Confirmar que aparece en la cola y que no navega.
4. Volver online y verificar flush automático y respuesta `{ ok: true }`.
5. Repetir con `DESCARTADO` asegurando que `motivo` es requerido.

### Limitaciones
- La vista no hace auto-refresh tras aplicar; pendiente revalidación/optimistic updates.
- Campos de geolocalización están preparados pero no capturados por defecto.

