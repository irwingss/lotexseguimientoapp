'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Search, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ExpedientesTable } from '@/components/admin/expedientes-table'
import { ExpedientesStats } from '@/components/admin/expedientes-stats'
import { CreateExpedienteDialog } from '@/components/admin/create-expediente-dialog'

interface Expediente {
  id: string
  expediente_codigo: string
  nombre: string
  created_at: string
  created_by_supervisor_id: string
  is_deleted: boolean
  supervisor_creador?: {
    id: string
    nombre: string
    email: string
  }
  acciones?: Array<{
    id: string
    codigo_accion: string
    fecha_inicio: string
    fecha_fin: string
  }>
  supervisores_asignados?: Array<{
    supervisor: {
      id: string
      nombre: string
      email: string
      rol: string
    }
  }>
}

export default function ExpedientesPage() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([])
  const [filteredExpedientes, setFilteredExpedientes] = useState<Expediente[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deleted'>('active')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchExpedientes = async () => {
    try {
      setLoading(true)
      
      // Lógica corregida para filtros de eliminados
      const includeDeleted = statusFilter === 'all'
      const deletedOnly = statusFilter === 'deleted'
      const { data, error } = await supabase.rpc('get_expedientes', {
        p_include_deleted: includeDeleted,
        p_search_term: searchTerm || null,
        p_deleted_only: deletedOnly
      })

      if (error) {
        console.error('Error fetching expedientes:', error)
        console.error('Error al cargar expedientes')
        return
      }

      // Normalize to avoid undefined/null items from RPC
      const normalized = Array.isArray(data)
        ? data.filter((e: any) => !!e && typeof e.id === 'string')
        : []
      setExpedientes(normalized)
    } catch (error) {
      console.error('Error:', error)
      console.error('Error al cargar expedientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpedientes()
  }, [statusFilter, searchTerm])

  // Simplificar: la función RPC ya maneja la búsqueda, no necesitamos filtrado local
  useEffect(() => {
    setFilteredExpedientes(expedientes)
  }, [expedientes])

  const handleExpedienteCreated = () => {
    fetchExpedientes()
    setCreateDialogOpen(false)
    console.log('Expediente creado exitosamente')
  }

  const handleExpedienteUpdated = () => {
    fetchExpedientes()
    console.log('Expediente actualizado exitosamente')
  }

  const handleExpedienteDeleted = () => {
    fetchExpedientes()
    console.log('Expediente eliminado exitosamente')
  }

  const handleExpedienteRestored = () => {
    fetchExpedientes()
    console.log('Expediente restaurado exitosamente')
  }

  return (
    <div className="space-y-6 pl-[calc(env(safe-area-inset-left)+16px)] pr-[calc(env(safe-area-inset-right)+16px)] sm:pl-0 sm:pr-0 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expedientes</h1>
          <p className="text-muted-foreground">
            Gestión de expedientes de supervisión y sus acciones asociadas
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Expediente
        </Button>
      </div>

      {/* Stats */}
      <ExpedientesStats expedientes={expedientes} />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
          <CardDescription>
            Filtra y busca expedientes por diferentes criterios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o código de expediente"
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="deleted">Eliminados</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <ExpedientesTable
        expedientes={filteredExpedientes}
        loading={loading}
        onExpedienteUpdated={handleExpedienteUpdated}
        onExpedienteDeleted={handleExpedienteDeleted}
        onExpedienteRestored={handleExpedienteRestored}
      />

      {/* Create Dialog */}
      <CreateExpedienteDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onExpedienteCreated={handleExpedienteCreated}
      />
    </div>
  )
}
