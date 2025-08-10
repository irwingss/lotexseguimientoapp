import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
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

    if (!expedienteId || !locacion || !cod_punto_campo || !cod_colectora || !este || !norte || !motivo) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    const payload: Record<string, any> = {
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
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    try { revalidatePath(revalidate_path); } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unexpected" }, { status: 500 });
  }
}
