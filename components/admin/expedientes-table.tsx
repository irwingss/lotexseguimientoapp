'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MoreHorizontal, Edit, Trash2, RotateCcw, Users, Calendar, Eye } from 'lucide-react'
import { EditExpedienteDialog } from '@/components/admin/edit-expediente-dialog'
import { AssignPersonalDialog } from '@/components/admin/assign-personal-dialog'
// import { toast } from 'sonner' // Removed for now
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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

interface ExpedientesTableProps {
  expedientes: Expediente[]
  loading: boolean
  onExpedienteUpdated: () => void
  onExpedienteDeleted: () => void
  onExpedienteRestored: () => void
}

export function ExpedientesTable({
  expedientes,
  loading,
  onExpedienteUpdated,
  onExpedienteDeleted,
  onExpedienteRestored
}: ExpedientesTableProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedExpediente, setSelectedExpediente] = useState<Expediente | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleEdit = (expediente: Expediente) => {
    setSelectedExpediente(expediente)
    setEditDialogOpen(true)
  }

  const handleAssign = (expediente: Expediente) => {
    setSelectedExpediente(expediente)
    setAssignDialogOpen(true)
  }

  const handleDeleteClick = (expediente: Expediente) => {
    setSelectedExpediente(expediente)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedExpediente) return

    try {
      setActionLoading(selectedExpediente.id)
      
      const { error } = await supabase.rpc('rpc_soft_delete_expediente', {
        expediente_id: selectedExpediente.id,
        delete_reason: 'Eliminado desde panel de administración'
      })

      if (error) {
        console.error('Error deleting expediente:', error)
        console.error('Error al eliminar expediente')
        return
      }

      onExpedienteDeleted()
      setDeleteDialogOpen(false)
      setSelectedExpediente(null)
    } catch (error) {
      console.error('Error:', error)
      console.error('Error al eliminar expediente')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRestore = async (expediente: Expediente) => {
    try {
      setActionLoading(expediente.id)
      
      const { error } = await supabase.rpc('rpc_restore_expediente', {
        expediente_id: expediente.id
      })

      if (error) {
        console.error('Error restoring expediente:', error)
        console.error('Error al restaurar expediente')
        return
      }

      onExpedienteRestored()
    } catch (error) {
      console.error('Error:', error)
      console.error('Error al restaurar expediente')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expedientes</CardTitle>
          <CardDescription>Cargando expedientes...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (expedientes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expedientes</CardTitle>
          <CardDescription>No se encontraron expedientes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Eye className="h-8 w-8 mb-2" />
            <p>No hay expedientes para mostrar</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Expedientes</CardTitle>
          <CardDescription>
            Lista de todos los expedientes del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Creado por</TableHead>
                <TableHead>Acciones</TableHead>
                <TableHead>Personal</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expedientes.map((expediente) => (
                <TableRow key={expediente.id}>
                  <TableCell className="font-medium">
                    {expediente.expediente_codigo}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate">
                      {expediente.nombre}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">
                        {expediente.supervisor_creador?.nombre || 'N/A'}
                      </div>
                      <div className="text-muted-foreground">
                        {expediente.supervisor_creador?.email || 'N/A'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {expediente.acciones?.length || 0}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {expediente.supervisores_asignados?.length || 0}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(expediente.created_at), 'dd/MM/yyyy', { locale: es })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={expediente.is_deleted ? 'destructive' : 'default'}>
                      {expediente.is_deleted ? 'Eliminado' : 'Activo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          disabled={actionLoading === expediente.id}
                        >
                          <span className="sr-only">Abrir menú</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {!expediente.is_deleted ? (
                          <>
                            <DropdownMenuItem onClick={() => handleEdit(expediente)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAssign(expediente)}>
                              <Users className="mr-2 h-4 w-4" />
                              Asignar Personal
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(expediente)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onClick={() => handleRestore(expediente)}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Restaurar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {selectedExpediente && (
        <EditExpedienteDialog
          expediente={selectedExpediente}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onExpedienteUpdated={onExpedienteUpdated}
        />
      )}

      {/* Assign Personal Dialog */}
      {selectedExpediente && (
        <AssignPersonalDialog
          expediente={{
            // Spread base fields
            ...(selectedExpediente as any),
            // Normalize assigned supervisors to flat shape expected by dialog
            supervisores_asignados: (selectedExpediente.supervisores_asignados || []).map((s) => ({
              id: s.supervisor.id,
              nombre: s.supervisor.nombre,
              email: s.supervisor.email,
              rol: s.supervisor.rol,
              activo: true,
            })),
          } as any}
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          onAssignmentComplete={onExpedienteUpdated}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el expediente "{selectedExpediente?.nombre}".
              El expediente se marcará como eliminado pero se podrá restaurar posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={actionLoading === selectedExpediente?.id}
            >
              {actionLoading === selectedExpediente?.id ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
