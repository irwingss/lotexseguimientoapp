import Link from "next/link";
import { MobileAdminSidebar } from "./MobileAdminSidebar";

export function AdminNav() {
  const items = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/expedientes", label: "Expedientes" },
    { href: "/admin/seleccion", label: "Selección Global" },
    { href: "/admin/importar", label: "Importación" },
    { href: "/admin/personal", label: "Personal" },
  ];

  return (
    <nav className="w-full border-b bg-background shadow-sm">
      <div className="max-w-screen-2xl mx-auto pl-[calc(env(safe-area-inset-left)+16px)] pr-[calc(env(safe-area-inset-right)+16px)] sm:px-6 lg:px-8 py-2">
        {/* Mobile: hamburger + slide-over sidebar */}
        <div className="md:hidden">
          <MobileAdminSidebar items={items} />
        </div>
        {/* Desktop: inline nav */}
        <div className="hidden md:flex items-center justify-between">
          <Link href="/admin" className="font-semibold text-sm">Admin</Link>
          <div className="flex items-center gap-4 text-sm">
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
      </div>
    </nav>
  );
}
