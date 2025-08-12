import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { ExpedienteWorkHeader } from "@/components/work/ExpedienteWorkHeader";
import { PuntosTable } from "@/components/work/PuntosTable";
import { VuelosTab } from "@/components/work/VuelosTab";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GeoCapture } from "@/components/work/GeoCapture";
import { OfflineQueueForm } from "@/components/work/OfflineQueueForm";

// Note: Next.js requires a default export for route segments
export default async function Page({
  params,
  searchParams,
}: {
  params?: Promise<{ "expediente-id": string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  redirect("/expedientes");
  // Normalize params/searchParams for Next 14/15 differences (can be Promises)
  const p: any = params ? await (params as any) : undefined;
  const sp: any = searchParams ? await (searchParams as any) : {};
  const expedienteId = p?.["expediente-id"]; // UUID
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
  const locacion = typeof sp.locacion === "string" ? sp.locacion : null;
  const estatusParams = sp.estatus;
  const estatus = Array.isArray(estatusParams)
    ? (estatusParams as string[])
    : typeof estatusParams === "string"
    ? [estatusParams]
    : null; // null -> no filter (all)
  const q = typeof sp.q === "string" ? sp.q : null;

  // Pagination
  const page = Number(sp.page ?? 1);
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
            Error cargando datos: {anyError?.message}
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

      {/* Añadir punto (ANADIDO) */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Añadir punto</h2>
        <OfflineQueueForm action={crearAnadidoAction} endpoint="/api/monitoreo/crear-anadido" className="grid grid-cols-1 md:grid-cols-6 gap-3 rounded border p-3" offlineDesc={`crear-anadido:${expedienteId}`}>
          <input type="hidden" name="expediente_id" value={expedienteId} />
          <input type="hidden" name="revalidate_path" value={`/expedientes/${expedienteId}`} />
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Locación*</label>
            <input name="locacion" className="h-9 rounded border px-2 text-sm" placeholder="L1" required />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Código punto campo*</label>
            <input name="cod_punto_campo" className="h-9 rounded border px-2 text-sm" placeholder="P-001" required />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Código colectora*</label>
            <input name="cod_colectora" className="h-9 rounded border px-2 text-sm" placeholder="C-001" required />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Este*</label>
            <input name="este" type="number" step="any" className="h-9 rounded border px-2 text-sm" required />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Norte*</label>
            <input name="norte" type="number" step="any" className="h-9 rounded border px-2 text-sm" required />
          </div>
          <div className="flex flex-col md:col-span-2">
            <label className="text-xs text-muted-foreground">Motivo*</label>
            <input name="motivo" className="h-9 rounded border px-2 text-sm" placeholder="Justificación" required />
          </div>
          <div className="md:col-span-3">
            <label className="text-xs text-muted-foreground">Coordenadas del dispositivo (opcional)</label>
            <GeoCapture />
          </div>
          <div className="flex items-end md:col-span-2">
            <button type="submit" className="h-9 px-4 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700">Crear añadido</button>
          </div>
        </OfflineQueueForm>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Puntos</h2>
        <PuntosTable 
          rows={puntos ?? []}
          expedienteId={expedienteId}
          setMarcadoAction={setMarcadoAction}
          setMonitoreoAction={setMonitoreoAction}
          crearReplanteoAction={crearReplanteoAction}
        />
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

// Server actions: set marcado/monitoreo status for a punto
async function setMarcadoAction(formData: FormData) {
  "use server";
  const puntoId = formData.get("punto_id") as string | null;
  const status = formData.get("status") as string | null;
  const motivo = (formData.get("motivo") as string | null) ?? null;
  const revalidate_path = (formData.get("revalidate_path") as string | null) ?? "/expedientes";
  if (!puntoId || !status) return;
  if (status === "DESCARTADO" && (!motivo || !motivo.trim())) {
    // UI-level enforcement: motivo requerido si DESCARTADO
    return;
  }
  const supabase = await createClient();
  // If DESCARTADO requires motivo; backend also enforces via checks/triggers
  const update: Record<string, any> = { marcado_status: status };
  update["marcado_motivo"] = status === "DESCARTADO" ? motivo ?? "" : null;
  const { error } = await supabase
    .from("monitoreo_puntos")
    .update(update)
    .eq("id", puntoId);
  if (error) {
    // Surface error via console on server; UI will refresh regardless
    console.error("setMarcadoAction error", error.message);
  }
  revalidatePath(revalidate_path);
}

async function setMonitoreoAction(formData: FormData) {
  "use server";
  const puntoId = formData.get("punto_id") as string | null;
  const status = formData.get("status") as string | null;
  const motivo = (formData.get("motivo") as string | null) ?? null;
  const accionId = (formData.get("accion_id") as string | null) ?? null;
  const revalidate_path = (formData.get("revalidate_path") as string | null) ?? "/expedientes";
  if (!puntoId || !status) return;
  if (status === "DESCARTADO" && (!motivo || !motivo.trim())) {
    return;
  }
  const supabase = await createClient();
  const update: Record<string, any> = { monitoreado_status: status };
  update["monitoreado_motivo"] = status === "DESCARTADO" ? motivo ?? "" : null;
  if (status === "HECHO") {
    // If provided, set accion_id; otherwise leave null to auto-assign by trigger
    update["monitoreado_accion_id"] = accionId ?? null;
  } else {
    update["monitoreado_accion_id"] = null;
  }
  const { error } = await supabase
    .from("monitoreo_puntos")
    .update(update)
    .eq("id", puntoId);
  if (error) {
    console.error("setMonitoreoAction error", error.message);
  }
  revalidatePath("/expedientes");
}

// Server actions: crear REPLANTEO / ANADIDO
async function crearReplanteoAction(formData: FormData) {
  "use server";
  const originalId = formData.get("original_id") as string | null;
  const motivoDescartado = formData.get("motivo_descartado") as string | null;
  const revalidate_path = (formData.get("revalidate_path") as string | null) ?? "/expedientes";
  const locacion = (formData.get("locacion") as string | null) ?? null;
  const cod_celda = (formData.get("cod_celda") as string | null) ?? null;
  const cod_grilla = (formData.get("cod_grilla") as string | null) ?? null;
  const este = (formData.get("este") as string | null) ?? null;
  const norte = (formData.get("norte") as string | null) ?? null;
  const captura_geom_4326 = (formData.get("captura_geom_4326") as string | null) ?? null;
  const captura_precision_m = (formData.get("captura_precision_m") as string | null) ?? null;
  const captura_fuente = (formData.get("captura_fuente") as string | null) ?? null;
  const supabase = await createClient();
  if (!originalId || !motivoDescartado) return;
  const payload: Record<string, any> = {
    motivo_descartado: motivoDescartado,
  };
  if (locacion) payload["locacion"] = locacion;
  if (cod_celda) payload["cod_celda"] = cod_celda;
  if (cod_grilla) payload["cod_grilla"] = cod_grilla;
  if (este) payload["este"] = Number(este);
  if (norte) payload["norte"] = Number(norte);
  if (captura_geom_4326) payload["captura_geom_4326"] = captura_geom_4326;
  if (captura_precision_m) payload["captura_precision_m"] = Number(captura_precision_m);
  if (captura_fuente) payload["captura_fuente"] = captura_fuente;
  const { error } = await supabase.rpc("rpc_crear_replanteo", {
    original_id: originalId,
    payload,
  });
  if (error) {
    console.error("crearReplanteoAction error", error.message);
  }
  revalidatePath(revalidate_path);
}

async function crearAnadidoAction(formData: FormData) {
  "use server";
  const expedienteId = formData.get("expediente_id") as string | null;
  const revalidate_path = (formData.get("revalidate_path") as string | null) ?? "/expedientes";
  const locacion = formData.get("locacion") as string | null;
  const cod_punto_campo = formData.get("cod_punto_campo") as string | null;
  const cod_colectora = formData.get("cod_colectora") as string | null;
  const este = formData.get("este") as string | null;
  const norte = formData.get("norte") as string | null;
  const motivo = formData.get("motivo") as string | null;
  const captura_geom_4326 = (formData.get("captura_geom_4326") as string | null) ?? null;
  const captura_precision_m = (formData.get("captura_precision_m") as string | null) ?? null;
  const captura_fuente = (formData.get("captura_fuente") as string | null) ?? null;
  if (!expedienteId || !locacion || !cod_punto_campo || !cod_colectora || !este || !norte || !motivo) return;
  const payload = {
    locacion,
    cod_punto_campo,
    cod_colectora,
    este: Number(este),
    norte: Number(norte),
    motivo,
    ...(captura_geom_4326 ? { captura_geom_4326 } : {}),
    ...(captura_precision_m ? { captura_precision_m: Number(captura_precision_m) } : {}),
    ...(captura_fuente ? { captura_fuente } : {}),
  };
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_crear_anadido", {
    expediente_id: expedienteId,
    payload,
  });
  if (error) {
    console.error("crearAnadidoAction error", error.message);
  }
  revalidatePath(revalidate_path);
}
