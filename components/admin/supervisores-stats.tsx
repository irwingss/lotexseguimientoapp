'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, UserCheck, UserX, Shield } from 'lucide-react'

interface SupervisoresStats {
  total_supervisores: number
  supervisores_activos: number
  supervisores_eliminados: number
  por_rol: Record<string, number>
}

const ROLE_LABELS: Record<string, string> = {
  'SUPERVISOR': 'Supervisores',
  'SUPERVISOR_LIDER': 'Supervisores Líderes',
  'MONITOR': 'Monitores',
  'CONDUCTOR': 'Conductores',
  'RESPONSABLE_OIG': 'Responsables OIG'
}

export function SupervisoresStats() {
  const [stats, setStats] = useState<SupervisoresStats | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const loadStats = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase.rpc('get_supervisores_stats')

      if (error) {
        console.error('Error loading stats:', error)
        return
      }

      if (data && data.length > 0) {
        setStats(data[0])
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">No se pudieron cargar las estadísticas</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Supervisores */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Supervisores</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_supervisores}</div>
          <p className="text-xs text-muted-foreground">
            Registrados en el sistema
          </p>
        </CardContent>
      </Card>

      {/* Supervisores Activos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Activos</CardTitle>
          <UserCheck className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.supervisores_activos}</div>
          <p className="text-xs text-muted-foreground">
            Con acceso al sistema
          </p>
        </CardContent>
      </Card>

      {/* Supervisores Eliminados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Eliminados</CardTitle>
          <UserX className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{stats.supervisores_eliminados}</div>
          <p className="text-xs text-muted-foreground">
            Soft delete aplicado
          </p>
        </CardContent>
      </Card>

      {/* Por Rol */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Por Roles</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.por_rol && Object.entries(stats.por_rol).map(([rol, count]) => (
              <div key={rol} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABELS[rol] || rol}
                </span>
                <Badge variant="outline" className="text-xs">
                  {count}
                </Badge>
              </div>
            ))}
            {(!stats.por_rol || Object.keys(stats.por_rol).length === 0) && (
              <p className="text-xs text-muted-foreground">Sin datos</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
