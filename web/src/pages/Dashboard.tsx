import { Link } from 'react-router-dom'
import { useApi, type MapLayer, type Meta, type National } from '../api'
import { Card, ErrorBox, ForecastNote, Loading, Page, Stat } from '../components/Layout'
import GreeceMap, { Legend } from '../components/GreeceMap'
import { TimeChart } from '../components/Charts'
import { LAYER_INFO, MONTHS_LONG, esiWord, nf, pfmt, signed } from '../fmt'

export default function Dashboard() {
  const meta = useApi<Meta>('/api/meta')
  const nat = useApi<National>('/api/national')
  const ly = meta.data?.last_complete_year
  const map = useApi<MapLayer>(ly ? `/api/map?layer=ESI&year=${ly}` : null)
  if (meta.error || nat.error) return <ErrorBox error={(meta.error || nat.error)!} />
  if (!meta.data || !nat.data) return <Loading />
  const m = meta.data, n = nat.data
  const annual = n.annual.filter((a) => a.ESI != null) as { year: number; ESI: number; ESI_eq: number }[]
  const season = (y0: number, y1: number) => {
    const rows = n.monthly.filter((r) => (r.year as number) >= y0 && (r.year as number) <= y1 && (r.month as number) >= 5 && (r.month as number) <= 10 && r.ESI != null)
    return rows.length ? rows.reduce((s, r) => s + (r.ESI as number), 0) / rows.length : null
  }
  const now5 = n.periods[`${n.last_complete_year - 4}–${n.last_complete_year}`]
  const old = n.periods['2001–2010']
  const tr = n.trends.ESI
  const p50 = (s: string) => n.projections.find((p) => p.scenario === s && p.year === 2050)
  const p25 = (s: string) => n.projections.find((p) => p.scenario === s && p.year === n.last_complete_year)
  const chart = [
    ...annual.map((a) => ({ year: a.year, obs: a.ESI })),
    ...Array.from(new Set(n.projections.map((p) => p.year))).filter((y) => y >= n.last_complete_year).map((y) => {
      const a = n.projections.find((p) => p.year === y && p.scenario === 'ssp245')!, b = n.projections.find((p) => p.year === y && p.scenario === 'ssp585')!
      return { year: y, s245: a.ESI_med, s585: b.ESI_med, lo: Math.min(a.ESI_p10, b.ESI_p10), hi: Math.max(a.ESI_p90, b.ESI_p90) }
    }),
  ]
  const top = n.regions.slice(0, 5), bottom = n.regions.slice(-5).reverse()
  const info = LAYER_INFO.ESI
  return (
    <Page eyebrow="Επισκόπηση" title="Πόσο ευνοϊκή είναι η Ελλάδα για το κουνούπι τίγρη;"
      lead={<>Ο Environmental Suitability Index (ESI, 0–100) συνδυάζει θερμοκρασία, βροχή, υγρασία, άνεμο και βλάστηση από δεδομένα της NASA σε όλη την Ελλάδα, από το 1981 (το NDVI από το 2000). Δείχνει πόσο ευνοϊκές είναι οι <b>περιβαλλοντικές συνθήκες</b>, όχι πόσα κουνούπια υπάρχουν.</>}>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label={`ESI Ελλάδας, ${n.last_complete_year - 4}–${n.last_complete_year}`} value={nf(now5, 1)} unit="/100" note={<>μέσος όλων των μηνών · {esiWord(now5)}</>} />
        <Stat label="ESI εποχής δραστηριότητας (Μάι–Οκτ)" value={nf(season(n.last_complete_year - 4, n.last_complete_year), 1)} unit="/100" note={<>2001–2010: <span className="num">{nf(season(2001, 2010), 1)}</span></>} />
        <Stat label="Μεταβολή από το 2001–2010" value={signed(now5 != null && old != null ? now5 - old : null, 1)} tone={(now5 ?? 0) > (old ?? 0) ? 'up' : 'down'} note={<>από <span className="num">{nf(old, 1)}</span> σε <span className="num">{nf(now5, 1)}</span></>} />
        <Stat label={`Τάση ESI 2001–${n.last_complete_year}`} value={signed(tr?.sen_decade, 2)} unit="/10 έτη" tone={tr?.significant ? 'up' : 'none'} note={<>Mann-Kendall p = <span className="num">{pfmt(tr?.p)}</span> · {tr?.significant ? 'στατιστικά σίγουρη' : 'όχι σίγουρη'}</>} />
        <Stat label="Πρόβλεψη 2050 (διάμεσος μοντέλων)" value={`${nf(p50('ssp245')?.ESI_med, 1)} / ${nf(p50('ssp585')?.ESI_med, 1)}`} note={<>SSP2-4.5 / SSP5-8.5 · σήμερα (μοντέλα) <span className="num">{nf(p25('ssp245')?.ESI_med, 1)}</span></>} />
      </div>

      <div className="grid lg:grid-cols-[1.25fr_1fr] gap-4">
        <Card title={`Χάρτης ESI ${n.last_complete_year}`} sub="Μέσος όρος των 12 μηνών σε κάθε κελί 0,5° × 0,625° (ελληνική στεριά)" right={<Link to="/map" className="btn">Πλήρης χάρτης →</Link>}>
          {map.data ? (
            <>
              <GreeceMap values={map.data.values} palette={info.palette} domain={[10, 50]} height={430}
                tooltip={(id, v) => { const c = m.cells.find((x) => x.cell === id); return `<b>${c?.region ?? id}</b><br/>ESI ${n.last_complete_year}: <b>${nf(v, 0)}</b>/100` }} />
              <div className="mt-3"><Legend palette={info.palette} domain={[10, 50]} unit="/100" title="ESI (ετήσιος)" /></div>
            </>
          ) : <Loading what="χάρτη" />}
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="Περιφέρειες με τη μεγαλύτερη καταλληλότητα" sub={`μέσος ESI ${n.last_complete_year - 4}–${n.last_complete_year} · μεταβολή από το 2001–2010`}>
            <RegionList rows={top} />
          </Card>
          <Card title="Περιφέρειες με τη μικρότερη καταλληλότητα">
            <RegionList rows={bottom} />
          </Card>
        </div>
      </div>

      <Card title="Πορεία του ESI: μετρήσεις 2001–2025 και προβλέψεις έως 2050" sub="Παρατηρήσεις NASA (συνεχής) · διάμεσος 8 μοντέλων CMIP6 (διακεκομμένες) · σκίαση: εύρος 10–90% των μοντέλων και των δύο σεναρίων">
        <TimeChart data={chart} series={[{ key: 'obs', name: 'Μετρήσεις', color: '#fe9f6d', dot: true }, { key: 's245', name: 'SSP2-4.5', color: '#5aa9e6', dashed: true }, { key: 's585', name: 'SSP5-8.5', color: '#f0704a', dashed: true }]}
          bands={[{ lo: 'lo', hi: 'hi', color: '#f5a524', name: 'εύρος μοντέλων' }]} height={300} refX={{ x: n.last_complete_year, label: 'σήμερα' }} shadeFrom={n.last_complete_year} />
        <div className="mt-3"><ForecastNote /></div>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Τι σημαίνει για τη δημόσια υγεία" className="md:col-span-2">
          <p className="text-[13.5px] text-soft leading-relaxed">Το <i>Aedes albopictus</i> μπορεί να μεταδώσει τους ιούς <b>Chikungunya</b>, <b>Dengue</b> και <b>Zika</b>. Ευνοϊκές περιβαλλοντικές συνθήκες σημαίνουν περισσότερες δυνατότητες αναπαραγωγής και δραστηριότητας του κουνουπιού, άρα και μεγαλύτερη δυνητική επικινδυνότητα όταν ένας ιός φτάσει στην περιοχή.</p>
          <p className="text-[13px] text-muted leading-relaxed mt-2"><b className="text-soft">Επιστημονική διευκρίνιση:</b> η αυξημένη περιβαλλοντική καταλληλότητα και αφθονία του κουνουπιού δεν συνεπάγονται αυτόματα μετάδοση ιών. Για να υπάρξει μετάδοση πρέπει να υπάρχει και ο αντίστοιχος ιός στην περιοχή (συνήθως από ταξιδιώτη με λοίμωξη). Η εφαρμογή δεν υπολογίζει κίνδυνο μετάδοσης.</p>
        </Card>
        <Card title="Δεδομένα">
          <ul className="text-[12.5px] text-soft space-y-1.5">
            <li>Πλέγμα: <span className="num">{m.coverage.cells}</span> κελιά με ελληνική στεριά (NASA POWER, 0,5° × 0,625°)</li>
            <li>T2M, βροχή, υγρασία, άνεμος: <span className="num">{m.coverage.T2M.first} → {m.coverage.T2M.last}</span></li>
            <li>NDVI (MODIS): <span className="num">{m.coverage.NDVI.first} → {m.coverage.NDVI.last}</span></li>
            <li>ESI (κοινή περίοδος): <span className="num">{m.coverage.common_period.first} → {m.coverage.common_period.last}</span></li>
            <li>Τελευταίος μήνας: {MONTHS_LONG[m.last_month.month]} {m.last_month.year} · το {m.last_month.year} δεν είναι πλήρες έτος</li>
            <li>Προβλέψεις: {m.models.length} μοντέλα CMIP6, SSP2-4.5 και SSP5-8.5</li>
          </ul>
        </Card>
      </div>
    </Page>
  )
}

function RegionList({ rows }: { rows: { region: string; esi: number; change: number | null }[] }) {
  const max = 50
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.region} className="grid grid-cols-[1fr_120px_56px_52px] items-center gap-2 text-[13px]">
          <span>{r.region}</span>
          <div className="h-2 rounded bg-panel-2 overflow-hidden"><div className="h-full" style={{ width: `${Math.min(1, r.esi / max) * 100}%`, background: 'linear-gradient(90deg,#8c2981,#fe9f6d)' }} /></div>
          <span className="num text-right">{nf(r.esi, 1)}</span>
          <span className={`num text-right text-[12px] ${(r.change ?? 0) > 0 ? 'text-up' : 'text-down'}`}>{signed(r.change, 1)}</span>
        </div>
      ))}
    </div>
  )
}
