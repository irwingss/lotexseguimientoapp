import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function toBool(v: FormDataEntryValue | null): boolean | undefined {
  if (v == null) return undefined;
  const s = String(v).toLowerCase();
  if (s === "true" || s === "1" || s === "on" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return undefined;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const expedienteId = formData.get("expediente_id") as string | null;
    const revalidate_path = (formData.get("revalidate_path") as string | null) ?? "/expedientes";
    const locacion = formData.get("locacion") as string | null;
    const status = formData.get("status") as string | null; // 'HECHO' | 'PENDIENTE' | 'DESCARTADO'
    const motivo = (formData.get("motivo") as string | null) ?? null;
    const onlyUnset = toBool(formData.get("only_unset"));
    const dryRun = toBool(formData.get("dry_run"));

    if (!expedienteId || !locacion || !status) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }
    if (status === "DESCARTADO" && (!motivo || !motivo.trim())) {
      return NextResponse.json({ ok: false, error: "Motivo es obligatorio para DESCARTADO" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("rpc_bulk_update_locacion_marcado", {
      p_expediente_id: expedienteId,
      p_locacion: locacion,
      p_status: status,
      p_motivo: motivo,
      p_only_unset: onlyUnset ?? true,
      p_dry_run: dryRun ?? false,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!dryRun) {
      try { revalidatePath(revalidate_path); } catch {}
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unexpected" }, { status: 500 });
  }
}
