import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, FileText, Upload, BarChart3, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DonutChart } from '@/components/admin/charts/Donut'
// removed Progress; using Ring visuals
import { Ring } from '@/components/admin/charts/Ring'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Personal stats (roles/activos/eliminados)
  const { data: personalStatsArr } = await supabase.rpc('get_supervisores_stats')
  const personalStats: any = Array.isArray(personalStatsArr) ? personalStatsArr[0] : personalStatsArr

  const totalPersonal = Number(personalStats?.total_supervisores ?? 0)
  const activos = Number(personalStats?.supervisores_activos ?? 0)
  const eliminados = Number(personalStats?.supervisores_eliminados ?? 0)
  const inactivos = Math.max(totalPersonal - activos - eliminados, 0)

  // Expedientes count (activos)
  const { count: expedientesCount } = await supabase
    .from('expedientes')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', false)

  // Expedientes eliminados (para comparativa)
  const { count: expedientesEliminadosCount } = await supabase
    .from('expedientes')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', true)

  // Expediente seleccionado + resumen (usar detail para obtener id)
  const { data: selectedDetail } = await supabase.rpc('rpc_get_expediente_seleccionado_detail')
  let expSummary: any = null
  if (selectedDetail?.id) {
    const { data } = await supabase.rpc('rpc_get_expediente_summary', {
      expediente_id_param: selectedDetail.id,
    })
    expSummary = data
  }

  const expMeta = expSummary?.expediente ?? null
  const mon = expSummary?.monitoreo_stats ?? null
  const vls = expSummary?.vuelos_stats ?? null
  const marc = expSummary?.marcado_stats ?? null
  const origen = expSummary?.origen_stats ?? null

  const selectedBasic = selectedDetail ?? null

  // Porcentajes y breakdowns
  const monHecho = Number(mon?.hecho ?? 0)
  const monPend = Number(mon?.pendiente ?? 0)
  const monDesc = Number(mon?.descartado ?? 0)
  const monTotal = Math.max(Number(mon?.total ?? 0), 0)
  const monPct = Math.round(Number(mon?.porcentaje_completitud ?? (monTotal ? (monHecho / monTotal) * 100 : 0)))

  const marcHecho = Number(marc?.hecho ?? 0)
  // Fallback: if marcado_stats no está disponible aún, usar total de monitoreo para evitar mostrar 0
  const marcTotal = Math.max(Number((marc?.total ?? monTotal)), 0)
  const marcadoPct = Math.round(Number(marc?.porcentaje_completitud ?? (marcTotal ? (marcHecho / marcTotal) * 100 : 0)))

  const vlsHecho = Number(vls?.hecho ?? 0)
  const vlsPend = Number(vls?.pendiente ?? 0)
  const vlsDesc = Number(vls?.descartado ?? 0)
  const vlsTotal = Math.max(Number(vls?.total ?? 0), 0)
  const vlsPct = Math.round(Number(vls?.porcentaje_completitud ?? (vlsTotal ? (vlsHecho / vlsTotal) * 100 : 0)))

  const origenRepl = Number(origen?.replanteados ?? 0)
  const origenAnad = Number(origen?.anadidos ?? 0)
  const origenElim = Number(origen?.eliminados ?? 0)

  const vlsPAF = Number(vls?.por_tipo?.PAF ?? 0)
  const vlsPD = Number(vls?.por_tipo?.PD ?? 0)
  const vlsCP = Number(vls?.por_tipo?.CHECKPOINT ?? 0)

  return (
    <div className="space-y-6 pl-[calc(env(safe-area-inset-left)+16px)] pr-[calc(env(safe-area-inset-right)+16px)] sm:px-6 lg:px-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
          Panel de Administración
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Métricas y accesos rápidos del sistema
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Personal Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Personal</CardTitle>
            <CardDescription>Distribución por estado</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              segments={[
                { label: 'Activos', value: activos, color: 'hsl(var(--primary))' },
                { label: 'Inactivos', value: inactivos, color: 'hsl(var(--muted-foreground))' },
                { label: 'Eliminados', value: eliminados, color: 'hsl(var(--destructive))' },
              ]}
            />
          </CardContent>
        </Card>

        {/* Expedientes Totales (Activos vs Eliminados) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base">Expedientes</CardTitle>
              <CardDescription>Activos vs Eliminados</CardDescription>
            </div>
            <FileText className="h-6 w-6 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-6">
              <div>
                <div className="text-3xl font-semibold">{expedientesCount ?? 0}</div>
                <p className="text-xs text-muted-foreground">Activos</p>
              </div>
              <div>
                <div className="text-2xl font-semibold">{expedientesEliminadosCount ?? 0}</div>
                <p className="text-xs text-muted-foreground">Eliminados</p>
              </div>
            </div>
            {/* Stacked bar */}
            <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
              {(() => {
                const activosCnt = Number(expedientesCount ?? 0)
                const elimCnt = Number(expedientesEliminadosCount ?? 0)
                const total = Math.max(activosCnt + elimCnt, 0)
                const wAct = total ? (activosCnt / total) * 100 : 0
                const wElim = 100 - wAct
                return (
                  <div className="flex h-full w-full">
                    <div className="bg-primary" style={{ width: `${wAct}%` }} />
                    <div className="bg-destructive/70" style={{ width: `${wElim}%` }} />
                  </div>
                )
              })()}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Distribución de estados de expedientes</p>
          </CardContent>
        </Card>

        {/* Expediente actual (si existe) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base">Expediente actual</CardTitle>
              <CardDescription>Selección global</CardDescription>
            </div>
            <BarChart3 className="h-6 w-6 text-purple-600" />
          </CardHeader>
          <CardContent>
            {(expMeta || selectedBasic) ? (
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Código:</span> <span className="font-medium">{(expMeta?.codigo ?? selectedBasic?.expediente_codigo) ?? '—'}</span></div>
                <div><span className="text-muted-foreground">Nombre:</span> <span className="font-medium">{(expMeta?.nombre ?? selectedBasic?.nombre) ?? '—'}</span></div>
                {selectedBasic?.seleccionado_at && (
                  <div className="text-xs text-muted-foreground">Seleccionado: {new Date(selectedBasic.seleccionado_at).toLocaleString()}</div>
                )}
                {!expMeta && (
                  <div className="inline-flex items-center gap-2 text-[11px] text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded">
                    <span>Resumen no disponible</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay expediente seleccionado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen del expediente seleccionado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Puntos cargados del expediente actual</CardTitle>
          <CardDescription>Totales por tipo y estado</CardDescription>
        </CardHeader>
        <CardContent>
          {expMeta ? (
            <div className="space-y-6">
              {/* Row 1: Dual rings for Marcado and Monitoreo */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" /> Marcado
                    </h3>
                    <span className="text-xs text-muted-foreground">Total: {marcTotal}</span>
                  </div>
                  <Ring label="Completado" percent={marcadoPct} />
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" /> Monitoreo
                    </h3>
                    <span className="text-xs text-muted-foreground">Total: {monTotal}</span>
                  </div>
                  <Ring label="Completado" percent={monPct} />
                </div>
              </div>

              {/* Row 2: Origen mini KPIs */}
              <div>
                <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Origen de puntos</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground">Replanteados</div>
                    <div className="text-xl font-semibold tabular-nums">{origenRepl}</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground">Añadidos</div>
                    <div className="text-xl font-semibold tabular-nums">{origenAnad}</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground">Eliminados</div>
                    <div className="text-xl font-semibold tabular-nums">{origenElim}</div>
                  </div>
                </div>
              </div>

              {/* Row 3: Vuelos - ring + por tipo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Upload className="h-4 w-4 text-muted-foreground" /> Vuelos
                  </h3>
                  <span className="text-xs text-muted-foreground">Total: {vlsTotal}</span>
                </div>
                <div className="grid gap-6 md:grid-cols-4">
                  <div className="rounded-lg border p-4">
                    <Ring label="Marcados" percent={vlsPct} />
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground">PAF</div>
                    <div className="text-xl font-semibold tabular-nums">{vlsPAF}</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground">PD</div>
                    <div className="text-xl font-semibold tabular-nums">{vlsPD}</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs text-muted-foreground">Checkpoints</div>
                    <div className="text-xl font-semibold tabular-nums">{vlsCP}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {selectedBasic ? (
                <p className="text-sm text-blue-700 bg-blue-100/60 rounded px-2 py-1">No hay permisos para ver el resumen del expediente seleccionado.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Selecciona un expediente en "Selección Global" para ver su resumen.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Accesos rápidos */}
      <div className="grid gap-4 md:grid-cols-4 items-stretch">
        <Card className="hover:shadow-sm transition-shadow h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base">Personal</CardTitle>
              <CardDescription>Gestionar personal</CardDescription>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </CardHeader>
          <CardContent className="mt-auto">
            <Link href="/admin/personal"><Button size="sm">Ir</Button></Link>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base">Expedientes</CardTitle>
              <CardDescription>Crea expedientes y gestiona su personal</CardDescription>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground" />
          </CardHeader>
          <CardContent className="mt-auto">
            <Link href="/admin/expedientes"><Button size="sm">Ir</Button></Link>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base">Selección Global</CardTitle>
              <CardDescription>Cambia el expediente seleccionado</CardDescription>
            </div>
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </CardHeader>
          <CardContent className="mt-auto">
            <Link href="/admin/seleccion"><Button size="sm">Ir</Button></Link>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-base">Importación</CardTitle>
              <CardDescription>Importar tablas de puntos de muestreo, PAFs, despegue, checkpoints</CardDescription>
            </div>
            <Upload className="h-8 w-8 text-muted-foreground" />
          </CardHeader>
          <CardContent className="mt-auto">
            <Link href="/admin/importar"><Button size="sm">Ir</Button></Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
