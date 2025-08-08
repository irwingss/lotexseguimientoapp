'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Users, Search, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'

interface Supervisor {
  id: string
  nombre: string
  email: string
  rol: string
  is_active: boolean
}

interface Expediente {
  id: string
  expediente_codigo: string
  nombre: string
  supervisores_asignados?: Array<{
    supervisor: {
      id: string
      nombre: string
      email: string
      rol: string
    }
  }>
}

interface AssignSupervisoresDialogProps {
  expediente: Expediente
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssignmentUpdated: () => void
}

export function AssignSupervisoresDialog({
  expediente,
  open,
  onOpenChange,
  onAssignmentUpdated
}: AssignSupervisoresDialogProps) {
  const [loading, setLoading] = useState(false)
  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const [filteredSupervisores, setFilteredSupervisores] = useState<Supervisor[]>([])
  const [selectedSupervisores, setSelectedSupervisores] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  const supabase = createClientComponentClient()

  useEffect(() => {
    if (open) {
      fetchSupervisores()
      // Inicializar supervisores ya asignados
      const asignados = new Set(
        expediente.supervisores_asignados?.map(sa => sa.supervisor.id) || []
      )
      setSelectedSupervisores(asignados)
    }
  }, [open, expediente])

  useEffect(() => {
    let filtered = supervisores.filter(s => s.is_active)

    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(s => s.rol === roleFilter)
    }

    setFilteredSupervisores(filtered)
  }, [supervisores, searchTerm, roleFilter])

  const fetchSupervisores = async () => {
    try {
      const { data, error } = await supabase
        .from('supervisores')
        .select('*')
        .eq('is_deleted', false)
        .order('nombre')

      if (error) {
        console.error('Error fetching supervisores:', error)
        toast.error('Error al cargar supervisores')
        return
      }

      setSupervisores(data || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar supervisores')
    }
  }

  const handleSupervisorToggle = (supervisorId: string) => {
    const newSelected = new Set(selectedSupervisores)
    if (newSelected.has(supervisorId)) {
      newSelected.delete(supervisorId)
    } else {
      newSelected.add(supervisorId)
    }
    setSelectedSupervisores(newSelected)
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)

      // Obtener asignaciones actuales
      const currentAssignments = new Set(
        expediente.supervisores_asignados?.map(sa => sa.supervisor.id) || []
      )

      // Determinar qué supervisores agregar y quitar
      const toAdd = Array.from(selectedSupervisores).filter(id => !currentAssignments.has(id))
      const toRemove = Array.from(currentAssignments).filter(id => !selectedSupervisores.has(id))

      // Eliminar asignaciones (soft delete)
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('expediente_supervisores')
          .update({ 
            activo: false,
            deleted_at: new Date().toISOString()
          })
          .eq('expediente_id', expediente.id)
          .in('supervisor_id', toRemove)

        if (deleteError) {
          console.error('Error removing assignments:', deleteError)
          toast.error('Error al remover asignaciones')
          return
        }
      }

      // Agregar nuevas asignaciones
      if (toAdd.length > 0) {
        const newAssignments = toAdd.map(supervisorId => ({
          expediente_id: expediente.id,
          supervisor_id: supervisorId,
          activo: true
        }))

        const { error: insertError } = await supabase
          .from('expediente_supervisores')
          .insert(newAssignments)

        if (insertError) {
          console.error('Error adding assignments:', insertError)
          toast.error('Error al agregar asignaciones')
          return
        }
      }

      // Reactivar asignaciones existentes si es necesario
      const toReactivate = Array.from(selectedSupervisores).filter(id => {
        // Verificar si existe una asignación inactiva
        return currentAssignments.has(id)
      })

      if (toReactivate.length > 0) {
        const { error: reactivateError } = await supabase
          .from('expediente_supervisores')
          .update({ 
            activo: true,
            deleted_at: null
          })
          .eq('expediente_id', expediente.id)
          .in('supervisor_id', toReactivate)

        if (reactivateError) {
          console.error('Error reactivating assignments:', reactivateError)
          toast.error('Error al reactivar asignaciones')
          return
        }
      }

      onAssignmentUpdated()
      onOpenChange(false)
      toast.success('Asignaciones actualizadas exitosamente')
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al actualizar asignaciones')
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadgeVariant = (rol: string) => {
    switch (rol) {
      case 'SUPERVISOR_LIDER':
        return 'default'
      case 'SUPERVISOR':
        return 'secondary'
      case 'MONITOR':
        return 'outline'
      case 'CONDUCTOR':
        return 'destructive'
      case 'RESPONSABLE_OIG':
        return 'default'
      default:
        return 'outline'
    }
  }

  const getRoleDisplayName = (rol: string) => {
    switch (rol) {
      case 'SUPERVISOR_LIDER':
        return 'Supervisor Líder'
      case 'SUPERVISOR':
        return 'Supervisor'
      case 'MONITOR':
        return 'Monitor'
      case 'CONDUCTOR':
        return 'Conductor'
      case 'RESPONSABLE_OIG':
        return 'Responsable OIG'
      default:
        return rol
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Asignar Supervisores
          </DialogTitle>
          <DialogDescription>
            Asigna supervisores al expediente "{expediente.expediente_codigo}" - {expediente.nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
              <CardDescription>
                Busca y filtra supervisores disponibles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="search">Buscar supervisor</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Buscar por nombre o email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-[200px]">
                  <Label htmlFor="role-filter">Filtrar por rol</Label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Todos los roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los roles</SelectItem>
                      <SelectItem value="SUPERVISOR_LIDER">Supervisor Líder</SelectItem>
                      <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                      <SelectItem value="MONITOR">Monitor</SelectItem>
                      <SelectItem value="CONDUCTOR">Conductor</SelectItem>
                      <SelectItem value="RESPONSABLE_OIG">Responsable OIG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Supervisores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Supervisores Disponibles
                <Badge variant="outline">
                  {selectedSupervisores.size} seleccionados
                </Badge>
              </CardTitle>
              <CardDescription>
                Selecciona los supervisores que trabajarán en este expediente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredSupervisores.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <UserX className="h-8 w-8 mb-2" />
                  <p>No se encontraron supervisores</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredSupervisores.map((supervisor) => (
                    <div
                      key={supervisor.id}
                      className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        id={supervisor.id}
                        checked={selectedSupervisores.has(supervisor.id)}
                        onCheckedChange={() => handleSupervisorToggle(supervisor.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Label 
                            htmlFor={supervisor.id}
                            className="font-medium cursor-pointer"
                          >
                            {supervisor.nombre}
                          </Label>
                          <Badge variant={getRoleBadgeVariant(supervisor.rol)}>
                            {getRoleDisplayName(supervisor.rol)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {supervisor.email}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumen de Selección */}
          {selectedSupervisores.size > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Supervisores Seleccionados</CardTitle>
                <CardDescription>
                  Resumen de supervisores que serán asignados al expediente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedSupervisores).map(supervisorId => {
                    const supervisor = supervisores.find(s => s.id === supervisorId)
                    if (!supervisor) return null
                    
                    return (
                      <Badge key={supervisorId} variant="secondary" className="px-3 py-1">
                        {supervisor.nombre} ({getRoleDisplayName(supervisor.rol)})
                      </Badge>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar Asignaciones'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
