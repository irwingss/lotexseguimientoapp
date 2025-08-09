'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
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
// import { toast } from 'sonner' // Removed for now

interface Personal {
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
    id: string
    nombre: string
    email: string
    rol: string
    activo: boolean
  }>
}

interface AssignPersonalDialogProps {
  expediente: Expediente
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssignmentComplete?: () => void
}

const ROLE_LABELS: Record<string, string> = {
  'SUPERVISOR': 'Supervisor',
  'SUPERVISOR_LIDER': 'Supervisor Líder',
  'MONITOR': 'Monitor',
  'CONDUCTOR': 'Conductor',
  'RESPONSABLE_OIG': 'Responsable OIG'
}

const ROLE_ORDER = ['SUPERVISOR_LIDER', 'SUPERVISOR', 'MONITOR', 'CONDUCTOR', 'RESPONSABLE_OIG']

export function AssignPersonalDialog({ 
  expediente, 
  open, 
  onOpenChange, 
  onAssignmentComplete 
}: AssignPersonalDialogProps) {
  const [personal, setPersonal] = useState<Personal[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [selectedPersonalIds, setSelectedPersonalIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Cargar personal disponible
  const loadPersonal = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase.rpc('get_supervisores', {
        p_include_deleted: false,
        p_rol_filter: roleFilter === 'all' ? null : roleFilter,
        p_active_filter: true, // Solo personal activo
        p_deleted_only: false
      })

      if (error) {
        console.error('Error loading personal:', error)
        return
      }

      setPersonal(data || [])
    } catch (error) {
      console.error('Error loading personal:', error)
    } finally {
      setLoading(false)
    }
  }

  // Cargar asignaciones actuales del expediente
  const loadCurrentAssignments = async () => {
    try {
      // Primero intentar usar los datos del prop si están disponibles
      if (expediente.supervisores_asignados && Array.isArray(expediente.supervisores_asignados)) {
        const currentIds = new Set(
          expediente.supervisores_asignados
            .filter(supervisor => supervisor && supervisor.id)
            .map(supervisor => supervisor.id)
        )
        setSelectedPersonalIds(currentIds)
        return
      }

      // Si no hay datos en el prop, cargar desde la base de datos
      const { data, error } = await supabase
        .from('expediente_supervisores')
        .select('supervisor_id')
        .eq('expediente_id', expediente.id)
        .eq('activo', true)
        .is('deleted_at', null)

      if (error) {
        console.error('Error loading current assignments:', error)
        return
      }

      if (data && Array.isArray(data)) {
        const currentIds = new Set(
          data
            .filter(assignment => assignment && assignment.supervisor_id)
            .map(assignment => assignment.supervisor_id)
        )
        setSelectedPersonalIds(currentIds)
      }
    } catch (error) {
      console.error('Error loading current assignments:', error)
    }
  }

  useEffect(() => {
    if (open) {
      loadPersonal()
      loadCurrentAssignments()
    }
  }, [open, roleFilter])

  // Filtrar personal por búsqueda
  const filteredPersonal = personal.filter(personalItem =>
    personalItem.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    personalItem.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Agrupar personal por rol
  const groupedPersonal = ROLE_ORDER.reduce((acc, rol) => {
    const personalInRole = filteredPersonal.filter(p => p.rol === rol)
    if (personalInRole.length > 0) {
      acc[rol] = personalInRole
    }
    return acc
  }, {} as Record<string, Personal[]>)

  const handlePersonalToggle = (personalId: string, checked: boolean) => {
    const newSelected = new Set(selectedPersonalIds)
    if (checked) {
      newSelected.add(personalId)
    } else {
      newSelected.delete(personalId)
    }
    setSelectedPersonalIds(newSelected)
  }

  const handleSaveAssignments = async () => {
    try {
      setSaving(true)
      
      // Obtener asignaciones actuales
      const currentAssignments = expediente.supervisores_asignados?.map(supervisor => supervisor.id) || []
      const newAssignments = Array.from(selectedPersonalIds)
      
      // Determinar qué asignar y qué desasignar
      const toAssign = newAssignments.filter(id => !currentAssignments.includes(id))
      const toUnassign = currentAssignments.filter(id => !newAssignments.includes(id))
      
      // Desasignar personal
      for (const personalId of toUnassign) {
        const { error } = await supabase.rpc('remove_supervisor_from_expediente', {
          p_expediente_id: expediente.id,
          p_supervisor_id: personalId
        })
        
        if (error) {
          console.error('Error unassigning personal:', error)
          throw error
        }
      }
      
      // Asignar nuevo personal
      for (const personalId of toAssign) {
        const { error } = await supabase.rpc('assign_supervisor_to_expediente', {
          p_expediente_id: expediente.id,
          p_supervisor_id: personalId
        })
        
        if (error) {
          console.error('Error assigning personal:', error)
          throw error
        }
      }
      
      // toast.success('Asignaciones actualizadas correctamente')
      onOpenChange(false)
      onAssignmentComplete?.()
      
    } catch (error) {
      console.error('Error saving assignments:', error)
      // toast.error('Error al guardar asignaciones')
    } finally {
      setSaving(false)
    }
  }

  const selectedCount = selectedPersonalIds.size
  const totalPersonal = filteredPersonal.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Asignar Personal al Expediente
          </DialogTitle>
          <DialogDescription>
            Expediente: <strong>{expediente.expediente_codigo}</strong> - {expediente.nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar personal por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por rol" />
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

          {/* Contador de selección */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {selectedCount} de {totalPersonal} personal seleccionado
            </span>
            {selectedCount > 0 && (
              <Badge variant="secondary">
                {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Lista de personal agrupada por rol */}
          <div className="flex-1 overflow-y-auto space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Cargando personal...</p>
                </div>
              </div>
            ) : Object.keys(groupedPersonal).length === 0 ? (
              <div className="text-center py-8">
                <UserX className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No se encontró personal disponible</p>
              </div>
            ) : (
              Object.entries(groupedPersonal).map(([rol, personalInRole]) => (
                <div key={rol} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm text-primary">
                      {ROLE_LABELS[rol]} ({personalInRole.length})
                    </h3>
                  </div>
                  
                  <div className="grid gap-3 md:grid-cols-2">
                    {personalInRole.map((personalItem) => {
                      const isSelected = selectedPersonalIds.has(personalItem.id)
                      
                      return (
                        <Card 
                          key={personalItem.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                          }`}
                          onClick={() => handlePersonalToggle(personalItem.id, !isSelected)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-sm font-medium">
                                  {personalItem.nombre}
                                </CardTitle>
                                <CardDescription className="text-xs">
                                  {personalItem.email}
                                </CardDescription>
                              </div>
                              <Checkbox
                                checked={isSelected}
                                onChange={(e) => e.stopPropagation()}
                                className="mt-1"
                              />
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-xs">
                                {ROLE_LABELS[personalItem.rol]}
                              </Badge>
                              {personalItem.is_active ? (
                                <Badge variant="default" className="text-xs">
                                  Activo
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  Inactivo
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSaveAssignments}
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Guardando...
              </>
            ) : (
              'Guardar Asignaciones'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
