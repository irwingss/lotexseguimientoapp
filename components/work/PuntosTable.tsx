import { GeoCapture } from "./GeoCapture"
import { OfflineQueueForm } from "./OfflineQueueForm"
type PuntoRow = {
  id: string
  locacion: string | null
  cod_celda: string | null
  cod_grilla: string | null
  cod_punto_campo: string | null
  marcado_status: string
  monitoreado_status: string
  estatus: string
  updated_at: string | null
}

export function PuntosTable({
  rows,
  expedienteId,
  setMarcadoAction,
  setMonitoreoAction,
  crearReplanteoAction,
}: {
  rows: PuntoRow[]
  expedienteId: string
  setMarcadoAction: (formData: FormData) => Promise<void>
  setMonitoreoAction: (formData: FormData) => Promise<void>
  crearReplanteoAction: (formData: FormData) => Promise<void>
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded border p-4 text-sm text-muted-foreground">No hay puntos para mostrar.</div>
    )
  }

  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Locación</th>
            <th className="px-3 py-2 text-left">Celda</th>
            <th className="px-3 py-2 text-left">Grilla</th>
            <th className="px-3 py-2 text-left">Código</th>
            <th className="px-3 py-2 text-left">Marcado</th>
            <th className="px-3 py-2 text-left">Monitoreado</th>
            <th className="px-3 py-2 text-left">Estatus</th>
            <th className="px-3 py-2 text-left">Actualizado</th>
            <th className="px-3 py-2 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/40">
              <td className="px-3 py-2">{r.locacion ?? ''}</td>
              <td className="px-3 py-2">{r.cod_celda ?? ''}</td>
              <td className="px-3 py-2">{r.cod_grilla ?? ''}</td>
              <td className="px-3 py-2 font-medium">{r.cod_punto_campo ?? ''}</td>
              <td className="px-3 py-2">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">{r.marcado_status}</div>
                  <OfflineQueueForm action={setMarcadoAction} endpoint="/api/monitoreo/set-marcado" className="flex flex-col md:flex-row gap-2" offlineDesc={`set-marcado:${r.id}`}>
                    <input type="hidden" name="punto_id" value={r.id} />
                    <input type="hidden" name="revalidate_path" value={`/expedientes`} />
                    <select name="status" className="h-8 rounded border px-2 text-xs">
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="HECHO">HECHO</option>
                      <option value="DESCARTADO">DESCARTADO</option>
                    </select>
                    <input name="motivo" className="h-8 rounded border px-2 text-xs" placeholder="Motivo si DESCARTADO" />
                    <button type="submit" className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs">Guardar</button>
                  </OfflineQueueForm>
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">{r.monitoreado_status}</div>
                  <OfflineQueueForm action={setMonitoreoAction} endpoint="/api/monitoreo/set-monitoreo" className="flex flex-col md:flex-row gap-2" offlineDesc={`set-monitoreo:${r.id}`}>
                    <input type="hidden" name="punto_id" value={r.id} />
                    <input type="hidden" name="revalidate_path" value={`/expedientes`} />
                    <select name="status" className="h-8 rounded border px-2 text-xs">
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="HECHO">HECHO</option>
                      <option value="DESCARTADO">DESCARTADO</option>
                    </select>
                    <input name="accion_id" className="h-8 rounded border px-2 text-xs" placeholder="Acción (opcional)" />
                    <input name="motivo" className="h-8 rounded border px-2 text-xs" placeholder="Motivo si DESCARTADO" />
                    <button type="submit" className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs">Guardar</button>
                  </OfflineQueueForm>
                </div>
              </td>
              <td className="px-3 py-2">{r.estatus}</td>
              <td className="px-3 py-2">{formatDateTime(r.updated_at)}</td>
              <td className="px-3 py-2">
                <OfflineQueueForm action={crearReplanteoAction} endpoint="/api/monitoreo/crear-replanteo" className="flex flex-col md:flex-row gap-2" offlineDesc={`crear-replanteo:${r.id}`}>
                  <input type="hidden" name="original_id" value={r.id} />
                  <input type="hidden" name="revalidate_path" value={`/expedientes`} />
                  <input name="motivo_descartado" className="h-8 rounded border px-2 text-xs" placeholder="Motivo replanteo*" required />
                  <input name="locacion" defaultValue={r.locacion ?? ''} className="h-8 rounded border px-2 text-xs" placeholder="Locación (opcional)" />
                  <GeoCapture />
                  <button type="submit" className="h-8 px-3 rounded bg-amber-600 text-white text-xs hover:bg-amber-700">Replantear</button>
                </OfflineQueueForm>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatDateTime(iso: string | null) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString()
  } catch {
    return ''
  }
}
