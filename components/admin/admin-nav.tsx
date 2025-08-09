'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Shield, Users, FileText, Settings, Home } from 'lucide-react'

const adminNavItems = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: Home,
    description: 'Panel principal de administración'
  },
  {
    title: 'Personal',
    href: '/admin/personal',
    icon: Users,
    description: 'Gestión de personal del sistema'
  },
  {
    title: 'Expedientes',
    href: '/admin/expedientes',
    icon: FileText,
    description: 'Administración de expedientes'
  },
  {
    title: 'Configuración',
    href: '/admin/configuracion',
    icon: Settings,
    description: 'Configuración del sistema'
  }
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Admin Panel</span>
            </Link>
            
            <div className="hidden md:flex items-center space-x-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "flex items-center space-x-2",
                        isActive && "bg-primary text-primary-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Button>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Link href="/">
              <Button variant="outline" size="sm">
                <Home className="h-4 w-4 mr-2" />
                Volver a la App
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
