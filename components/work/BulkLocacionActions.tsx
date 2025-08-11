"use client";

import React, { useRef, useState } from "react";
import { OfflineQueueForm } from "@/components/work/OfflineQueueForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type PreviewResult = {
  dry_run: boolean;
  total_puntos: number;
  puntos_afectados: number;
  expediente_id: string;
  locacion: string;
  nuevo_status: string;
  accion_id?: string | null;
  motivo?: string | null;
};

export function BulkLocacionActions({ expedienteId }: { expedienteId: string }) {
  return (
    <div className="rounded border p-3 space-y-4">
      <h3 className="text-sm font-medium">Acciones masivas por locación</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BulkMarcadoForm expedienteId={expedienteId} />
        <BulkMonitoreoForm expedienteId={expedienteId} />
      </div>
    </div>
  );
}

function BulkMarcadoForm({ expedienteId }: { expedienteId: string }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function onPreview(e: React.MouseEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("dry_run", "true");
    try {
      setLoading(true);
      const res = await fetch("/api/monitoreo/bulk-marcado", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Preview failed");
      setPreview(json.result as PreviewResult);
      setOpen(true);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function onConfirm() {
    // Ensure dry_run=false then submit; OfflineQueueForm will queue if offline
    if (!formRef.current) return;
    const dryRun = formRef.current.querySelector<HTMLInputElement>('input[name="dry_run"]');
    if (dryRun) dryRun.value = "false";
    formRef.current.requestSubmit();
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Marcado por locación</h4>
      <OfflineQueueForm
        ref={formRef as any}
        endpoint="/api/monitoreo/bulk-marcado"
        className="grid grid-cols-1 md:grid-cols-6 gap-3"
        offlineDesc={`bulk-marcado:${expedienteId}`}
      >
        <input type="hidden" name="expediente_id" value={expedienteId} />
        <input type="hidden" name="revalidate_path" value="/expedientes" />
        <input type="hidden" name="dry_run" value="false" />
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground">Locación*</label>
          <input name="locacion" className="h-9 rounded border px-2 text-sm" placeholder="L1" required />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground">Status</label>
          <select name="status" className="h-9 rounded border px-2 text-sm">
            <option value="PENDIENTE">PENDIENTE</option>
            <option value="HECHO">HECHO</option>
            <option value="DESCARTADO">DESCARTADO</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input id="only_unset_m" name="only_unset" type="checkbox" defaultChecked className="h-4 w-4" />
          <label htmlFor="only_unset_m" className="text-xs text-muted-foreground">Sólo PENDIENTES</label>
        </div>
        <div className="flex flex-col md:col-span-2">
          <label className="text-xs text-muted-foreground">Motivo (si DESCARTADO)</label>
          <input name="motivo" className="h-9 rounded border px-2 text-sm" placeholder="Justificación" />
        </div>
        <div className="flex items-end gap-2">
          <button onClick={onPreview} className="h-9 px-3 rounded border text-sm" disabled={loading}>Previsualizar</button>
          <button type="submit" className="h-9 px-3 rounded bg-primary text-primary-foreground text-sm">Aplicar</button>
        </div>
      </OfflineQueueForm>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar acción masiva (Marcado)</AlertDialogTitle>
            <AlertDialogDescription>
              {preview ? (
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Locación:</span> {preview.locacion}</div>
                  <div><span className="text-muted-foreground">Status:</span> {preview.nuevo_status}</div>
                  <div><span className="text-muted-foreground">Total puntos:</span> {preview.total_puntos}</div>
                  <div><span className="text-muted-foreground">Afectados:</span> {preview.puntos_afectados}</div>
                </div>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BulkMonitoreoForm({ expedienteId }: { expedienteId: string }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function onPreview(e: React.MouseEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("dry_run", "true");
    try {
      setLoading(true);
      const res = await fetch("/api/monitoreo/bulk-monitoreo", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Preview failed");
      setPreview(json.result as PreviewResult);
      setOpen(true);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function onConfirm() {
    if (!formRef.current) return;
    const dryRun = formRef.current.querySelector<HTMLInputElement>('input[name="dry_run"]');
    if (dryRun) dryRun.value = "false";
    formRef.current.requestSubmit();
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Monitoreo por locación</h4>
      <OfflineQueueForm
        ref={formRef as any}
        endpoint="/api/monitoreo/bulk-monitoreo"
        className="grid grid-cols-1 md:grid-cols-6 gap-3"
        offlineDesc={`bulk-monitoreo:${expedienteId}`}
      >
        <input type="hidden" name="expediente_id" value={expedienteId} />
        <input type="hidden" name="revalidate_path" value="/expedientes" />
        <input type="hidden" name="dry_run" value="false" />
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground">Locación*</label>
          <input name="locacion" className="h-9 rounded border px-2 text-sm" placeholder="L1" required />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground">Status</label>
          <select name="status" className="h-9 rounded border px-2 text-sm">
            <option value="PENDIENTE">PENDIENTE</option>
            <option value="HECHO">HECHO</option>
            <option value="DESCARTADO">DESCARTADO</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-muted-foreground">Acción (si HECHO)</label>
          <input name="accion_id" className="h-9 rounded border px-2 text-sm" placeholder="UUID de acción (opcional)" />
        </div>
        <div className="flex items-center gap-2">
          <input id="only_unset_o" name="only_unset" type="checkbox" defaultChecked className="h-4 w-4" />
          <label htmlFor="only_unset_o" className="text-xs text-muted-foreground">Sólo PENDIENTES</label>
        </div>
        <div className="flex flex-col md:col-span-2">
          <label className="text-xs text-muted-foreground">Motivo (si DESCARTADO)</label>
          <input name="motivo" className="h-9 rounded border px-2 text-sm" placeholder="Justificación" />
        </div>
        <div className="flex items-end gap-2">
          <button onClick={onPreview} className="h-9 px-3 rounded border text-sm" disabled={loading}>Previsualizar</button>
          <button type="submit" className="h-9 px-3 rounded bg-primary text-primary-foreground text-sm">Aplicar</button>
        </div>
      </OfflineQueueForm>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar acción masiva (Monitoreo)</AlertDialogTitle>
            <AlertDialogDescription>
              {preview ? (
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Locación:</span> {preview.locacion}</div>
                  <div><span className="text-muted-foreground">Status:</span> {preview.nuevo_status}</div>
                  <div><span className="text-muted-foreground">Acción:</span> {preview.accion_id || "(auto)"}</div>
                  <div><span className="text-muted-foreground">Total puntos:</span> {preview.total_puntos}</div>
                  <div><span className="text-muted-foreground">Afectados:</span> {preview.puntos_afectados}</div>
                </div>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
