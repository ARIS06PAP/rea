import { useMemo, useState } from 'react'
import { useApi, type MapLayer, type Meta } from '../api'
import { Card, ErrorBox, ForecastNote, Loading, Page } from '../components/Layout'
import GreeceMap, { Legend } from '../components/GreeceMap'
import CellPanel, { cellName } from '../components/CellPanel'
import { TimeChart } from '../components/Charts'
import { CHANGE_PALETTE, LAYER_INFO, MONTHS, MONTHS_LONG, niceDomain, nf, signed } from '../fmt'

const QUICK = [2000, 2010, 2020, 2026, 2030, 2040, 2050]
const COLORS = ['#fe9f6d', '#5aa9e6', '#4cc38a', '#c792ea']

export default function MapPage() {
  const meta = useApi<Meta>('/api/meta')
  const [layer, setLayer] = useState('ESI')
  const [year, setYear] = useState(2025)
  const [month, setMonth] = useState(0)
  const [scenario, setScenario] = useState('ssp245')
  const [showChange, setShowChange] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const lastYear = meta.data?.last_month.year ?? 2026
  const future = year > lastYear
  const snapshot = [2030, 2040, 2050].includes(year)
  const monthOk = !future || (snapshot && (layer === 'ESI' || layer === 'ESI_eq'))
  const effMonth = monthOk ? month : 0
  const minYear = layer === 'ESI' || layer === 'ESI_eq' || layer === 'NDVI' ? 2000 : 1981
  const yy = Math.max(year, minYear)
  const url = meta.data ? `/api/map?layer=${layer}&year=${yy}&month=${effMonth}&scenario=${scenario}` : null
  const map = useApi<MapLayer>(url)
  const cmp = useApi<Record<string, { year: number; v: number }[]>>(selected.length ? `/api/compare?cells=${selected.join(',')}&var=${layer}` : null)

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
  const pick = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-4)))
  const cellOf = (id: string) => m.cells.find((c) => c.cell === id)
  const tip = (id: string, v: number | null) => {
    const c = cellOf(id)
    const e = map.data?.extra?.[id]
    const unit = change ? ' μονάδες ESI' : ` ${info.unit}`
    let s = `<b>${c?.region ?? id}</b><br/><span style="color:#8591a6">${nf(c?.lat, 2)}°Β ${nf(c?.lon, 2)}°Α</span><br/>${change ? 'Μεταβολή' : info.short}: <b>${change ? signed(v, 1) : nf(v, info.digits)}</b>${unit}`
    if (future && e?.p10 !== undefined && !change) s += `<br/><span style="color:#8591a6">εύρος μοντέλων ${nf(e.p10, 0)}–${nf(e.p90, 0)}</span>`
    if (future && e?.agree_up !== undefined) s += `<br/><span style="color:#8591a6">μοντέλα με άνοδο: ${nf((e.agree_up ?? 0) * 100, 0)}%</span>`
    return s
  }
  const cmpData = cmp.data ? Array.from(new Set(Object.values(cmp.data).flat().map((r) => r.year))).sort().map((y) => {
    const row: Record<string, number | null> = { year: y }
    selected.forEach((id, i) => { row[`c${i}`] = cmp.data![id]?.find((r) => r.year === y)?.v ?? null })
    return row
  }) : []

  return (
    <Page eyebrow="Διαδραστικός χάρτης" title="Η καταλληλότητα σε κάθε σημείο της Ελλάδας"
      lead="Κάθε περιοχή του χάρτη είναι ένα κελί του πλέγματος της NASA (περίπου 55 × 55 km), σχεδιασμένο ως η ελληνική στεριά που περιέχει. Κάνε κλικ σε κελιά για να δεις λεπτομέρειες ή για να τα συγκρίνεις (έως 4).">
      <div className="card p-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-2 text-[13px] text-soft">Επίπεδο
          <select className="sel" value={layer} onChange={(e) => setLayer(e.target.value)}>
            {Object.entries(LAYER_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK.map((y) => <button key={y} className={`btn num ${year === y ? 'on' : ''}`} onClick={() => setYear(y)}>{y}</button>)}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-soft grow min-w-[220px]">Έτος <span className="num text-fg w-10">{yy}</span>
          <input type="range" min={minYear} max={2050} value={yy} onChange={(e) => setYear(+e.target.value)} className="grow" />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-soft">Μήνας
          <select className="sel" value={effMonth} onChange={(e) => setMonth(+e.target.value)} disabled={!monthOk}>
            {MONTHS_LONG.map((mn, i) => <option key={i} value={i}>{mn}</option>)}
          </select>
        </label>
        {future && (
          <div className="flex items-center gap-1.5">
            {['ssp245', 'ssp585'].map((s) => <button key={s} className={`btn ${scenario === s ? 'on' : ''}`} onClick={() => setScenario(s)}>{s === 'ssp245' ? 'SSP2-4.5' : 'SSP5-8.5'}</button>)}
            {snapshot && layer.startsWith('ESI') && <button className={`btn ${showChange ? 'on' : ''}`} onClick={() => setShowChange(!showChange)}>Μεταβολή</button>}
          </div>
        )}
      </div>

      <div className="grid xl:grid-cols-[1fr_440px] gap-4 items-start">
        <div className="flex flex-col gap-3">
          <div className="relative">
            {map.error ? <ErrorBox error={map.error} /> : <GreeceMap values={values} palette={palette} domain={domain} selected={selected} onSelect={pick} forecast={future} tooltip={tip} height={600} />}
            <div className={`absolute left-3 top-3 rounded-md px-3 py-1.5 text-[12.5px] ${future ? 'forecast-badge' : 'bg-ink/85 border border-line text-soft'}`}>
              {future ? <>ΠΡΟΒΛΕΨΗ · {scenario === 'ssp245' ? 'SSP2-4.5' : 'SSP5-8.5'} · {map.data?.window ?? yy} · διάμεσος 8 μοντέλων</>
                : <>ΜΕΤΡΗΣΕΙΣ NASA · {effMonth ? `${MONTHS_LONG[effMonth]} ` : ''}{yy}{map.data?.partial ? ` (μόνο ${map.data.months} μήνες)` : ''}</>}
            </div>
          </div>
          <div className="card p-3 grid md:grid-cols-[1fr_auto] gap-4 items-center">
            <Legend palette={palette} domain={domain} unit={change ? 'μον.' : info.unit} title={change ? `Μεταβολή ESI έναντι κλίματος 1995–2014` : `${info.label}${effMonth ? ` · ${MONTHS[effMonth]}` : ' · ετήσιο'}`} digits={change ? 0 : info.digits} forecast={future} />
            <div className="text-[12px] text-muted max-w-sm">{future ? 'Γραμμοσκίαση και διακεκομμένα όρια = πρόβλεψη. Για μήνες: δεκαετίες 2021–2030, 2031–2040, 2041–2050.' : 'Γκρι = δεν υπάρχουν δεδομένα για αυτό το διάστημα (π.χ. NDVI πριν από το 2000).'}</div>
          </div>
          {future && <ForecastNote />}
          {selected.length > 0 && (
            <Card title="Σύγκριση επιλεγμένων κελιών" sub={`${info.label}, ετήσιες τιμές (μετρήσεις)`} right={<button className="btn" onClick={() => setSelected([])}>Καθαρισμός</button>}>
              <TimeChart data={cmpData} series={selected.map((id, i) => ({ key: `c${i}`, name: cellName(cellOf(id)!), color: COLORS[i] }))} height={240} digits={info.digits} />
            </Card>
          )}
        </div>
        <aside className="card p-4 xl:sticky xl:top-20 max-h-none xl:max-h-[calc(100vh-6rem)] overflow-auto">
          {selected.length ? <CellPanel id={selected[selected.length - 1]} meta={m} onClose={() => setSelected(selected.slice(0, -1))} />
            : <div className="text-[13.5px] text-soft leading-relaxed">
                <div className="eyebrow mb-2">Οδηγίες</div>
                <p>Κάνε κλικ σε ένα κελί για να δεις την καταλληλότητα, τη συμβολή κάθε παράγοντα, την ιστορία από το 2001, τις στατιστικές τάσεις και την πρόβλεψη ως το 2050.</p>
                <p className="mt-2">Με περισσότερα κλικ συγκρίνεις έως 4 περιοχές. Από τον επιλογέα «Επίπεδο» βλέπεις και καθεμία από τις πέντε παραμέτρους.</p>
                <p className="mt-2 text-muted">Χρονιές μετά το {lastYear} είναι προβλέψεις και σημειώνονται με γραμμοσκίαση.</p>
              </div>}
        </aside>
      </div>
    </Page>
  )
}
