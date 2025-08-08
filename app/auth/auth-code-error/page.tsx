import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-red-600">
            Error de Autenticación
          </CardTitle>
          <CardDescription>
            Hubo un problema durante el proceso de login
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
                    Error en el proceso de autenticación
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>
                      No se pudo completar el proceso de login con Google. 
                      Esto puede deberse a:
                    </p>
                    <ul className="mt-2 list-disc list-inside">
                      <li>Cancelación del proceso de login</li>
                      <li>Problemas de configuración</li>
                      <li>Problemas temporales de conectividad</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <Link href="/login">
              <Button className="w-full">
                Intentar de Nuevo
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
