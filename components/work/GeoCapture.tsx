"use client"

import { useState } from "react"

export function GeoCapture() {
  const [geojson, setGeojson] = useState<string>("")
  const [precision, setPrecision] = useState<number | null>(null)
  const [source, setSource] = useState<string>("")
  const [error, setError] = useState<string>("")

  async function handleCapture() {
    setError("")
    if (!("geolocation" in navigator)) {
      setError("Geolocalización no disponible en este dispositivo")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        const gj = JSON.stringify({ type: "Point", coordinates: [longitude, latitude] })
        setGeojson(gj)
        setPrecision(accuracy)
        setSource("GPS")
      },
      (err) => {
        setError(err.message || "No se pudo obtener ubicación")
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleCapture} className="h-8 px-3 rounded bg-sky-600 text-white hover:bg-sky-700">Usar coords del dispositivo</button>
        {geojson ? <span className="text-muted-foreground">Capturado</span> : null}
        {precision !== null ? <span className="text-muted-foreground">±{Math.round(precision)}m</span> : null}
      </div>
      {error ? <div className="text-red-600">{error}</div> : null}
      {/* Hidden fields for form submission */}
      <input type="hidden" name="captura_geom_4326" value={geojson} />
      <input type="hidden" name="captura_precision_m" value={precision ?? ""} />
      <input type="hidden" name="captura_fuente" value={source} />
    </div>
  )
}
