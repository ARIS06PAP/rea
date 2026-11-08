// Map: one layer (the ESI or one parameter), any year on the slider and any month; one region at a time.
// The state lives in the URL (?layer=&year=&month=&cell=), so a view can be shared or reloaded.
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApi, type MapLayer, type Meta, type Place } from '../api'
import { ErrorBox, Loading } from '../components/Layout'
import GreeceMap, { Legend } from '../components/GreeceMap'
import RegionPanel from '../components/RegionPanel'
import { niceScale } from '../components/Charts'
import { CHANGE_PALETTE, CLASSES, ESI_DOMAIN, LAYER_INFO, MONTHS, MONTHS_LONG, colorAt, esiWord, niceDomain, nf, signed } from '../fmt'

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

export default function MapPage() {
  const meta = useApi<Meta>('/api/meta')
  const places = useApi<Place[]>('/api/places')
  const [sp, setSp] = useSearchParams()
  const [showChange, setShowChange] = useState(false)
  const ly = meta.data?.last_month.year ?? 2026
  const lm = meta.data?.last_month.month ?? 12
  const lcy = meta.data?.last_complete_year ?? 2025
  const layer = LAYER_INFO[sp.get('layer') ?? ''] ? sp.get('layer')! : 'ESI'
  const info = LAYER_INFO[layer]
  const maxOf = (_l: string) => 2050   // every layer has a projection (SSP2-4.5) after the last data year
  const year = clamp(Number(sp.get('year')) || lcy, info.first, maxOf(layer))
  const monthMax = year === ly ? lm : 12
  const month = clamp(Number(sp.get('month')) || 0, 0, monthMax)
  const cell = sp.get('cell')
  const future = year > ly
  const set = (patch: Record<string, string | number | null>) => {
    const next = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, String(v))
    }
    setSp(next, { replace: true })
  }
  const map = useApi<MapLayer>(meta.data ? `/api/map?layer=${layer}&year=${year}&month=${month}` : null)
  const change = future && info.esi && showChange && !!map.data?.extra
  const values = useMemo(() => {
    if (!map.data) return {}
    if (change) return Object.fromEntries(Object.entries(map.data.extra!).map(([k, e]) => [k, e.change ?? null]))
    return map.data.values
  }, [map.data, change])
  const raw = map.data?.domain ?? niceDomain(Object.values(values).filter((v): v is number => v !== null))
  const domain: [number, number] = change ? [-8, 8] : info.esi ? ESI_DOMAIN(month) : niceScale(raw[0], raw[1]).domain
  const palette = change ? CHANGE_PALETTE : info.palette

  if (meta.error) return <ErrorBox error={meta.error} />
  if (!meta.data) return <Loading />
  const m = meta.data
  const nameOf = (id: string) => places.data?.find((p) => p.cell === id)?.name ?? m.cells.find((c) => c.cell === id)?.region ?? id
  const unit = info.unit === '/100' ? '/100' : info.unit ? ` ${info.unit}` : ''
  const tip = (id: string, v: number | null) => {
    if (change) return `<b>${nameOf(id)}</b><br/>Αλλαγή από το 1995–2014: <b>${signed(v, 1)}</b>`
    let s = `<b>${nameOf(id)}</b><br/>${info.short}: <b>${nf(v, info.digits)}</b>${unit}`
    if (info.esi) s += ` · ${esiWord(v)}`
    const e = map.data?.extra?.[id]
    if (future && e) s += `<br/><span style="color:#8591a6">εύρος μοντέλων ${nf(e.p10, info.digits)}–${nf(e.p90, info.digits)}</span>`
    return s
  }
  const when = `${month ? `${MONTHS_LONG[month]} ` : ''}${year}${map.data?.partial ? ` (${MONTHS[1]}–${MONTHS[map.data.months ?? 12]})` : ''}`
  const legendTitle = change ? 'Αλλαγή του ESI από το κλίμα 1995–2014'
    : `${info.label} · ${month ? MONTHS_LONG[month] : layer === 'PRECIP' ? 'σύνολο έτους' : 'μέσος όρος έτους'}`

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <select className="sel !py-2 !text-[14px]" value={layer} aria-label="Επίπεδο"
          onChange={(e) => { const l = e.target.value; set({ layer: l, year: clamp(year, LAYER_INFO[l].first, maxOf(l)) }) }}>
          {Object.entries(LAYER_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="flex items-center gap-2 grow min-w-[260px]">
          <button className="btn !px-2.5" onClick={() => set({ year: clamp(year - 1, info.first, maxOf(layer)) })} disabled={year <= info.first} aria-label="Προηγούμενο έτος">‹</button>
          <span className="num text-[18px] font-semibold w-12 text-center">{year}</span>
          <button className="btn !px-2.5" onClick={() => set({ year: clamp(year + 1, info.first, maxOf(layer)) })} disabled={year >= maxOf(layer)} aria-label="Επόμενο έτος">›</button>
          <input type="range" min={info.first} max={maxOf(layer)} value={year} onChange={(e) => set({ year: e.target.value })} className="grow" aria-label="Έτος" />
        </div>
        <select className="sel !py-2 !text-[14px]" value={month} onChange={(e) => set({ month: e.target.value })} aria-label="Μήνας">
          {MONTHS_LONG.map((mn, i) => <option key={i} value={i} disabled={i > monthMax}>{mn}</option>)}
        </select>
        {future && info.esi && <button className={`btn ${showChange ? 'on' : ''}`} onClick={() => setShowChange(!showChange)}>Αλλαγή από 1995–2014</button>}
      </div>

      <div className="grid xl:grid-cols-[1fr_400px] gap-4 items-start">
        <div className="flex flex-col gap-3">
          <div className="relative">
            {map.error ? <ErrorBox error={map.error} />
              : <GreeceMap values={values} palette={palette} domain={domain} selected={cell ? [cell] : []} onSelect={(id) => set({ cell: id === cell ? null : id })}
                  forecast={future} tooltip={tip} height="clamp(380px, 64vh, 660px)" />}
            <div className={`absolute left-3 top-3 rounded-md px-3 py-1.5 text-[12.5px] ${future ? 'forecast-badge' : 'bg-ink/85 border border-line text-soft'}`}>
              {future ? <>ΠΡΟΒΛΕΨΗ · SSP2-4.5 · {when}</> : <>ΜΕΤΡΗΣΕΙΣ NASA · {when}</>}
            </div>
          </div>
          <div className="card p-3">
            <Legend palette={palette} domain={domain} unit={change ? '' : info.unit} title={legendTitle} digits={change ? 0 : info.digits} forecast={future} />
          </div>
        </div>
        <aside className="card p-4 xl:sticky xl:top-20">
          {cell ? <RegionPanel cell={cell} layer={layer} year={year} month={month} places={places.data} onClose={() => set({ cell: null })} />
            : (
              <div className="flex flex-col gap-4">
                <div className="text-[15px] font-semibold">Κάνε κλικ σε μια περιοχή</div>
                {info.esi && !change && (
                  <div className="flex flex-col gap-1.5">
                    {CLASSES.map(([lo, w], i) => (
                      <div key={w} className="flex items-center gap-2.5 text-[13px]">
                        <span className="inline-block w-4 h-3 rounded-sm border border-white/15" style={{ background: colorAt(palette, (Math.min(lo + 2, domain[1]) - domain[0]) / (domain[1] - domain[0])) }} />
                        <span className="grow">{w}</span><span className="num text-muted">{lo}{i === 0 ? '+' : `–${CLASSES[i - 1][0]}`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
        </aside>
      </div>
    </div>
  )
}
