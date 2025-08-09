'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Users, Calendar, Archive } from 'lucide-react'

interface Expediente {
  id: string
  expediente_codigo: string
  nombre: string
  created_at: string
  is_deleted: boolean
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

interface ExpedientesStatsProps {
  expedientes: Expediente[]
}

export function ExpedientesStats({ expedientes }: ExpedientesStatsProps) {
  const activeExpedientes = expedientes.filter(e => !e.is_deleted)
  
  const totalAcciones = expedientes.reduce((acc, exp) => 
    acc + (exp.acciones?.length || 0), 0
  )
  
  const totalSupervisoresAsignados = expedientes.reduce((acc, exp) => 
    acc + (exp.supervisores_asignados?.length || 0), 0
  )

  const stats = [
    {
      title: 'Expedientes Activos',
      value: activeExpedientes.length,
      description: 'Expedientes en curso',
      icon: FileText,
      color: 'text-blue-600'
    },
    {
      title: 'Total Acciones',
      value: totalAcciones,
      description: 'Acciones registradas',
      icon: Calendar,
      color: 'text-green-600'
    },
    {
      title: 'Supervisores Asignados',
      value: totalSupervisoresAsignados,
      description: 'Asignaciones totales',
      icon: Users,
      color: 'text-purple-600'
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
