'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, RotateCcw, Search, Filter } from 'lucide-react'
import { EditSupervisorDialog } from './edit-supervisor-dialog'

type SupervisorRole = 'SUPERVISOR' | 'SUPERVISOR_LIDER' | 'MONITOR' | 'CONDUCTOR' | 'RESPONSABLE_OIG'
type PermisosSystem = 'ADMIN' | 'SUPERVISOR' | 'MONITOR'

interface Supervisor {
  id: string
  nombre: string
  email: string
  rol: SupervisorRole
  permisos_sistema: PermisosSystem
  is_active: boolean
  created_at: string
  is_deleted: boolean
  deleted_at: string | null
  deleted_reason: string | null
}

const ROLE_LABELS: Record<SupervisorRole, string> = {
  'SUPERVISOR': 'Supervisor',
  'SUPERVISOR_LIDER': 'Supervisor Líder',
  'MONITOR': 'Monitor',
  'CONDUCTOR': 'Conductor',
  'RESPONSABLE_OIG': 'Responsable OIG'
}

const PERMISOS_LABELS: Record<PermisosSystem, string> = {
  'ADMIN': 'Administrador',
  'SUPERVISOR': 'Supervisor',
  'MONITOR': 'Monitor'
}

export function SupervisoresTable() {
  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<SupervisorRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'deleted' | 'all'>('active')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [supervisorToDelete, setSupervisorToDelete] = useState<Supervisor | null>(null)
  const [editingSupervisor, setEditingSupervisor] = useState<Supervisor | null>(null)

  const supabase = createClient()

  const loadSupervisores = async () => {
    try {
      setLoading(true)
      
      const includeDeleted = statusFilter === 'deleted' || statusFilter === 'all'
      const activeFilter = statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : null
      const rolFilter = roleFilter === 'all' ? null : roleFilter

      const { data, error } = await supabase.rpc('get_supervisores', {
        p_include_deleted: includeDeleted,
        p_rol_filter: rolFilter,
        p_active_filter: activeFilter
      })

      if (error) {
        console.error('Error loading supervisores:', error)
        toast.error('Error al cargar supervisores: ' + error.message)
        return
      }

      setSupervisores(data || [])
    } catch (error) {
      console.error('Error loading supervisores:', error)
      toast.error('Error al cargar supervisores')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSupervisor = async () => {
    if (!supervisorToDelete) return

    try {
      const { error } = await supabase.rpc('delete_supervisor', {
        p_supervisor_id: supervisorToDelete.id,
        p_reason: 'Eliminado desde interfaz de administración'
      })

      if (error) {
        console.error('Error deleting supervisor:', error)
        toast.error('Error al eliminar supervisor: ' + error.message)
        return
      }

      toast.success('Supervisor eliminado correctamente')
      loadSupervisores()
    } catch (error) {
      console.error('Error deleting supervisor:', error)
      toast.error('Error al eliminar supervisor')
    } finally {
      setDeleteDialogOpen(false)
      setSupervisorToDelete(null)
    }
  }

  const handleRestoreSupervisor = async (supervisor: Supervisor) => {
    try {
      const { error } = await supabase.rpc('restore_supervisor', {
        p_supervisor_id: supervisor.id
      })

      if (error) {
        console.error('Error restoring supervisor:', error)
        toast.error('Error al restaurar supervisor: ' + error.message)
        return
      }

      toast.success('Supervisor restaurado correctamente')
      loadSupervisores()
    } catch (error) {
      console.error('Error restoring supervisor:', error)
      toast.error('Error al restaurar supervisor')
    }
  }

  useEffect(() => {
    loadSupervisores()
  }, [roleFilter, statusFilter])

  const filteredSupervisores = supervisores.filter(supervisor => {
    const matchesSearch = supervisor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supervisor.email.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const getRoleBadgeVariant = (rol: SupervisorRole) => {
    switch (rol) {
      case 'SUPERVISOR_LIDER': return 'default'
      case 'SUPERVISOR': return 'secondary'
      case 'MONITOR': return 'outline'
      case 'CONDUCTOR': return 'outline'
      case 'RESPONSABLE_OIG': return 'destructive'
      default: return 'secondary'
    }
  }

  const getPermisosBadgeVariant = (permisos: PermisosSystem) => {
    switch (permisos) {
      case 'ADMIN': return 'destructive'
      case 'SUPERVISOR': return 'default'
      case 'MONITOR': return 'secondary'
      default: return 'secondary'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Cargando supervisores...</div>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as SupervisorRole | 'all')}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'active' | 'inactive' | 'deleted' | 'all')}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Solo activos</SelectItem>
            <SelectItem value="inactive">Solo inactivos</SelectItem>
            <SelectItem value="deleted">Solo eliminados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Permisos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha Creación</TableHead>
              <TableHead className="w-12">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSupervisores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No se encontraron supervisores
                </TableCell>
              </TableRow>
            ) : (
              filteredSupervisores.map((supervisor) => (
                <TableRow key={supervisor.id}>
                  <TableCell className="font-medium">{supervisor.nombre}</TableCell>
                  <TableCell>{supervisor.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(supervisor.rol)}>
                      {ROLE_LABELS[supervisor.rol]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPermisosBadgeVariant(supervisor.permisos_sistema)}>
                      {PERMISOS_LABELS[supervisor.permisos_sistema]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {supervisor.is_deleted ? (
                      <Badge variant="destructive">Eliminado</Badge>
                    ) : supervisor.is_active ? (
                      <Badge variant="default">Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(supervisor.created_at).toLocaleDateString('es-PE')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!supervisor.is_deleted ? (
                          <>
                            <DropdownMenuItem onClick={() => setEditingSupervisor(supervisor)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSupervisorToDelete(supervisor)
                                setDeleteDialogOpen(true)
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onClick={() => handleRestoreSupervisor(supervisor)}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restaurar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar supervisor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará al supervisor "{supervisorToDelete?.nombre}" del sistema.
              El registro se mantendrá en la base de datos pero no podrá acceder al sistema.
              Esta acción se puede revertir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSupervisor} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      {editingSupervisor && (
        <EditSupervisorDialog
          supervisor={editingSupervisor}
          open={!!editingSupervisor}
          onOpenChange={(open) => !open && setEditingSupervisor(null)}
          onSuccess={() => {
            setEditingSupervisor(null)
            loadSupervisores()
          }}
        />
      )}
    </div>
  )
}
