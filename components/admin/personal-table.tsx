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
import { MoreHorizontal, Pencil, Trash2, RotateCcw, Search, Filter, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { EditPersonalDialog } from '@/components/admin/edit-personal-dialog'

type SupervisorRole = 'SUPERVISOR' | 'SUPERVISOR_LIDER' | 'MONITOR' | 'CONDUCTOR' | 'RESPONSABLE_OIG'
type PermisosSystem = 'ADMIN' | 'no_ADMIN'
type SortField = 'nombre' | 'email' | 'rol' | 'permisos_sistema' | 'is_active' | 'created_at'
type SortDirection = 'asc' | 'desc'

interface Personal {
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
  'no_ADMIN': 'Usuario'
}

export function PersonalTable() {
  const [personal, setPersonal] = useState<Personal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<SupervisorRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'deleted' | 'all'>('active')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [personalToDelete, setPersonalToDelete] = useState<Personal | null>(null)
  const [editingPersonal, setEditingPersonal] = useState<Personal | null>(null)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const supabase = createClient()

  const loadPersonal = async () => {
    try {
      setLoading(true)
      
      // Lógica corregida para filtros de eliminados
      const includeDeleted = statusFilter === 'all'
      const deletedOnly = statusFilter === 'deleted'
      const activeFilter = statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : null
      const rolFilter = roleFilter === 'all' ? null : roleFilter

      const { data, error } = await supabase.rpc('get_supervisores', {
        p_include_deleted: includeDeleted,
        p_rol_filter: rolFilter,
        p_active_filter: activeFilter,
        p_deleted_only: deletedOnly
      })

      if (error) {
        console.error('Error loading personal:', error)
        toast.error('Error al cargar personal: ' + error.message)
        return
      }

      setPersonal(data || [])
    } catch (error) {
      console.error('Error loading personal:', error)
      toast.error('Error al cargar personal')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePersonal = async () => {
    if (!personalToDelete) return

    try {
      const { error } = await supabase.rpc('delete_supervisor', {
        p_supervisor_id: personalToDelete.id,
        p_reason: 'Eliminado desde interfaz de administración'
      })

      if (error) {
        console.error('Error deleting personal:', error)
        toast.error('Error al eliminar personal: ' + error.message)
        return
      }

      toast.success('Personal eliminado correctamente')
      loadPersonal()
    } catch (error) {
      console.error('Error deleting personal:', error)
      toast.error('Error al eliminar personal')
    } finally {
      setDeleteDialogOpen(false)
      setPersonalToDelete(null)
    }
  }

  const handleRestorePersonal = async (personalItem: Personal) => {
    try {
      console.log('Attempting to restore personal:', personalItem.id)
      
      const { data, error } = await supabase.rpc('rpc_restore_supervisor', {
        id_param: personalItem.id
      })

      console.log('Restore response:', { data, error })

      if (error) {
        console.error('Error restoring personal:', error)
        toast.error('Error al restaurar personal: ' + (error.message || JSON.stringify(error)))
        return
      }

      toast.success('Personal restaurado correctamente')
      loadPersonal()
    } catch (error) {
      console.error('Error restoring personal:', error)
      toast.error('Error al restaurar personal: ' + (error instanceof Error ? error.message : 'Error desconocido'))
    }
  }

  useEffect(() => {
    loadPersonal()
  }, [roleFilter, statusFilter])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="ml-2 h-4 w-4" />
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="ml-2 h-4 w-4" /> : 
      <ChevronDown className="ml-2 h-4 w-4" />
  }

  const sortedAndFilteredPersonal = personal
    .filter(personalItem => {
      const matchesSearch = personalItem.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           personalItem.email.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })
    .sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'nombre':
          aValue = a.nombre.toLowerCase()
          bValue = b.nombre.toLowerCase()
          break
        case 'email':
          aValue = a.email.toLowerCase()
          bValue = b.email.toLowerCase()
          break
        case 'rol':
          aValue = a.rol
          bValue = b.rol
          break
        case 'permisos_sistema':
          aValue = a.permisos_sistema
          bValue = b.permisos_sistema
          break
        case 'is_active':
          // Primero eliminados, luego inactivos, luego activos
          if (a.is_deleted !== b.is_deleted) {
            aValue = a.is_deleted ? 2 : (a.is_active ? 0 : 1)
            bValue = b.is_deleted ? 2 : (b.is_active ? 0 : 1)
          } else {
            aValue = a.is_active ? 0 : 1
            bValue = b.is_active ? 0 : 1
          }
          break
        case 'created_at':
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        default:
          return 0
      }

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1
      }
      return 0
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
      case 'no_ADMIN': return 'secondary'
      default: return 'secondary'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Cargando personal...</div>
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
            <Filter className="mr-2 h-4 w-4" />
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
              <TableHead>
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('nombre')}
                >
                  Nombre
                  {getSortIcon('nombre')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('email')}
                >
                  Email
                  {getSortIcon('email')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('rol')}
                >
                  Rol
                  {getSortIcon('rol')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('permisos_sistema')}
                >
                  Permisos
                  {getSortIcon('permisos_sistema')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('is_active')}
                >
                  Estado
                  {getSortIcon('is_active')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('created_at')}
                >
                  Fecha Creación
                  {getSortIcon('created_at')}
                </Button>
              </TableHead>
              <TableHead className="w-12">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredPersonal.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No se encontró personal
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredPersonal.map((personalItem: Personal) => (
                <TableRow key={personalItem.id}>
                  <TableCell className="font-medium">{personalItem.nombre}</TableCell>
                  <TableCell>{personalItem.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(personalItem.rol)}>
                      {ROLE_LABELS[personalItem.rol]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPermisosBadgeVariant(personalItem.permisos_sistema)}>
                      {PERMISOS_LABELS[personalItem.permisos_sistema]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {personalItem.is_deleted ? (
                      <Badge variant="destructive">Eliminado</Badge>
                    ) : personalItem.is_active ? (
                      <Badge variant="default">Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(personalItem.created_at).toLocaleDateString('es-ES')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!personalItem.is_deleted ? (
                          <>
                            <DropdownMenuItem onClick={() => setEditingPersonal(personalItem)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setPersonalToDelete(personalItem)
                                setDeleteDialogOpen(true)
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onClick={() => handleRestorePersonal(personalItem)}>
                            <RotateCcw className="mr-2 h-4 w-4" />
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

      {/* Edit Dialog */}
      {editingPersonal && (
        <EditPersonalDialog
          personal={editingPersonal}
          open={!!editingPersonal}
          onOpenChange={(open: boolean) => !open && setEditingPersonal(null)}
          onSuccess={() => {
            loadPersonal()
            setEditingPersonal(null)
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar personal?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente a <strong>{personalToDelete?.nombre}</strong> del sistema.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePersonal} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
