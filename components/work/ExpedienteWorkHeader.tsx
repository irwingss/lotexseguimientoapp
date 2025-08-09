type PuntoCount = { estatus: string; total: number }

type VueloCount = { kind: 'marcado' | 'volado'; status: 'PENDIENTE' | 'HECHO' | 'DESCARTADO'; total: number }

export function ExpedienteWorkHeader({
  puntosCounts,
  vuelosCounts,
}: {
  puntosCounts: PuntoCount[]
  vuelosCounts: VueloCount[]
}) {
  const puntos = normalizeCounts(puntosCounts)
  const vuelos = normalizeVueloCounts(vuelosCounts)

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded border p-3">
        <div className="text-xs text-muted-foreground">Puntos – Estatus</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(puntos).map(([k, v]) => (
            <Badge key={k} label={`${k}: ${v}`} />
          ))}
        </div>
      </div>

      <div className="rounded border p-3">
        <div className="text-xs text-muted-foreground">Vuelos – Marcado</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(vuelos.marcado).map(([k, v]) => (
            <Badge key={`m-${k}`} label={`${k}: ${v}`} />
          ))}
        </div>
      </div>

      <div className="rounded border p-3">
        <div className="text-xs text-muted-foreground">Vuelos – Volado</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(vuelos.volado).map(([k, v]) => (
            <Badge key={`v-${k}`} label={`${k}: ${v}`} />
          ))}
        </div>
      </div>
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

function normalizeCounts(arr: PuntoCount[]) {
  const map: Record<string, number> = {}
  for (const r of arr ?? []) {
    map[r.estatus] = (map[r.estatus] ?? 0) + Number(r.total ?? 0)
  }
  return map
}

function normalizeVueloCounts(arr: VueloCount[]) {
  const init = { marcado: {} as Record<string, number>, volado: {} as Record<string, number> }
  for (const r of arr ?? []) {
    const bucket = r.kind === 'marcado' ? 'marcado' : 'volado'
    init[bucket][r.status] = (init[bucket][r.status] ?? 0) + Number(r.total ?? 0)
  }
  return init
}
