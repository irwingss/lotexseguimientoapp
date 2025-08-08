'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

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

interface EditSupervisorDialogProps {
  supervisor: Supervisor
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const ROLE_OPTIONS: { value: SupervisorRole; label: string }[] = [
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'SUPERVISOR_LIDER', label: 'Supervisor Líder' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'CONDUCTOR', label: 'Conductor' },
  { value: 'RESPONSABLE_OIG', label: 'Responsable OIG' }
]

const PERMISOS_OPTIONS: { value: PermisosSystem; label: string; description: string }[] = [
  { value: 'ADMIN', label: 'Administrador', description: 'Acceso completo al sistema' },
  { value: 'SUPERVISOR', label: 'Supervisor', description: 'Acceso a funciones de supervisión' },
  { value: 'MONITOR', label: 'Monitor', description: 'Acceso básico de monitoreo' }
]

export function EditSupervisorDialog({ supervisor, open, onOpenChange, onSuccess }: EditSupervisorDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nombre: supervisor.nombre,
    email: supervisor.email,
    rol: supervisor.rol,
    permisos_sistema: supervisor.permisos_sistema,
    is_active: supervisor.is_active
  })

  const supabase = createClient()

  // Update form data when supervisor changes
  useEffect(() => {
    setFormData({
      nombre: supervisor.nombre,
      email: supervisor.email,
      rol: supervisor.rol,
      permisos_sistema: supervisor.permisos_sistema,
      is_active: supervisor.is_active
    })
  }, [supervisor])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.nombre.trim() || !formData.email.trim() || !formData.rol) {
      toast.error('Por favor completa todos los campos requeridos')
      return
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast.error('Por favor ingresa un email válido')
      return
    }

    try {
      setLoading(true)

      const { data, error } = await supabase.rpc('update_supervisor', {
        p_supervisor_id: supervisor.id,
        p_nombre: formData.nombre.trim(),
        p_email: formData.email.trim().toLowerCase(),
        p_rol: formData.rol,
        p_permisos_sistema: formData.permisos_sistema,
        p_is_active: formData.is_active
      })

      if (error) {
        console.error('Error updating supervisor:', error)
        toast.error('Error al actualizar supervisor: ' + error.message)
        return
      }

      toast.success('Supervisor actualizado correctamente')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error updating supervisor:', error)
      toast.error('Error al actualizar supervisor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Supervisor</DialogTitle>
          <DialogDescription>
            Modifica la información del supervisor. Solo usuarios ADMIN pueden realizar esta acción.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre completo *</Label>
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              placeholder="Ingresa el nombre completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="supervisor@oefa.gob.pe"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rol">Rol *</Label>
            <Select value={formData.rol} onValueChange={(value) => setFormData(prev => ({ ...prev, rol: value as SupervisorRole }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permisos">Permisos del sistema</Label>
            <Select value={formData.permisos_sistema} onValueChange={(value) => setFormData(prev => ({ ...prev, permisos_sistema: value as PermisosSystem }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISOS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is_active">Usuario activo</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Actualizar Supervisor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
