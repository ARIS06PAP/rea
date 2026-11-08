// Thin client for the R.E.A. API (FastAPI over DuckDB). Responses are cached per URL.
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
  change_2050?: Record<string, { change: number; share_up: number }>
  last_complete_year: number
  last_month: { year: number; month: number }
}

export const PARAM_KEYS = ['T2M', 'PRECIP', 'RH2M', 'WS10M', 'NDVI'] as const
export const LAYER_KEYS = ['ESI', 'ESI_eq', ...PARAM_KEYS] as const

export type Place = { name: string; lat: number; lon: number; cell: string; region: string; inside: boolean; km: number }
export type Season = { n: number; months: number[] }
export type Summary = {
  cell: Cell & { land: number; mainland_share: number }
  period_now: string
  esi_now: number | null
  esi_early: number | null
  percentile: number | null
  season: { early: Season; now: Season }
  monthly: { early: (number | null)[]; now: (number | null)[] }
  trend: { sen_decade: number; ci: [number, number]; p: number; significant: boolean; first: number; last: number } | null
  t_trend: { sen_decade: number; ci: [number, number]; p: number; significant: boolean; first: number; last: number } | null
  proj: Record<'ssp245' | 'ssp585', { esi: number | null; p10: number | null; p90: number | null; change: number | null; agree_up: number | null; n_models: number | null; monthly: (number | null)[]; season: Season }>
  factors: Record<'sT' | 'sP' | 'sRH' | 'sW' | 'sNDVI', number>
  climate: { t_year: number; t_jan: number; t_jul: number; rain_year: number; rh: number; wind: number; ndvi: number }
  annual: { year: number; v: number }[]
  favourable_threshold: number
}
