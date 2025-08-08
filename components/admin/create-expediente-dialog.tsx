'use client'

import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Calendar } from 'lucide-react'
import { toast } from 'sonner'

interface Accion {
  codigo_accion: string
  fecha_inicio: string
  fecha_fin: string
}

interface CreateExpedienteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExpedienteCreated: () => void
}

export function CreateExpedienteDialog({
  open,
  onOpenChange,
  onExpedienteCreated
}: CreateExpedienteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    expediente_codigo: '',
    nombre: ''
  })
  const [acciones, setAcciones] = useState<Accion[]>([
    {
      codigo_accion: '',
      fecha_inicio: '',
      fecha_fin: ''
    }
  ])

  const supabase = createClientComponentClient()

  const resetForm = () => {
    setFormData({
      expediente_codigo: '',
      nombre: ''
    })
    setAcciones([{
      codigo_accion: '',
      fecha_inicio: '',
      fecha_fin: ''
    }])
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  const addAccion = () => {
    if (acciones.length >= 2) {
      toast.error('Máximo 2 acciones por expediente')
      return
    }
    
    setAcciones([...acciones, {
      codigo_accion: '',
      fecha_inicio: '',
      fecha_fin: ''
    }])
  }

  const removeAccion = (index: number) => {
    if (acciones.length === 1) {
      toast.error('Debe haber al menos una acción')
      return
    }
    
    setAcciones(acciones.filter((_, i) => i !== index))
  }

  const updateAccion = (index: number, field: keyof Accion, value: string) => {
    const newAcciones = [...acciones]
    newAcciones[index] = { ...newAcciones[index], [field]: value }
    setAcciones(newAcciones)
  }

  const validateForm = () => {
    if (!formData.expediente_codigo.trim()) {
      toast.error('El código del expediente es obligatorio')
      return false
    }

    if (!formData.nombre.trim()) {
      toast.error('El nombre del expediente es obligatorio')
      return false
    }

    // Validar acciones
    for (let i = 0; i < acciones.length; i++) {
      const accion = acciones[i]
      
      if (!accion.codigo_accion.trim()) {
        toast.error(`El código de la acción ${i + 1} es obligatorio`)
        return false
      }

      if (!accion.fecha_inicio) {
        toast.error(`La fecha de inicio de la acción ${i + 1} es obligatoria`)
        return false
      }

      if (!accion.fecha_fin) {
        toast.error(`La fecha de fin de la acción ${i + 1} es obligatoria`)
        return false
      }

      if (new Date(accion.fecha_inicio) > new Date(accion.fecha_fin)) {
        toast.error(`La fecha de inicio debe ser anterior a la fecha de fin en la acción ${i + 1}`)
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      setLoading(true)

      // Crear expediente
      const { data: expedienteData, error: expedienteError } = await supabase
        .from('expedientes')
        .insert({
          expediente_codigo: formData.expediente_codigo.trim(),
          nombre: formData.nombre.trim()
        })
        .select()
        .single()

      if (expedienteError) {
        console.error('Error creating expediente:', expedienteError)
        toast.error('Error al crear expediente')
        return
      }

      // Crear acciones
      const accionesData = acciones.map(accion => ({
        expediente_id: expedienteData.id,
        codigo_accion: accion.codigo_accion.trim(),
        fecha_inicio: accion.fecha_inicio,
        fecha_fin: accion.fecha_fin
      }))

      const { error: accionesError } = await supabase
        .from('acciones')
        .insert(accionesData)

      if (accionesError) {
        console.error('Error creating acciones:', accionesError)
        toast.error('Error al crear acciones')
        return
      }

      onExpedienteCreated()
      handleClose()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al crear expediente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Expediente</DialogTitle>
          <DialogDescription>
            Crea un nuevo expediente con sus acciones asociadas (1-2 acciones)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datos del Expediente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información del Expediente</CardTitle>
              <CardDescription>
                Datos básicos del expediente de supervisión
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="expediente_codigo">Código del Expediente *</Label>
                <Input
                  id="expediente_codigo"
                  value={formData.expediente_codigo}
                  onChange={(e) => setFormData({ ...formData, expediente_codigo: e.target.value })}
                  placeholder="Ej: EXP-2024-001"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del Expediente *</Label>
                <Textarea
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Descripción del expediente de supervisión"
                  rows={3}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Acciones */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Acciones del Expediente</CardTitle>
                  <CardDescription>
                    Define las acciones asociadas al expediente (máximo 2)
                  </CardDescription>
                </div>
                {acciones.length < 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addAccion}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Acción
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {acciones.map((accion, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">
                      <Calendar className="h-3 w-3 mr-1" />
                      Acción {index + 1}
                    </Badge>
                    {acciones.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAccion(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`codigo_accion_${index}`}>Código de Acción *</Label>
                      <Input
                        id={`codigo_accion_${index}`}
                        value={accion.codigo_accion}
                        onChange={(e) => updateAccion(index, 'codigo_accion', e.target.value)}
                        placeholder="Ej: ACC-001"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`fecha_inicio_${index}`}>Fecha Inicio *</Label>
                      <Input
                        id={`fecha_inicio_${index}`}
                        type="date"
                        value={accion.fecha_inicio}
                        onChange={(e) => updateAccion(index, 'fecha_inicio', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`fecha_fin_${index}`}>Fecha Fin *</Label>
                      <Input
                        id={`fecha_fin_${index}`}
                        type="date"
                        value={accion.fecha_fin}
                        onChange={(e) => updateAccion(index, 'fecha_fin', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Expediente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
