import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { ExpedienteWorkHeader } from "@/components/work/ExpedienteWorkHeader";
import { PuntosTable } from "@/components/work/PuntosTable";
import { VuelosTab } from "@/components/work/VuelosTab";
import { revalidatePath } from "next/cache";
import { GeoCapture } from "@/components/work/GeoCapture";
import { OfflineQueueForm } from "@/components/work/OfflineQueueForm";
import { BulkLocacionActions } from "@/components/work/BulkLocacionActions";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Normalize searchParams for Next 14/15 (can be Promise)
  const sp: any = searchParams ? await (searchParams as any) : {};

  const supabase = await createClient();

  // Access control and selected expediente
  const { data: isAdmin } = await supabase.rpc("is_admin");
  const { data: selectedExpedienteId } = await supabase.rpc(
    "rpc_get_expediente_seleccionado"
  );
  // Fetch basic expediente info for header
  const { data: selectedDetail } = await supabase
    .from("expedientes")
    .select("expediente_codigo,nombre")
    .eq("id", selectedExpedienteId)
    .single();

  if (!selectedExpedienteId) {
    // No seleccionado
    return (
      <div className="space-y-6 pl-[calc(env(safe-area-inset-left)+16px)] pr-[calc(env(safe-area-inset-right)+16px)] sm:pl-0 sm:pr-0 max-w-screen-2xl mx-auto">
        <h1 className="text-xl md:text-2xl font-semibold">Detalle de expediente</h1>
        <div className="text-sm text-muted-foreground">
          {isAdmin ? (
            <>
              No hay expediente seleccionado globalmente. Ve a <a className="underline" href="/admin/seleccion">Admin → Selección</a> para establecerlo.
            </>
          ) : (
            <>No hay expediente seleccionado. Pide a un ADMIN que establezca uno.</>
          )}
        </div>
      </div>
    );
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
    { p_expediente_id: selectedExpedienteId }
  );

  // Fetch list (puntos)
  const { data: puntos, error: puntosErr } = await supabase.rpc(
    "rpc_get_monitoreo_puntos",
    {
      p_expediente_id: selectedExpedienteId,
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
    { p_expediente_id: selectedExpedienteId }
  );

  const { data: vuelos, error: vuelosErr } = await supabase.rpc(
    "rpc_get_vuelos_items",
    {
      p_expediente_id: selectedExpedienteId,
      p_tipo: null,
      p_search: q,
      p_limit: limit,
      p_offset: offset,
    }
  );

  const anyError = puntosCountsErr || puntosErr || vuelosCountsErr || vuelosErr;

  return (
    <div className="space-y-6 pl-[calc(env(safe-area-inset-left)+16px)] pr-[calc(env(safe-area-inset-right)+16px)] sm:pl-0 sm:pr-0 max-w-screen-2xl mx-auto">
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
        {isAdmin ? (
          <div className="text-xs text-muted-foreground">
            Para cambiar el seleccionado, ve a <a className="underline" href="/admin/seleccion">Admin → Selección</a>.
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

        {/* Acciones masivas por locación */}
        {selectedExpedienteId ? (
          <BulkLocacionActions expedienteId={selectedExpedienteId} />
        ) : null}
      </header>

      {/* Añadir punto (ANADIDO) */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Añadir punto</h2>
        <OfflineQueueForm action={crearAnadidoAction} endpoint="/api/monitoreo/crear-anadido" className="grid grid-cols-1 md:grid-cols-6 gap-3 rounded border p-3" offlineDesc={`crear-anadido:${selectedExpedienteId}`}>
          <input type="hidden" name="expediente_id" value={selectedExpedienteId} />
          <input type="hidden" name="revalidate_path" value={`/expedientes`} />
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
          expedienteId={selectedExpedienteId}
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
  const update: Record<string, any> = { marcado_status: status };
  update["marcado_motivo"] = status === "DESCARTADO" ? motivo ?? "" : null;
  const { error } = await supabase
    .from("monitoreo_puntos")
    .update(update)
    .eq("id", puntoId);
  if (error) {
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
  revalidatePath(revalidate_path);
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
