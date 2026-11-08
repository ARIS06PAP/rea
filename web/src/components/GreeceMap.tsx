// Interactive map of Greece: every NASA POWER grid cell drawn as the Greek land inside it,
// coloured by the selected layer. Click to select a cell, hover for values.
// Projection layers get a hatched overlay and a dashed outline, so they never look like measurements.
import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { get } from '../api'
import { colorAt } from '../fmt'

maplibregl.setWorkerUrl(workerUrl)

const CITIES: [string, number, number][] = [
  ['Αθήνα', 37.98, 23.73], ['Θεσσαλονίκη', 40.64, 22.94], ['Πάτρα', 38.25, 21.73], ['Ηράκλειο', 35.34, 25.13], ['Λάρισα', 39.64, 22.42],
  ['Ιωάννινα', 39.66, 20.85], ['Βόλος', 39.36, 22.94], ['Καβάλα', 40.94, 24.41], ['Αλεξανδρούπολη', 40.85, 25.87], ['Ρόδος', 36.43, 28.22],
  ['Χανιά', 35.51, 24.02], ['Καλαμάτα', 37.04, 22.11], ['Κέρκυρα', 39.62, 19.92], ['Μυτιλήνη', 39.11, 26.55], ['Νάξος', 37.10, 25.38], ['Τρίπολη', 37.51, 22.37],
]

const MINOR_CITIES = new Set(['Ιωάννινα', 'Καβάλα', 'Βόλος', 'Τρίπολη'])

type Props = {
  values: Record<string, number | null>
  palette: string[]
  domain: [number, number]
  selected?: string[]
  onSelect?: (cell: string) => void
  forecast?: boolean
  tooltip?: (cell: string, v: number | null) => string
  height?: number | string
  cities?: boolean
  highlight?: { cell: string; color: string }[]   // coloured outlines (e.g. place A and place B)
}

type FC = { type: 'FeatureCollection'; features: { type: 'Feature'; properties: Record<string, unknown> | null; geometry: unknown }[] }
let geoCache: FC | null = null

function hatch(): ImageData {
  const s = 10, c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  g.strokeStyle = 'rgba(255,214,140,0.85)'
  g.lineWidth = 1.4
  g.beginPath(); g.moveTo(0, s); g.lineTo(s, 0); g.moveTo(-2, 2); g.lineTo(2, -2); g.moveTo(s - 2, s + 2); g.lineTo(s + 2, s - 2); g.stroke()
  return g.getImageData(0, 0, s, s)
}

