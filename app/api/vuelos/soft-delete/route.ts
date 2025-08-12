import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST form fields expected:
// - id: uuid (vuelo item id)
// - reason?: string
// - precision?: number
// - lat?, lon? (optional; capture not wired yet)

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const id = String(form.get('id') || '')
    const reason = (form.get('reason') ?? null) as string | null
    const precision = form.get('precision') ? Number(form.get('precision')) : null

    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('rpc_soft_delete_vuelo_item', {
      id_param: id,
      geom4326_param: null,
      precision_m_param: precision,
      reason_param: reason,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error inesperado' }, { status: 500 })
  }
}
