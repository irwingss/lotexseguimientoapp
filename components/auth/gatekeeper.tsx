'use client'

import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface GatekeeperProps {
  children: React.ReactNode
}

export function Gatekeeper({ children }: GatekeeperProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuthorization = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user || !user.email) {
          setIsAuthorized(false)
          setIsLoading(false)
          return
        }

        setUserEmail(user.email)

        // Check if user email exists in supervisores table and is active
        const { data: supervisor, error } = await supabase
          .from('supervisores')
          .select('id, email, is_active, is_deleted')
          .eq('email', user.email)
          .eq('is_active', true)
          .eq('is_deleted', false)
          .single()

        if (error || !supervisor) {
          console.log('User not found in supervisores or not active:', error)
          setIsAuthorized(false)
        } else {
          setIsAuthorized(true)
        }
      } catch (error) {
        console.error('Error checking authorization:', error)
        setIsAuthorized(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuthorization()
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
          <p className="mt-2 text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    )
  }

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-red-600">
              Acceso Denegado
            </CardTitle>
            <CardDescription>
              No tienes autorización para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Usuario no autorizado
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>
                        El email <strong>{userEmail}</strong> no está registrado como supervisor activo en el sistema OEFA.
                      </p>
                      <p className="mt-2">
                        Contacta al administrador del sistema para solicitar acceso.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full"
              >
                Cerrar Sesión
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
