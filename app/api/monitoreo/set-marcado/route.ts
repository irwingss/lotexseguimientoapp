import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const puntoId = formData.get("punto_id") as string | null;
    const status = formData.get("status") as string | null;
    const motivo = (formData.get("motivo") as string | null) ?? null;
    const revalidate_path = (formData.get("revalidate_path") as string | null) ?? "/expedientes";

    if (!puntoId || !status) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }
    if (status === "DESCARTADO" && (!motivo || !motivo.trim())) {
      return NextResponse.json({ ok: false, error: "Motivo requerido cuando DESCARTADO" }, { status: 400 });
    }

    const supabase = await createClient();
    const update: Record<string, any> = { marcado_status: status };
    update["marcado_motivo"] = status === "DESCARTADO" ? motivo ?? "" : null;

    const { error } = await supabase.from("monitoreo_puntos").update(update).eq("id", puntoId);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    try { revalidatePath(revalidate_path); } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unexpected" }, { status: 500 });
  }
}
