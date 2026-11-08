import { useMemo, useState } from 'react'
import { useApi, type MapLayer, type Meta, type Place } from '../api'
import { ErrorBox, ForecastNote, Loading, Page } from '../components/Layout'
import GreeceMap, { Legend } from '../components/GreeceMap'
import PlaceCard from '../components/PlaceCard'
import { CHANGE_PALETTE, LAYER_INFO, MONTHS, MONTHS_LONG, colorAt, esiWord, niceDomain, nf, signed } from '../fmt'

const QUICK = [2000, 2010, 2020, 2026, 2030, 2040, 2050]
const CLASSES: [string, number, number][] = [['Πολύ ευνοϊκές', 60, 100], ['Ευνοϊκές', 45, 60], ['Μέτριες', 30, 45], ['Περιορισμένες', 15, 30], ['Δυσμενείς', 0, 15]]

export default function MapPage() {
  const meta = useApi<Meta>('/api/meta')
  const places = useApi<Place[]>('/api/places')
  const [layer, setLayer] = useState('ESI')
  const [year, setYear] = useState(2025)
  const [month, setMonth] = useState(0)
  const [scenario, setScenario] = useState('ssp245')
  const [showChange, setShowChange] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const lastYear = meta.data?.last_month.year ?? 2026
  const future = year > lastYear
  const snapshot = [2030, 2040, 2050].includes(year)
  const monthOk = !future || (snapshot && (layer === 'ESI' || layer === 'ESI_eq'))
  const effMonth = monthOk ? month : 0
  const minYear = layer === 'ESI' || layer === 'ESI_eq' || layer === 'NDVI' ? 2000 : 1981
  const yy = Math.max(year, minYear)
  const url = meta.data ? `/api/map?layer=${layer}&year=${yy}&month=${effMonth}&scenario=${scenario}` : null
  const map = useApi<MapLayer>(url)

  const info = LAYER_INFO[layer]
  const change = future && snapshot && showChange && map.data?.extra
  const values = useMemo(() => {
    if (!map.data) return {}
    if (change) return Object.fromEntries(Object.entries(map.data.extra!).map(([k, e]) => [k, e.change ?? null]))
    return map.data.values
  }, [map.data, change])
  const domain: [number, number] = change ? [-8, 8]
    : layer.startsWith('ESI') ? (effMonth === 0 ? [10, 50] : [0, 75])
      : niceDomain(Object.values(values).filter((v): v is number => v !== null))
  const palette = change ? CHANGE_PALETTE : info.palette

  if (meta.error) return <ErrorBox error={meta.error} />
  if (!meta.data) return <Loading />
  const m = meta.data
  const nameOf = (id: string) => places.data?.find((p) => p.cell === id)?.name ?? m.cells.find((c) => c.cell === id)?.region ?? id
  const tip = (id: string, v: number | null) => {
    const e = map.data?.extra?.[id]
    if (change) return `<b>${nameOf(id)}</b><br/>Αλλαγή ως το ${yy}: <b>${signed(v, 1)}</b>`
    let s = `<b>${nameOf(id)}</b><br/>${info.short}: <b>${nf(v, info.digits)}</b>${info.unit === '/100' ? '/100' : ` ${info.unit}`}`
    if (layer.startsWith('ESI')) s += ` · ${esiWord(v)}`
    if (future && e?.p10 !== undefined) s += `<br/><span style="color:#8591a6">εύρος μοντέλων ${nf(e.p10, 0)}–${nf(e.p90, 0)}</span>`
    return s
  }

  return (
    <Page eyebrow="Χάρτης" title="Κάθε περιοχή, από το 2000 ως το 2050" lead="Διάλεξε χρονιά και κάνε κλικ σε μια περιοχή.">
      <div className="card p-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <select className="sel !py-2" value={layer} onChange={(e) => setLayer(e.target.value)} aria-label="Τι δείχνει ο χάρτης">
          {Object.entries(LAYER_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK.map((y) => <button key={y} className={`btn num ${year === y ? 'on' : ''} ${y > lastYear ? 'border-dashed' : ''}`} onClick={() => setYear(y)}>{y}</button>)}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-soft grow min-w-[200px]"><span className="num text-fg w-10">{yy}</span>
          <input type="range" min={minYear} max={2050} value={yy} onChange={(e) => setYear(+e.target.value)} className="grow" aria-label="Έτος" />
        </label>
        <select className="sel !py-2" value={effMonth} onChange={(e) => setMonth(+e.target.value)} disabled={!monthOk} aria-label="Μήνας">
          {MONTHS_LONG.map((mn, i) => <option key={i} value={i}>{mn}</option>)}
        </select>
        {future && (
          <div className="flex items-center gap-1.5">
            {['ssp245', 'ssp585'].map((s) => <button key={s} className={`btn ${scenario === s ? 'on' : ''}`} onClick={() => setScenario(s)}>{s === 'ssp245' ? 'Ενδιάμεσο σενάριο' : 'Υψηλό σενάριο'}</button>)}
            {snapshot && layer.startsWith('ESI') && <button className={`btn ${showChange ? 'on' : ''}`} onClick={() => setShowChange(!showChange)}>Δείξε την αλλαγή</button>}
          </div>
        )}
      </div>

      <div className="grid xl:grid-cols-[1fr_380px] gap-4 items-start">
        <div className="flex flex-col gap-3">
          <div className="relative">
            {map.error ? <ErrorBox error={map.error} /> : <GreeceMap values={values} palette={palette} domain={domain} selected={selected ? [selected] : []} onSelect={(id) => setSelected(id === selected ? null : id)} forecast={future} tooltip={tip} height={620} />}
            <div className={`absolute left-3 top-3 rounded-md px-3 py-1.5 text-[12.5px] ${future ? 'forecast-badge' : 'bg-ink/85 border border-line text-soft'}`}>
              {future ? <>ΠΡΟΒΛΕΨΗ · {scenario === 'ssp245' ? 'ενδιάμεσο' : 'υψηλό'} σενάριο · {map.data?.window ?? yy}</>
                : <>ΜΕΤΡΗΣΕΙΣ NASA · {effMonth ? `${MONTHS_LONG[effMonth]} ` : ''}{yy}{map.data?.partial ? ` (μόνο ${map.data.months} μήνες)` : ''}</>}
            </div>
          </div>
          <div className="card p-3">
            <Legend palette={palette} domain={domain} unit={change ? 'μον.' : info.unit} title={change ? 'Αλλαγή καταλληλότητας από το κλίμα 1995–2014' : `${info.label}${effMonth ? ` · ${MONTHS[effMonth]}` : ' · μέσος όρος έτους'}`} digits={change ? 0 : info.digits} forecast={future} />
          </div>
          {future && <ForecastNote>Γραμμοσκίαση = πρόβλεψη. Δείχνεται η διάμεσος 8 κλιματικών μοντέλων{snapshot ? ', μέσος όρος της δεκαετίας ως το ' + yy : ''}.</ForecastNote>}
        </div>
        <aside className="card p-4 xl:sticky xl:top-20">
          {selected && places.data ? <PlaceCard cell={selected} meta={m} places={places.data} onClose={() => setSelected(null)} />
            : <div className="flex flex-col gap-4">
                <div className="text-[15px] font-semibold">Κάνε κλικ σε μια περιοχή</div>
                <p className="text-[13.5px] text-soft leading-relaxed">Θα δεις πόσο ευνοϊκές είναι οι συνθήκες εκεί, πόσους μήνες τον χρόνο, πώς άλλαξαν και τι έρχεται ως το 2050.</p>
                {layer.startsWith('ESI') && !change && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[12px] text-muted">Τι σημαίνουν τα χρώματα</div>
                    {CLASSES.map(([w, lo, hi]) => (
                      <div key={w} className="flex items-center gap-2.5 text-[13px]">
                        <span className="inline-block w-4 h-3 rounded-sm" style={{ background: colorAt(palette, (Math.min(lo + 2, domain[1]) - domain[0]) / (domain[1] - domain[0])) }} />
                        <span className="grow">{w}</span><span className="num text-muted">{lo}–{hi === 100 ? '' : hi}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>}
        </aside>
      </div>
    </Page>
  )
}
