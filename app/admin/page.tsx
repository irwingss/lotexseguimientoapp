import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, FileText, Upload, BarChart3, Shield, ArrowRight } from 'lucide-react'

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          Panel de Administración
        </h1>
        <p className="text-muted-foreground">
          Gestiona usuarios, expedientes y configuración del sistema OEFA Lote X
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Supervisores */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">Supervisores</CardTitle>
              <CardDescription>
                Gestiona usuarios y permisos del sistema
              </CardDescription>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  CRUD completo con soft delete
                </p>
                <p className="text-xs text-muted-foreground">
                  ✅ Fase 4 implementada
                </p>
              </div>
              <Link href="/admin/supervisores">
                <Button size="sm">
                  Gestionar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Expedientes */}
        <Card className="hover:shadow-md transition-shadow opacity-60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">Expedientes</CardTitle>
              <CardDescription>
                Administra expedientes y acciones
              </CardDescription>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  CRUD de expedientes y asignaciones
                </p>
                <p className="text-xs text-muted-foreground">
                  🔄 Fase 5 pendiente
                </p>
              </div>
              <Button size="sm" disabled>
                Próximamente
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Importación */}
        <Card className="hover:shadow-md transition-shadow opacity-60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">Importación XLSX</CardTitle>
              <CardDescription>
                Carga masiva de datos de monitoreo
              </CardDescription>
            </div>
            <Upload className="h-8 w-8 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Monitoreo y vuelos desde Excel
                </p>
                <p className="text-xs text-muted-foreground">
                  🔄 Fase 6 pendiente
                </p>
              </div>
              <Button size="sm" disabled>
                Próximamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Fase Actual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estado del Desarrollo</CardTitle>
            <CardDescription>
              Progreso según plan_desarrollo.yaml
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Fase 1: Autenticación</span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✅ Completada</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Fase 2: Base de datos</span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✅ Completada</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Fase 3: PWA y Offline</span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✅ Completada</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Fase 4: Admin Supervisores</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">🔄 En Progreso</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Fase 5: Expedientes</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">⏳ Pendiente</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Características Implementadas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Características Fase 4</CardTitle>
            <CardDescription>
              Funcionalidades de administración de supervisores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">CRUD completo de supervisores</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">Soft delete con auditoría</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">Filtros por rol y estado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">RLS solo para ADMIN</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">UI con shadcn/ui</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">Estadísticas en tiempo real</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
