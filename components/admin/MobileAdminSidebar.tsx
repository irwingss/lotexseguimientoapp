"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Menu, X } from "lucide-react"

type Item = { href: string; label: string }

export function MobileAdminSidebar({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false)

  // Close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="md:hidden">
      {/* Top bar with hamburger */}
      <div className="flex items-center justify-between h-12 px-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 text-foreground">
        <div className="font-semibold text-sm">Admin</div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Abrir menú"
          aria-expanded={open}
          aria-controls="admin-mobile-sidebar"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Overlay + Sidebar */}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside
            id="admin-mobile-sidebar"
            className="absolute left-0 top-0 h-full w-72 max-w-[85vw] border-r shadow-lg flex flex-col bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80 text-foreground"
          >
            <div className="flex items-center justify-between p-3 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
              <div className="font-semibold">Navegación</div>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border px-2 py-1 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="p-2 space-y-1">
              {items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className="block rounded-md px-3 py-3 text-base hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  {it.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  )
}
