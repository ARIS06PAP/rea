import { useState } from 'react'
import { useApi, type MapLayer, type Meta, type National } from '../api'
import { Card, ErrorBox, ForecastNote, Loading, Page, Stat } from '../components/Layout'
import GreeceMap, { Legend } from '../components/GreeceMap'
import { TimeChart } from '../components/Charts'
import { CHANGE_PALETTE, LAYER_INFO, nf, signed } from '../fmt'

type ProjResp = {
  year: number; scenario: string
  national: { scenario: string; year: number; ESI_med: number; ESI_p10: number; ESI_p90: number; ESI_min: number; ESI_max: number }[]
  by_model: { model: string; scenario: string; year: number; ESI: number }[]
  cells: { cell: string; region: string; v: number; p10: number; p90: number; change: number; agree_up?: number }[]
  regions: { region: string; change: number; esi: number }[]
}
type RegResp = { region: string; projections: { scenario: string; year: number; med: number; p10: number; p90: number }[]; observed: { year: number; v: number }[] }
const SC = { ssp245: 'SSP2-4.5 (ενδιάμεσες εκπομπές)', ssp585: 'SSP5-8.5 (υψηλές εκπομπές)' } as Record<string, string>

export default function FuturePage() {
  const meta = useApi<Meta>('/api/meta')
  const nat = useApi<National>('/api/national')
  const [year, setYear] = useState(2050)
  const [scenario, setScenario] = useState('ssp585')
  const [region, setRegion] = useState('')
  const [mode, setMode] = useState<'change' | 'value'>('change')
  const pr = useApi<ProjResp>(`/api/projections?year=${year}&scenario=${scenario}`)
  const a = useApi<MapLayer>(`/api/map?layer=ESI&year=${year}&scenario=ssp245`)
  const b = useApi<MapLayer>(`/api/map?layer=ESI&year=${year}&scenario=ssp585`)
  const reg = useApi<RegResp>(region ? `/api/projections/region?region=${encodeURIComponent(region)}` : null)
  if (meta.error || nat.error || pr.error) return <ErrorBox error={(meta.error || nat.error || pr.error)!} />
  if (!meta.data || !nat.data) return <Loading />
  const m = meta.data, n = nat.data
  const series = (data: { scenario: string; year: number; med: number; p10: number; p90: number }[], obs: { year: number; v: number }[]) => [
    ...obs.map((o) => ({ year: o.year, obs: o.v })),
    ...Array.from(new Set(data.map((d) => d.year))).filter((y) => y >= n.last_complete_year).map((y) => {
      const s1 = data.find((d) => d.year === y && d.scenario === 'ssp245'), s2 = data.find((d) => d.year === y && d.scenario === 'ssp585')
      return { year: y, s245: s1?.med, s245lo: s1?.p10, s245hi: s1?.p90, s585: s2?.med, s585lo: s2?.p10, s585hi: s2?.p90 }
    }),
  ]
  const natSeries = series(n.projections.map((p) => ({ scenario: p.scenario, year: p.year, med: p.ESI_med, p10: p.ESI_p10, p90: p.ESI_p90 })),
    n.annual.filter((r) => r.ESI != null).map((r) => ({ year: r.year as number, v: r.ESI as number })))
  const base = n.projections.find((p) => p.scenario === scenario && p.year === n.last_complete_year)?.ESI_med
  const here = pr.data?.national.find((p) => p.scenario === scenario && p.year === year)
  const dvals = (l?: MapLayer | null) => l ? (mode === 'change' && l.extra ? Object.fromEntries(Object.entries(l.extra).map(([k, e]) => [k, e.change ?? null])) : l.values) : {}
  const snap = [2030, 2040, 2050].includes(year)
  const useChange = mode === 'change' && snap
  const pal = useChange ? CHANGE_PALETTE : LAYER_INFO.ESI.palette
  const dom: [number, number] = useChange ? [-8, 8] : [10, 50]
  const up = (pr.data?.regions ?? []).filter((r) => r.change > 0), down = (pr.data?.regions ?? []).filter((r) => r.change <= 0)
  const tip = (sc: string, l?: MapLayer | null) => (id: string, v: number | null) => {
    const e = l?.extra?.[id]
    return `<b>${m.cells.find((c) => c.cell === id)?.region ?? id}</b><br/>${SC[sc].split(' ')[0]} · ${useChange ? 'μεταβολή' : 'ESI'}: <b>${useChange ? signed(v, 1) : nf(v, 0)}</b>` +
      (e?.p10 !== undefined ? `<br/><span style="color:#8591a6">εύρος μοντέλων ESI ${nf(e.p10, 0)}–${nf(e.p90, 0)}</span>` : '') +
      (e?.agree_up !== undefined ? `<br/><span style="color:#8591a6">${nf((e.agree_up ?? 0) * 100, 0)}% των μοντέλων: άνοδος</span>` : '')
  }
  return (
    <Page eyebrow="2050" title="Η καταλληλότητα ως το 2050"
      lead="Τι δείχνουν 8 κλιματικά μοντέλα για κάθε περιοχή, σε ένα ενδιάμεσο και ένα υψηλό σενάριο εκπομπών."
      more="Δύο σενάρια εκπομπών (SSP2-4.5, SSP5-8.5) και 8 κλιματικά μοντέλα CMIP6 της NASA (NEX-GDDP, 0,25°). Οι αλλαγές θερμοκρασίας, βροχής, υγρασίας και ανέμου των μοντέλων προστίθενται στο παρατηρημένο κλίμα 1995–2014 (μέθοδος delta). Το NDVI μένει στην πρόσφατη κατάστασή του (2016–2025), γιατί δεν υπάρχουν προβλέψεις MODIS.">
      <ForecastNote />
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">{['ssp245', 'ssp585'].map((s) => <button key={s} className={`btn ${scenario === s ? 'on' : ''}`} onClick={() => setScenario(s)}>{SC[s]}</button>)}</div>
        <div className="flex gap-1.5">{[2030, 2040, 2050].map((y) => <button key={y} className={`btn num ${year === y ? 'on' : ''}`} onClick={() => setYear(y)}>{y}</button>)}</div>
        <label className="flex items-center gap-2 text-[13px] text-soft grow min-w-[200px]">Έτος <span className="num text-fg w-10">{year}</span>
          <input type="range" min={2027} max={2050} value={year} onChange={(e) => setYear(+e.target.value)} className="grow" /></label>
        <div className="flex gap-1.5"><button className={`btn ${mode === 'change' ? 'on' : ''}`} onClick={() => setMode('change')}>Μεταβολή</button><button className={`btn ${mode === 'value' ? 'on' : ''}`} onClick={() => setMode('value')}>Τιμή ESI</button></div>
        <select className="sel" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">Όλη η Ελλάδα</option>{m.regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={`ESI Ελλάδας ${year} (${scenario === 'ssp245' ? 'SSP2-4.5' : 'SSP5-8.5'})`} value={nf(here?.ESI_med, 1)} unit="/100" note={<>εύρος 10–90% μοντέλων <span className="num">{nf(here?.ESI_p10, 1)}–{nf(here?.ESI_p90, 1)}</span></>} />
        <Stat label={`Μεταβολή από το ${n.last_complete_year} (μοντέλα)`} value={signed(here && base ? here.ESI_med - base : null, 1)} tone="up" note="ίδια μέθοδος και στα δύο έτη" />
        <Stat label="Περιφέρειες με άνοδο" value={`${up.length} / ${(pr.data?.regions ?? []).length}`} note={snap ? 'μέσος δεκαετίας έναντι κλίματος 1995–2014' : 'έναντι κλίματος 1995–2014'} />
        <Stat label="Μοντέλα (min–max) 2050" value={`${nf(n.projections.find((p) => p.scenario === scenario && p.year === 2050)?.ESI_min, 1)}–${nf(n.projections.find((p) => p.scenario === scenario && p.year === 2050)?.ESI_max, 1)}`} note="εθνικός ESI, 8 μοντέλα" />
      </div>
      <Card title={region ? `${region}: ESI μετρήσεις και προβλέψεις` : 'Ελλάδα: ESI μετρήσεις και προβλέψεις'} sub="διάμεσος 8 μοντέλων · σκίαση: εύρος 10–90%">
        <TimeChart data={region && reg.data ? series(reg.data.projections, reg.data.observed) : natSeries}
          series={[{ key: 'obs', name: 'Μετρήσεις', color: '#fe9f6d', dot: true }, { key: 's245', name: 'SSP2-4.5', color: '#5aa9e6', dashed: true }, { key: 's585', name: 'SSP5-8.5', color: '#f0704a', dashed: true }]}
          bands={[{ lo: 's245lo', hi: 's245hi', color: '#5aa9e6', name: 'εύρος SSP2-4.5' }, { lo: 's585lo', hi: 's585hi', color: '#f0704a', name: 'εύρος SSP5-8.5' }]}
          height={300} refX={{ x: n.last_complete_year, label: 'σήμερα' }} shadeFrom={n.last_complete_year} />
      </Card>
      <div className="grid lg:grid-cols-2 gap-4">
        {[['ssp245', a.data] as const, ['ssp585', b.data] as const].map(([sc, l]) => (
          <Card key={sc} title={`${SC[sc]} · ${snap ? `${year - 9}–${year}` : year}`} sub={useChange ? 'μεταβολή ESI έναντι κλίματος 1995–2014' : 'ESI (διάμεσος μοντέλων)'}>
            <GreeceMap values={useChange ? dvals(l) : (l?.values ?? {})} palette={pal} domain={dom} forecast height={380} tooltip={tip(sc, l)} cities={false} />
            <div className="mt-3"><Legend palette={pal} domain={dom} unit={useChange ? 'μον.' : '/100'} title={useChange ? 'Μεταβολή ESI' : 'ESI'} forecast /></div>
          </Card>
        ))}
      </div>
      {!snap && mode === 'change' && <div className="text-[12.5px] text-muted">Οι χάρτες μεταβολής υπάρχουν για τις δεκαετίες 2021–2030, 2031–2040, 2041–2050 (κουμπιά 2030/2040/2050). Για ενδιάμεσα έτη δείχνεται η τιμή.</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Περιφέρειες όπου η καταλληλότητα αυξάνεται" sub={`${SC[scenario]} · ${snap ? `${year - 9}–${year}` : year}`}>
          <RegionChange rows={up} />
        </Card>
        <Card title="Περιφέρειες όπου μειώνεται">
          {down.length ? <RegionChange rows={down} /> : <div className="text-[13px] text-soft">Σε αυτό το σενάριο και έτος καμία περιφέρεια δεν έχει μείωση κατά μέσο όρο.</div>}
        </Card>
      </div>
      <Card title="Αβεβαιότητα: κάθε μοντέλο χωριστά" sub={`εθνικός ESI ανά μοντέλο, ${SC[scenario]}`}>
        <TimeChart data={Array.from(new Set((pr.data?.by_model ?? []).map((r) => r.year))).sort().map((y) => {
          const row: Record<string, number> = { year: y }
          for (const r of (pr.data?.by_model ?? []).filter((x) => x.year === y && x.scenario === scenario)) row[r.model] = r.ESI
          return row
        })} series={m.models.map((mo, i) => ({ key: mo, name: mo, color: ['#5aa9e6', '#f0704a', '#4cc38a', '#c792ea', '#ffcf70', '#8fb8de', '#de4968', '#b5bfcf'][i % 8], width: 1.2 }))} height={260} digits={1} />
        <div className="text-[12px] text-muted mt-2">Η διασπορά των μοντέλων είναι η κύρια αβεβαιότητα. Η επιλογή βαρών και παραμέτρων του δείκτη αναλύεται στη σελίδα «Αφθονία & επικύρωση».</div>
      </Card>
    </Page>
  )
}

function RegionChange({ rows }: { rows: { region: string; change: number; esi: number }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.region} className="grid grid-cols-[1fr_120px_56px] items-center gap-2 text-[13px]">
          <span>{r.region}</span>
          <div className="h-2 rounded bg-panel-2 overflow-hidden"><div className="h-full" style={{ width: `${Math.min(1, Math.abs(r.change) / 8) * 100}%`, background: r.change > 0 ? '#ef8a62' : '#67a9cf' }} /></div>
          <span className={`num text-right ${r.change > 0 ? 'text-up' : 'text-down'}`}>{signed(r.change, 1)}</span>
        </div>
      ))}
    </div>
  )
}
