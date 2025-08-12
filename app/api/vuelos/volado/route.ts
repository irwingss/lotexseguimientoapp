import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST form fields expected:
// - vuelo_id: uuid
// - status: 'PENDIENTE' | 'HECHO' | 'DESCARTADO'
// - motivo?: string (required if status='DESCARTADO')
// - precision?: number (optional)
// - fuente?: string (optional)

const STATUS = new Set(['PENDIENTE', 'HECHO', 'DESCARTADO'])

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const vuelo_id = String(form.get('vuelo_id') || '')
    const status = String(form.get('status') || '')
    const motivo = (form.get('motivo') ?? null) as string | null
    const precision = form.get('precision') ? Number(form.get('precision')) : null
    const fuente = (form.get('fuente') ?? null) as string | null

    if (!vuelo_id) return NextResponse.json({ error: 'vuelo_id requerido' }, { status: 400 })
    if (!STATUS.has(status)) return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    if (status === 'DESCARTADO' && (!motivo || !motivo.trim())) {
      return NextResponse.json({ error: 'motivo requerido para DESCARTADO' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('rpc_set_vuelo_volado', {
      p_vuelo_id: vuelo_id,
      p_status: status,
      p_motivo: motivo,
      p_captura_geom: null,
      p_captura_precision: precision,
      p_captura_fuente: fuente,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error inesperado' }, { status: 500 })
  }
}
