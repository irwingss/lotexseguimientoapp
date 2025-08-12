import Link from "next/link";

export function AdminNav() {
  const items = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/expedientes", label: "Expedientes" },
    { href: "/admin/seleccion", label: "Selección Global" },
    { href: "/admin/importar", label: "Importación" },
    { href: "/admin/personal", label: "Personal" },
  ];

  return (
    <nav className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-screen-2xl mx-auto pl-[calc(env(safe-area-inset-left)+16px)] pr-[calc(env(safe-area-inset-right)+16px)] sm:px-6 lg:px-8 py-2">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:items-center">
          <Link href="/admin" className="font-semibold text-sm">Admin</Link>
          <div className="flex items-center gap-3 text-xs md:text-sm overflow-x-auto">
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                {it.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
