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

export function PuntosTable({ rows }: { rows: PuntoRow[] }) {
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
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/40">
              <td className="px-3 py-2">{r.locacion ?? ''}</td>
              <td className="px-3 py-2">{r.cod_celda ?? ''}</td>
              <td className="px-3 py-2">{r.cod_grilla ?? ''}</td>
              <td className="px-3 py-2 font-medium">{r.cod_punto_campo ?? ''}</td>
              <td className="px-3 py-2">{r.marcado_status}</td>
              <td className="px-3 py-2">{r.monitoreado_status}</td>
              <td className="px-3 py-2">{r.estatus}</td>
              <td className="px-3 py-2">{formatDateTime(r.updated_at)}</td>
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
