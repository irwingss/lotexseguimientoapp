import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { ExpedienteWorkHeader } from "@/components/work/ExpedienteWorkHeader";
import { PuntosTable } from "@/components/work/PuntosTable";
import { VuelosTab } from "@/components/work/VuelosTab";

// Note: Next.js requires a default export for route segments
export default async function Page({
  params,
  searchParams,
}: {
  params: { "expediente-id": string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const expedienteId = params["expediente-id"]; // UUID
  const supabase = await createClient();
  
  // Access control: determine ADMIN and selected expediente
  const { data: isAdmin, error: isAdminErr } = await supabase.rpc("is_admin");
  const { data: selectedExpedienteId, error: selectedErr } = await supabase.rpc(
    "rpc_get_expediente_seleccionado"
  );
  const { data: selectedDetail } = await supabase.rpc(
    "rpc_get_expediente_seleccionado_detail"
  );
  
  // Gate for non-ADMIN: must match globally selected expediente
  if (!isAdmin) {
    if (!selectedExpedienteId) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold">403 • Acceso restringido</h1>
          <p className="text-sm text-muted-foreground mt-2">
            No hay un expediente seleccionado globalmente. Pide a un ADMIN que establezca uno.
          </p>
        </div>
      );
    }
    if (selectedExpedienteId !== expedienteId) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold">403 • Acceso restringido</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Solo puedes acceder al expediente seleccionado globalmente.
          </p>
        </div>
      );
    }
  }

  // Read filters from URL
  const locacion = typeof searchParams.locacion === "string" ? searchParams.locacion : null;
  const estatusParams = searchParams.estatus;
  const estatus = Array.isArray(estatusParams)
    ? (estatusParams as string[])
    : typeof estatusParams === "string"
    ? [estatusParams]
    : null; // null -> no filter (all)
  const q = typeof searchParams.q === "string" ? searchParams.q : null;

  // Pagination
  const page = Number(searchParams.page ?? 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  // Fetch counts (puntos)
  const { data: puntosCounts, error: puntosCountsErr } = await supabase.rpc(
    "rpc_get_monitoreo_puntos_counts",
    { p_expediente_id: expedienteId }
  );

  // Fetch list (puntos)
  const { data: puntos, error: puntosErr } = await supabase.rpc(
    "rpc_get_monitoreo_puntos",
    {
      p_expediente_id: expedienteId,
      p_locacion: locacion,
      p_estatus_filter: estatus as any, // enum[] on SQL side
      p_search: q,
      p_limit: limit,
      p_offset: offset,
    }
  );

  // Fetch vuelos (counts + list)
  const { data: vuelosCounts, error: vuelosCountsErr } = await supabase.rpc(
    "rpc_get_vuelos_items_counts",
    { p_expediente_id: expedienteId }
  );

  const { data: vuelos, error: vuelosErr } = await supabase.rpc(
    "rpc_get_vuelos_items",
    {
      p_expediente_id: expedienteId,
      p_tipo: null,
      p_search: q,
      p_limit: limit,
      p_offset: offset,
    }
  );

  const anyError = puntosCountsErr || puntosErr || vuelosCountsErr || vuelosErr;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-4">
        <h1 className="text-xl md:text-2xl font-semibold">Detalle de expediente</h1>
        {/* Global badge visible to all */}
        <div className="text-xs inline-flex items-center gap-2 rounded border px-2 py-1 bg-muted/40">
          <span className="text-muted-foreground">Expediente seleccionado:</span>
          <span className="font-medium">
            {selectedDetail?.expediente_codigo ?? "—"}
          </span>
          {selectedDetail?.nombre ? (
            <span className="text-muted-foreground">— {selectedDetail?.nombre}</span>
          ) : null}
        </div>
        {/* ADMIN helper: show current selected and quick set */}
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Seleccionado global: {selectedExpedienteId ?? "—"}
            </span>
            {selectedExpedienteId !== expedienteId && (
              <SetSeleccionadoForm expedienteId={expedienteId} />
            )}
          </div>
        ) : null}
        {anyError ? (
          <p className="text-sm text-red-600">
            Error cargando datos: {anyError.message}
          </p>
        ) : null}
        <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando resumen…</div>}>
          <ExpedienteWorkHeader puntosCounts={puntosCounts ?? []} vuelosCounts={vuelosCounts ?? []} />
        </Suspense>

        {/* Filtros básicos (GET) */}
        <form className="flex flex-wrap gap-3 items-end" action="" method="get">
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Locación</label>
            <input
              name="locacion"
              defaultValue={locacion ?? ""}
              className="h-9 rounded border px-2 text-sm"
              placeholder="Ej. L1"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Buscar (código punto)</label>
            <input
              name="q"
              defaultValue={q ?? ""}
              className="h-9 rounded border px-2 text-sm"
              placeholder="Ej. P-001"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Estatus</label>
            <select name="estatus" multiple defaultValue={estatus ?? ["PENDIENTE","MARCADO","MONITOREADO","DESCARTADO"]} className="h-20 rounded border px-2 text-sm min-w-48">
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="MARCADO">MARCADO</option>
              <option value="MONITOREADO">MONITOREADO</option>
              <option value="DESCARTADO">DESCARTADO</option>
              <option value="REPLANTEADO">REPLANTEADO</option>
              <option value="ANADIDO">ANADIDO</option>
              <option value="MARCADO_Y_MONITOREADO">MARCADO_Y_MONITOREADO</option>
            </select>
          </div>
          <button type="submit" className="h-9 px-4 rounded bg-primary text-primary-foreground text-sm">Aplicar</button>
        </form>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Puntos</h2>
        <PuntosTable rows={puntos ?? []} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Vuelos</h2>
        <VuelosTab rows={vuelos ?? []} counts={vuelosCounts ?? []} />
      </section>
    </div>
  );
}

// Admin-only form to set global selected expediente
async function setSeleccionadoAction(formData: FormData) {
  "use server";
  const p_expediente_id = formData.get("expediente_id") as string | null;
  if (!p_expediente_id) return;
  const supabase = await createClient();
  await supabase.rpc("rpc_set_expediente_seleccionado", { p_expediente_id });
}

function SetSeleccionadoForm({ expedienteId }: { expedienteId: string }) {
  return (
    <form action={setSeleccionadoAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="expediente_id" value={expedienteId} />
      <button type="submit" className="h-8 px-3 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-700">
        Establecer como seleccionado
      </button>
    </form>
  );
}
