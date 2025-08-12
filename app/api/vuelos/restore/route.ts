import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST form fields expected:
// - id: uuid (vuelo item id)

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const id = String(form.get('id') || '')

    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('rpc_restore_vuelo_item', {
      id_param: id,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error inesperado' }, { status: 500 })
  }
}
