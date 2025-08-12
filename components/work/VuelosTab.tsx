import { VueloAvanceActions } from '@/components/work/VueloAvanceActions'

type VueloRow = {
  id: string
  item: number | null
  tipo: string
  codigo: string | null
  marcado_status: string
  volado_status: string
  updated_at: string | null
}

type VueloCount = { kind: 'marcado' | 'volado'; status: 'PENDIENTE' | 'HECHO' | 'DESCARTADO'; total: number }

export function VuelosTab({ rows, counts }: { rows: VueloRow[]; counts: VueloCount[] }) {
  const resumen = normalize(counts)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge label={`Marcado PENDIENTE: ${resumen.marcado.PENDIENTE ?? 0}`} />
        <Badge label={`Marcado HECHO: ${resumen.marcado.HECHO ?? 0}`} />
        <Badge label={`Marcado DESCARTADO: ${resumen.marcado.DESCARTADO ?? 0}`} />
        <Badge label={`Volado PENDIENTE: ${resumen.volado.PENDIENTE ?? 0}`} />
        <Badge label={`Volado HECHO: ${resumen.volado.HECHO ?? 0}`} />
        <Badge label={`Volado DESCARTADO: ${resumen.volado.DESCARTADO ?? 0}`} />
      </div>

      {(!rows || rows.length === 0) ? (
        <div className="rounded border p-4 text-sm text-muted-foreground">No hay items de vuelo para mostrar.</div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Marcado</th>
                <th className="px-3 py-2 text-left">Volado</th>
                <th className="px-3 py-2 text-left">Actualizado</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-2">{r.item ?? ''}</td>
                  <td className="px-3 py-2">{r.tipo}</td>
                  <td className="px-3 py-2 font-medium">{r.codigo ?? ''}</td>
                  <td className="px-3 py-2">{r.marcado_status}</td>
                  <td className="px-3 py-2">{r.volado_status}</td>
                  <td className="px-3 py-2">{formatDateTime(r.updated_at)}</td>
                  <td className="px-3 py-2">
                    <VueloAvanceActions vueloId={r.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-xs">
      {label}
    </span>
  )
}

function normalize(arr: VueloCount[]) {
  const init = {
    marcado: { PENDIENTE: 0, HECHO: 0, DESCARTADO: 0 } as Record<string, number>,
    volado: { PENDIENTE: 0, HECHO: 0, DESCARTADO: 0 } as Record<string, number>,
  }
  for (const r of arr ?? []) {
    const bucket = r.kind === 'marcado' ? 'marcado' : 'volado'
    init[bucket][r.status] = (init[bucket][r.status] ?? 0) + Number(r.total ?? 0)
  }
  return init
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
