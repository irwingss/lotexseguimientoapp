'use client'

import { PersonalStats } from '@/components/admin/personal-stats'
import { PersonalTable } from '@/components/admin/personal-table'
import { CreatePersonalDialog } from '@/components/admin/create-personal-dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function PersonalPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administración de Personal</h1>
          <p className="text-muted-foreground">
            Gestiona todo el personal del sistema: supervisores, monitores, conductores y responsables OIG
          </p>
        </div>
        <CreatePersonalDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Personal
          </Button>
        </CreatePersonalDialog>
      </div>

      {/* Stats */}
      <PersonalStats />

      {/* Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Lista de Personal</h2>
        <PersonalTable />
      </div>
    </div>
  )
}
