'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface UserInfo {
  email: string
  name: string
  role: string
  permisos_sistema: string
}

export default function DashboardPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUserInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user?.email) {
          const { data: supervisor } = await supabase
            .from('supervisores')
            .select('nombre, email, rol, permisos_sistema')
            .eq('email', user.email)
            .eq('is_active', true)
            .eq('is_deleted', false)
            .single()

          if (supervisor) {
            setUserInfo({
              email: supervisor.email,
              name: supervisor.nombre,
              role: supervisor.rol,
              permisos_sistema: supervisor.permisos_sistema
            })
          }
        }
      } catch (error) {
        console.error('Error getting user info:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getUserInfo()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                OEFA - Lote X
              </h1>
              <p className="text-sm text-gray-600">
                Seguimiento de Supervisión Ambiental
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {userInfo && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {userInfo.name}
                  </p>
                  <p className="text-xs text-gray-600">
                    {userInfo.role} • {userInfo.permisos_sistema}
                  </p>
                </div>
              )}
              <Button onClick={handleLogout} variant="outline">
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <Card>
            <CardHeader>
              <CardTitle>Bienvenido al Sistema</CardTitle>
              <CardDescription>
                Sistema de seguimiento de actividades de supervisión ambiental
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Expedientes</CardTitle>
                    <CardDescription>
                      Gestionar expedientes de supervisión
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" disabled>
                      Próximamente
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Monitoreo</CardTitle>
                    <CardDescription>
                      Puntos de monitoreo y avance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" disabled>
                      Próximamente
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Vuelos</CardTitle>
                    <CardDescription>
                      Gestión de vuelos y avance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" disabled>
                      Próximamente
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {userInfo?.permisos_sistema === 'ADMIN' && (
                <div className="mt-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Administración
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Supervisores</CardTitle>
                        <CardDescription>
                          Gestionar usuarios del sistema
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full" disabled>
                          Próximamente
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Importaciones</CardTitle>
                        <CardDescription>
                          Importar datos desde Excel
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full" disabled>
                          Próximamente
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
