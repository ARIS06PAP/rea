// Thin client for the TigerWatch API (FastAPI over DuckDB). Responses are cached per URL.
import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<unknown>>()

export function get<T>(url: string): Promise<T> {
  if (!cache.has(url)) {
    const p = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
      return r.json()
    })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return cache.get(url) as Promise<T>
}

export function useApi<T>(url: string | null): { data: T | null; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: !!url })
  useEffect(() => {
    let alive = true
    if (!url) { setState({ data: null, error: null, loading: false }); return }
    setState((s) => ({ ...s, loading: true, error: null }))
    get<T>(url).then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e) => alive && setState({ data: null, error: String(e), loading: false }))
    return () => { alive = false }
  }, [url])
  return state
}

export type Cell = {
  cell: string; lat: number; lon: number; region: string; island: boolean; coastal: boolean; north: boolean
  urban_class: string; urban_share: number; elev_m: number; elev_class: string; gr_land: number
}
export type Meta = {
  built_at: string
  coverage: Record<string, { first: string; last: string; missing_cell_months: number }> & { common_period: { first: string; last: string }; cells: number; last_complete_year: number }
  weights: { main: Record<string, number>; equal: Record<string, number> }
  esi_parameters: Record<string, number>
  scenarios: Record<string, string>
  snapshots: number[]
  models: string[]
  cells: Cell[]
  regions: string[]
  params: Record<string, { label: string; unit: string }>
  last_complete_year: number
  last_month: { year: number; month: number }
}
export type Trend = { sen_decade: number; ci: [number, number]; p: number; significant: boolean; n: number; first: number; last: number; total: number } | null
export type MapLayer = {
  kind: 'observed' | 'projection'; partial?: boolean; months?: number; year: number; month: number; layer: string; scenario?: string; window?: string
  values: Record<string, number | null>
  extra?: Record<string, { p10?: number; p90?: number; change?: number; agree_up?: number; base?: number }>
}
export type National = {
  annual: Record<string, number | null>[]
  monthly: Record<string, number | null>[]
  trends: Record<string, Trend>
  regions: { region: string; esi: number; esi_2001_2010: number | null; change: number | null }[]
  cells_ranked: { cell: string; region: string; lat: number; lon: number; esi: number }[]
  projections: { scenario: string; year: number; ESI_med: number; ESI_p10: number; ESI_p90: number; ESI_min: number; ESI_max: number; T2M_med: number }[]
  periods: Record<string, number | null>
  last_complete_year: number
  last_month: { year: number; month: number }
}

export const PARAM_KEYS = ['T2M', 'PRECIP', 'RH2M', 'WS10M', 'NDVI'] as const
export const LAYER_KEYS = ['ESI', 'ESI_eq', ...PARAM_KEYS] as const
