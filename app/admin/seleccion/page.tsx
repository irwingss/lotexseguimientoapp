import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Next.js App Router requires a default export
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();

  // Ensure only ADMINs use this page (layout should already enforce)
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">403 • Solo ADMIN</h1>
        <p className="text-sm text-muted-foreground mt-2">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  // Handle both Next versions (sync and async searchParams)
  let q: string | null = null;
  const spMaybe: any = searchParams as any;
  if (spMaybe && typeof spMaybe.then === "function") {
    const sp = await spMaybe;
    q = typeof sp?.q === "string" ? sp.q : null;
  } else {
    q = typeof spMaybe?.q === "string" ? spMaybe.q : null;
  }

  // Current selected detail for context
  const { data: selectedDetail } = await supabase.rpc("rpc_get_expediente_seleccionado_detail");

  // List expedientes (RLS applies)
  const { data: expedientes, error: listErr } = await supabase.rpc("rpc_list_expedientes", {
    p_q: q,
    p_limit: 50,
    p_offset: 0,
  });

  const err = listErr?.message;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <h1 className="text-xl md:text-2xl font-semibold">Selección Global de Expediente</h1>
        <p className="text-sm text-muted-foreground">
          Define el expediente visible para usuarios no-ADMIN. Esta acción es global.
        </p>
        <div className="text-xs inline-flex items-center gap-2 rounded border px-2 py-1 bg-muted/40">
          <span className="text-muted-foreground">Actual:</span>
          <span className="font-medium">{selectedDetail?.expediente_codigo ?? "—"}</span>
          {selectedDetail?.nombre ? (
            <span className="text-muted-foreground">— {selectedDetail?.nombre}</span>
          ) : null}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar expedientes</CardTitle>
          <CardDescription>Filtra por código o nombre</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap gap-3 items-end" action="" method="get">
            <div className="flex flex-col">
              <label className="text-xs text-muted-foreground">Buscar</label>
              <input
                name="q"
                defaultValue={q ?? ""}
                className="h-9 rounded border px-2 text-sm"
                placeholder="Código o nombre"
              />
            </div>
            <Button type="submit" size="sm">Aplicar</Button>
          </form>

          {err ? (
            <p className="text-sm text-red-600">Error: {err}</p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Código</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(expedientes ?? []).map((row: any) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2 pr-3 font-medium">{row.expediente_codigo}</td>
                    <td className="py-2 pr-3">{row.nombre}</td>
                    <td className="py-2 pr-3">
                      <SetSeleccionadoForm expedienteId={row.id} disabled={selectedDetail?.id === row.id} />
                    </td>
                  </tr>
                ))}
                {(!expedientes || expedientes.length === 0) && (
                  <tr>
                    <td className="py-4" colSpan={3}>
                      <span className="text-sm text-muted-foreground">Sin resultados</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function setSeleccionadoAction(formData: FormData) {
  "use server";
  const p_expediente_id = formData.get("expediente_id") as string | null;
  if (!p_expediente_id) return;
  const supabase = await createClient();
  // p_expediente_id is a UUID string; pass it directly to the RPC
  const { error } = await supabase.rpc("rpc_set_expediente_seleccionado", { p_expediente_id });
  if (error) {
    console.error("rpc_set_expediente_seleccionado error", error);
    throw new Error("No se pudo establecer el expediente seleccionado");
  }
  // Revalidate selection page and the root layout (badge)
  revalidatePath("/admin/seleccion");
  revalidatePath("/", "layout");
}

function SetSeleccionadoForm({ expedienteId, disabled }: { expedienteId: string; disabled?: boolean }) {
  return (
    <form action={setSeleccionadoAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="expediente_id" value={expedienteId} />
      <Button type="submit" size="sm" disabled={!!disabled}>
        {disabled ? "Seleccionado" : "Establecer"}
      </Button>
    </form>
  );
}