export default function GreeceMap({ values, palette, domain, selected = [], onSelect, forecast = false, tooltip, height = 520, cities = true, highlight }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const latest = useRef({ values, tooltip, onSelect })
  latest.current = { values, tooltip, onSelect }

  useEffect(() => {
    if (!box.current) return
    const map = new maplibregl.Map({
      container: box.current,
      style: {
        version: 8,
        sources: { base: { type: 'raster', tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'], tileSize: 256, maxzoom: 8, attribution: 'Βάση: NASA GIBS Blue Marble · Δεδομένα: NASA POWER, MODIS, NEX-GDDP-CMIP6' } },
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0a0e15' } }, { id: 'base', type: 'raster', source: 'base', paint: { 'raster-brightness-max': 0.42, 'raster-saturation': -0.45, 'raster-contrast': 0.05 } }],
      },
      bounds: [[19.0, 34.6], [29.8, 41.9]],
      fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true },
      dragRotate: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })
    map.on('load', async () => {
      geoCache = geoCache ?? (await get<FC>('/api/cells.geojson'))
      map.addSource('cells', { type: 'geojson', data: geoCache as never, promoteId: 'cell' })
      map.addImage('hatch', hatch())
      map.addLayer({ id: 'fill', type: 'fill', source: 'cells', paint: { 'fill-color': ['coalesce', ['feature-state', 'color'], '#2a3242'], 'fill-opacity': 0.88 } })
      map.addLayer({ id: 'hatch', type: 'fill', source: 'cells', layout: { visibility: 'none' }, paint: { 'fill-pattern': 'hatch', 'fill-opacity': 0.35 } })
      map.addLayer({ id: 'edge', type: 'line', source: 'cells', paint: { 'line-color': 'rgba(10,14,21,0.55)', 'line-width': 0.6 } })
      map.addLayer({ id: 'edge-fc', type: 'line', source: 'cells', layout: { visibility: 'none' }, paint: { 'line-color': '#ffcf70', 'line-width': 0.7, 'line-dasharray': [2, 2], 'line-opacity': 0.6 } })
      map.addLayer({ id: 'sel', type: 'line', source: 'cells', filter: ['in', ['get', 'cell'], ['literal', []]], paint: { 'line-color': '#ffffff', 'line-width': 2.2 } })
      map.on('mousemove', 'fill', (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0]
        if (!f) return
        map.getCanvas().style.cursor = 'pointer'
        const id = String(f.properties?.cell)
        const v = latest.current.values[id] ?? null
        popup.setLngLat(e.lngLat).setHTML(latest.current.tooltip ? latest.current.tooltip(id, v) : `${id}: ${v ?? '—'}`).addTo(map)
      })
      map.on('mouseleave', 'fill', () => { map.getCanvas().style.cursor = ''; popup.remove() })
      map.on('click', 'fill', (e: maplibregl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.cell
        if (id && latest.current.onSelect) latest.current.onSelect(String(id))
      })
      setReady(true)
    })
    if (cities) {
      const narrow = box.current.clientWidth < 820   // small maps and phones: drop labels that collide with a neighbour
      for (const [name, lat, lon] of CITIES) {
        if (narrow && MINOR_CITIES.has(name)) continue
        const el = document.createElement('div')
        el.style.cssText = 'font:500 10.5px Inter,Segoe UI,sans-serif;color:#e6ebf3;text-shadow:0 0 3px #000,0 0 6px #000;pointer-events:none;white-space:nowrap'
        el.innerHTML = `<span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:#fff;margin-right:4px;vertical-align:middle"></span>${name}`
        new maplibregl.Marker({ element: el, anchor: 'left' }).setLngLat([lon, lat]).addTo(map)
      }
    }
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(box.current)
    return () => { ro.disconnect(); map.remove(); mapRef.current = null }
  }, [cities])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !geoCache) return
    const [lo, hi] = domain
    for (const f of geoCache.features) {
      const id = String(f.properties?.cell)
      const v = values[id]
      map.setFeatureState({ source: 'cells', id }, { color: v === null || v === undefined ? '#2a3242' : colorAt(palette, (v - lo) / (hi - lo || 1)) })
    }
  }, [values, palette, domain, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const hl = (highlight ?? selected.map((cell) => ({ cell, color: '#ffffff' })))
      .filter((h, i, all) => all.findIndex((x) => x.cell === h.cell) === i)
    map.setFilter('sel', ['in', ['get', 'cell'], ['literal', hl.map((h) => h.cell)]])
    map.setPaintProperty('sel', 'line-color', hl.length ? ['match', ['get', 'cell'], ...hl.flatMap((h) => [h.cell, h.color]), '#ffffff'] as never : '#ffffff')
    map.setPaintProperty('sel', 'line-width', highlight ? 3 : 2.2)
    map.setLayoutProperty('hatch', 'visibility', forecast ? 'visible' : 'none')
    map.setLayoutProperty('edge-fc', 'visibility', forecast ? 'visible' : 'none')
  }, [selected, forecast, ready, highlight])

  return <div ref={box} style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border border-line" />
}

export function Legend({ palette, domain, unit, title, digits = 0, forecast }: { palette: string[]; domain: [number, number]; unit: string; title: string; digits?: number; forecast?: boolean }) {
  const steps = 5
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex items-center gap-2 text-soft">{title}{forecast && <span className="forecast-badge rounded px-1.5 py-0.5 text-[10.5px] font-semibold">ΠΡΟΒΛΕΨΗ</span>}</div>
      <div className="h-2.5 rounded" style={{ background: `linear-gradient(90deg, ${palette.join(',')})` }} />
      <div className="flex justify-between num text-muted">
        {Array.from({ length: steps }, (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / (steps - 1)).map((v, i) => (
          <span key={i}>{v.toLocaleString('el-GR', { maximumFractionDigits: digits })}{i === steps - 1 ? ` ${unit}` : ''}</span>
        ))}
      </div>
    </div>
  )
}
