'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

type SupervisorRole = 'SUPERVISOR' | 'SUPERVISOR_LIDER' | 'MONITOR' | 'CONDUCTOR' | 'RESPONSABLE_OIG'
type PermisosSystem = 'ADMIN' | 'no_ADMIN'

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

interface EditPersonalDialogProps {
  personal: Personal
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
  { value: 'no_ADMIN', label: 'Usuario', description: 'Acceso limitado según rol asignado' }
]

export function EditPersonalDialog({ personal, open, onOpenChange, onSuccess }: EditPersonalDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    rol: '' as SupervisorRole,
    permisos_sistema: 'no_ADMIN' as PermisosSystem,
    is_active: true
  })

  const supabase = createClient()

  useEffect(() => {
    if (personal) {
      setFormData({
        nombre: personal.nombre,
        email: personal.email,
        rol: personal.rol,
        permisos_sistema: personal.permisos_sistema,
        is_active: personal.is_active
      })
    }
  }, [personal])

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
        p_supervisor_id: personal.id,
        p_nombre: formData.nombre.trim(),
        p_email: formData.email.trim().toLowerCase(),
        p_rol: formData.rol,
        p_permisos_sistema: formData.permisos_sistema,
        p_is_active: formData.is_active
      })

      if (error) {
        console.error('Error updating personal:', error)
        toast.error('Error al actualizar personal: ' + error.message)
        return
      }

      toast.success('Personal actualizado correctamente')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error updating personal:', error)
      toast.error('Error al actualizar personal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Personal</DialogTitle>
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
              placeholder="ejemplo@oefa.gob.pe"
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
                {ROLE_OPTIONS.map((option) => (
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
                {PERMISOS_OPTIONS.map((option) => (
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
            <Label htmlFor="is_active">Personal activo</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Actualizar Personal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
