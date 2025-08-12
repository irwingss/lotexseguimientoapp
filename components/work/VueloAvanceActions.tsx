"use client"

import React, { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { OfflineQueueForm } from '@/components/work/OfflineQueueForm'

type Props = {
  vueloId: string
}

export function VueloAvanceActions({ vueloId }: Props) {
  const marcadoRef = useRef<HTMLFormElement | null>(null)
  const voladoRef = useRef<HTMLFormElement | null>(null)

  const submitMarcado = async (status: 'PENDIENTE' | 'HECHO' | 'DESCARTADO') => {
    const form = marcadoRef.current
    if (!form) return
    const statusInput = form.querySelector<HTMLInputElement>('input[name="status"]')!
    const motivoInput = form.querySelector<HTMLInputElement>('input[name="motivo"]')!

    statusInput.value = status
    motivoInput.value = ''

    if (status === 'DESCARTADO') {
      const motivo = window.prompt('Ingrese motivo de descarte')
      if (!motivo || !motivo.trim()) return
      motivoInput.value = motivo.trim()
    }
    form.requestSubmit()
  }

  const submitVolado = async (status: 'PENDIENTE' | 'HECHO' | 'DESCARTADO') => {
    const form = voladoRef.current
    if (!form) return
    const statusInput = form.querySelector<HTMLInputElement>('input[name="status"]')!
    const motivoInput = form.querySelector<HTMLInputElement>('input[name="motivo"]')!

    statusInput.value = status
    motivoInput.value = ''

    if (status === 'DESCARTADO') {
      const motivo = window.prompt('Ingrese motivo de descarte (volado)')
      if (!motivo || !motivo.trim()) return
      motivoInput.value = motivo.trim()
    }
    form.requestSubmit()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground w-14">Marcado:</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => submitMarcado('PENDIENTE')}>Pend</Button>
          <Button size="sm" onClick={() => submitMarcado('HECHO')}>Hecho</Button>
          <Button size="sm" variant="destructive" onClick={() => submitMarcado('DESCARTADO')}>Desc</Button>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground w-14">Volado:</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => submitVolado('PENDIENTE')}>Pend</Button>
          <Button size="sm" onClick={() => submitVolado('HECHO')}>Hecho</Button>
          <Button size="sm" variant="destructive" onClick={() => submitVolado('DESCARTADO')}>Desc</Button>
        </div>
      </div>

      {/* Hidden forms for offline queue support */}
      <OfflineQueueForm ref={marcadoRef} className="hidden" endpoint="/api/vuelos/marcado" offlineDesc={`Vuelo ${vueloId}: set marcado`}>
        <input type="hidden" name="vuelo_id" value={vueloId} />
        <input type="hidden" name="status" />
        <input type="hidden" name="motivo" />
      </OfflineQueueForm>

      <OfflineQueueForm ref={voladoRef} className="hidden" endpoint="/api/vuelos/volado" offlineDesc={`Vuelo ${vueloId}: set volado`}>
        <input type="hidden" name="vuelo_id" value={vueloId} />
        <input type="hidden" name="status" />
        <input type="hidden" name="motivo" />
      </OfflineQueueForm>
    </div>
  )
}
