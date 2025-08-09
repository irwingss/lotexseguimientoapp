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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Calendar } from 'lucide-react'
// import { toast } from 'sonner' // Removed for now

interface Accion {
  id?: string
  codigo_accion: string
  fecha_inicio: string
  fecha_fin: string
}

interface Expediente {
  id: string
  expediente_codigo: string
  nombre: string
  acciones?: Array<{
    id: string
    codigo_accion: string
    fecha_inicio: string
    fecha_fin: string
  }>
}

interface EditExpedienteDialogProps {
  expediente: Expediente
  open: boolean
  onOpenChange: (open: boolean) => void
  onExpedienteUpdated: () => void
}

export function EditExpedienteDialog({
  expediente,
  open,
  onOpenChange,
  onExpedienteUpdated
}: EditExpedienteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    expediente_codigo: '',
    nombre: ''
  })
  const [acciones, setAcciones] = useState<Accion[]>([])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (expediente && open) {
      setFormData({
        expediente_codigo: expediente.expediente_codigo,
        nombre: expediente.nombre
      })
      
      const expedienteAcciones = expediente.acciones || []
      if (expedienteAcciones.length === 0) {
        setAcciones([{
          codigo_accion: '',
          fecha_inicio: '',
          fecha_fin: ''
        }])
      } else {
        setAcciones(expedienteAcciones.map(accion => ({
          id: accion.id,
          codigo_accion: accion.codigo_accion,
          fecha_inicio: accion.fecha_inicio,
          fecha_fin: accion.fecha_fin
        })))
      }
    }
  }, [expediente, open])

  const handleClose = () => {
    onOpenChange(false)
  }

  const addAccion = () => {
    if (acciones.length >= 2) {
      console.error('Máximo 2 acciones por expediente')
      return
    }
    
    setAcciones([...acciones, {
      codigo_accion: '',
      fecha_inicio: '',
      fecha_fin: ''
    }])
  }

  const removeAccion = async (index: number) => {
    if (acciones.length === 1) {
      console.error('Debe haber al menos una acción')
      return
    }

    const accion = acciones[index]
    
    // Si la acción tiene ID, la eliminamos de la base de datos
    if (accion.id) {
      try {
        const { error } = await supabase.rpc('rpc_soft_delete_accion', {
          accion_id: accion.id,
          delete_reason: 'Eliminada durante edición de expediente'
        })

        if (error) {
          console.error('Error deleting accion:', error)
          console.error('Error al eliminar acción')
          return
        }
      } catch (error) {
        console.error('Error:', error)
        console.error('Error al eliminar acción')
        return
      }
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
      console.error('El código del expediente es obligatorio')
      return false
    }

    if (!formData.nombre.trim()) {
      console.error('El nombre del expediente es obligatorio')
      return false
    }

    // Validar acciones
    for (let i = 0; i < acciones.length; i++) {
      const accion = acciones[i]
      
      if (!accion.codigo_accion.trim()) {
        console.error(`El código de la acción ${i + 1} es obligatorio`)
        return false
      }

      if (!accion.fecha_inicio) {
        console.error(`La fecha de inicio de la acción ${i + 1} es obligatoria`)
        return false
      }

      if (!accion.fecha_fin) {
        console.error(`La fecha de fin de la acción ${i + 1} es obligatoria`)
        return false
      }

      if (new Date(accion.fecha_inicio) > new Date(accion.fecha_fin)) {
        console.error(`La fecha de inicio debe ser anterior a la fecha de fin en la acción ${i + 1}`)
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

      // Actualizar expediente usando función RPC
      const { error: expedienteError } = await supabase.rpc('update_expediente', {
        p_expediente_id: expediente.id,
        p_expediente_codigo: formData.expediente_codigo.trim(),
        p_nombre: formData.nombre.trim()
      })

      if (expedienteError) {
        console.error('Error updating expediente:', expedienteError)
        console.error('Error al actualizar expediente: ' + expedienteError.message)
        return
      }

      // Procesar acciones usando funciones RPC
      for (const accion of acciones) {
        if (accion.codigo_accion.trim()) { // Solo procesar acciones con código
          if (accion.id) {
            // Actualizar acción existente usando función RPC
            const { error } = await supabase.rpc('update_accion', {
              p_accion_id: accion.id,
              p_codigo_accion: accion.codigo_accion.trim(),
              p_fecha_inicio: accion.fecha_inicio,
              p_fecha_fin: accion.fecha_fin
            })

            if (error) {
              console.error('Error updating accion:', error)
              console.error('Error al actualizar acción: ' + error.message)
              return
            }
          } else {
            // Crear nueva acción usando función RPC
            const { error } = await supabase.rpc('create_accion', {
              p_expediente_id: expediente.id,
              p_codigo_accion: accion.codigo_accion.trim(),
              p_fecha_inicio: accion.fecha_inicio,
              p_fecha_fin: accion.fecha_fin
            })

            if (error) {
              console.error('Error creating accion:', error)
              console.error('Error al crear acción: ' + error.message)
              return
            }
          }
        }
      }

      onExpedienteUpdated()
      handleClose()
    } catch (error) {
      console.error('Error:', error)
      console.error('Error al actualizar expediente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Expediente</DialogTitle>
          <DialogDescription>
            Modifica la información del expediente y sus acciones asociadas
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
                    Modifica las acciones asociadas al expediente (máximo 2)
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
                <div key={accion.id || index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant={accion.id ? "default" : "secondary"}>
                      <Calendar className="h-3 w-3 mr-1" />
                      Acción {index + 1} {accion.id ? '(Existente)' : '(Nueva)'}
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
              {loading ? 'Actualizando...' : 'Actualizar Expediente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
