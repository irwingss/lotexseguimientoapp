import Link from "next/link";

export function AdminNav() {
  const items = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/personal", label: "Personal" },
    { href: "/admin/expedientes", label: "Expedientes" },
    { href: "/admin/seleccion", label: "Selección Global" },
    { href: "/admin/importar", label: "Importación" },
  ];

  return (
    <nav className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-12 flex items-center gap-4">
        <Link href="/admin" className="font-semibold text-sm">
          Admin
        </Link>
        <div className="flex items-center gap-3 text-xs md:text-sm">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {it.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
