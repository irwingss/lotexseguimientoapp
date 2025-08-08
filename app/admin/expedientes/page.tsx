'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Search, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ExpedientesTable } from '@/components/admin/expedientes-table'
import { ExpedientesStats } from '@/components/admin/expedientes-stats'
import { CreateExpedienteDialog } from '@/components/admin/create-expediente-dialog'
import { toast } from 'sonner'

interface Expediente {
  id: string
  expediente_codigo: string
  nombre: string
  created_at: string
  created_by_supervisor_id: string
  is_deleted: boolean
  supervisor?: {
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
  
  const supabase = createClientComponentClient()

  const fetchExpedientes = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('expedientes')
        .select(`
          *,
          supervisor:supervisores!expedientes_created_by_supervisor_id_fkey(nombre, email),
          acciones(id, codigo_accion, fecha_inicio, fecha_fin),
          supervisores_asignados:expediente_supervisores(
            supervisor:supervisores(id, nombre, email, rol)
          )
        `)
        .order('created_at', { ascending: false })

      if (statusFilter === 'active') {
        query = query.eq('is_deleted', false)
      } else if (statusFilter === 'deleted') {
        query = query.eq('is_deleted', true)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching expedientes:', error)
        toast.error('Error al cargar expedientes')
        return
      }

      setExpedientes(data || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar expedientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpedientes()
  }, [statusFilter])

  useEffect(() => {
    if (!searchTerm) {
      setFilteredExpedientes(expedientes)
      return
    }

    const filtered = expedientes.filter(expediente =>
      expediente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expediente.expediente_codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expediente.supervisor?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    setFilteredExpedientes(filtered)
  }, [expedientes, searchTerm])

  const handleExpedienteCreated = () => {
    fetchExpedientes()
    setCreateDialogOpen(false)
    toast.success('Expediente creado exitosamente')
  }

  const handleExpedienteUpdated = () => {
    fetchExpedientes()
    toast.success('Expediente actualizado exitosamente')
  }

  const handleExpedienteDeleted = () => {
    fetchExpedientes()
    toast.success('Expediente eliminado exitosamente')
  }

  const handleExpedienteRestored = () => {
    fetchExpedientes()
    toast.success('Expediente restaurado exitosamente')
  }

  return (
    <div className="space-y-6">
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
                  placeholder="Buscar por nombre, código o supervisor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
