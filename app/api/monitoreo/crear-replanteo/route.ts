import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
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

    if (!originalId || !motivoDescartado) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    const payload: Record<string, any> = { motivo_descartado: motivoDescartado };
    if (locacion) payload["locacion"] = locacion;
    if (cod_celda) payload["cod_celda"] = cod_celda;
    if (cod_grilla) payload["cod_grilla"] = cod_grilla;
    if (este) payload["este"] = Number(este);
    if (norte) payload["norte"] = Number(norte);
    if (captura_geom_4326) payload["captura_geom_4326"] = captura_geom_4326;
    if (captura_precision_m) payload["captura_precision_m"] = Number(captura_precision_m);
    if (captura_fuente) payload["captura_fuente"] = captura_fuente;

    const supabase = await createClient();
    const { error } = await supabase.rpc("rpc_crear_replanteo", {
      original_id: originalId,
      payload,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    try { revalidatePath(revalidate_path); } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unexpected" }, { status: 500 });
  }
}
