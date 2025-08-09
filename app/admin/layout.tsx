import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminNav } from '@/components/admin/AdminNav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Verificar autenticación
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }

  // Verificar permisos ADMIN usando RPC corregido (solo verifica permisos_sistema = 'ADMIN')
  const { data: isAdmin, error: permError } = await supabase
    .rpc('is_admin')
  
  // Debug: Log para diagnosticar el problema
  console.log('AdminLayout Debug:', {
    userEmail: user.email,
    isAdmin,
    permError
  })
  
  // Si hay error o no es admin, denegar acceso
  if (permError || !isAdmin) {
    console.log('AdminLayout: Acceso denegado - Error o usuario sin permisos ADMIN:', permError?.message)
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="container mx-auto py-6">
        {children}
      </main>
    </div>
  )
}
