import { Suspense } from 'react'
import { SupervisoresTable } from '@/components/admin/supervisores-table'
import { SupervisoresStats } from '@/components/admin/supervisores-stats'
import { CreateSupervisorDialog } from '@/components/admin/create-supervisor-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Shield } from 'lucide-react'

export default function SupervisoresAdminPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Administración de Supervisores
          </h1>
          <p className="text-muted-foreground">
            Gestiona usuarios, roles y permisos del sistema
          </p>
        </div>
        <CreateSupervisorDialog>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Supervisor
          </Button>
        </CreateSupervisorDialog>
      </div>

      {/* Stats Cards */}
      <Suspense fallback={<div className="h-32 bg-muted animate-pulse rounded-lg" />}>
        <SupervisoresStats />
      </Suspense>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Supervisores
          </CardTitle>
          <CardDescription>
            Administra supervisores, roles y estados del sistema. Solo usuarios ADMIN pueden realizar cambios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded-lg" />}>
            <SupervisoresTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
