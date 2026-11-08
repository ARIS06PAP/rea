// Home: one sentence and a map first, a city search, three big numbers, then regions, the timeline
// 2001→2050 and the public-health note. Details live on the other pages.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApi, type MapLayer, type Meta, type National, type Place } from '../api'
import { Card, ErrorBox, Loading } from '../components/Layout'
import GreeceMap, { Legend } from '../components/GreeceMap'
import { TimeChart } from '../components/Charts'
import { LAYER_INFO, esiWord, nf, signed } from '../fmt'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export default function Dashboard() {
  const meta = useApi<Meta>('/api/meta')
  const nat = useApi<National>('/api/national')
  const places = useApi<Place[]>('/api/places')
  const ly = meta.data?.last_complete_year
  const map = useApi<MapLayer>(ly ? `/api/map?layer=ESI&year=${ly}` : null)
  if (meta.error || nat.error) return <ErrorBox error={(meta.error || nat.error)!} />
  if (!meta.data || !nat.data) return <Loading />
  const m = meta.data, n = nat.data
  const now5 = n.periods[`${n.last_complete_year - 4}–${n.last_complete_year}`]
  const old = n.periods['2001–2010']
  const tr = n.trends.ESI
  const c245 = n.change_2050?.ssp245, c585 = n.change_2050?.ssp585
  const rising = !!tr?.significant && tr.sen_decade > 0
  const warm = n.monthly.filter((r) => (r.year as number) >= n.last_complete_year - 4 && (r.year as number) <= n.last_complete_year && (r.month as number) >= 5 && (r.month as number) <= 10 && r.ESI != null)
  const warmMean = warm.length ? warm.reduce((s, r) => s + (r.ESI as number), 0) / warm.length : null
  const annual = n.annual.filter((a) => a.ESI != null && (a.year as number) <= n.last_complete_year) as { year: number; ESI: number }[]
  const chart = [
    ...annual.map((a) => ({ year: a.year, obs: a.ESI })),
    ...Array.from(new Set(n.projections.map((p) => p.year))).filter((y) => y >= n.last_complete_year).map((y) => {
      const a = n.projections.find((p) => p.year === y && p.scenario === 'ssp245')!, b = n.projections.find((p) => p.year === y && p.scenario === 'ssp585')!
      return { year: y, s245: a.ESI_med, s585: b.ESI_med, lo: Math.min(a.ESI_p10, b.ESI_p10), hi: Math.max(a.ESI_p90, b.ESI_p90) }
    }),
  ]
  const top = n.regions.slice(0, 4), bottom = n.regions.slice(-4).reverse()
  const info = LAYER_INFO.ESI
  return (
    <div className="flex flex-col gap-6">
      <section className="grid lg:grid-cols-[1fr_1.1fr] gap-8 items-center pt-2">
        <div className="flex flex-col gap-5">
          <div className="eyebrow">Το κουνούπι τίγρη στην Ελλάδα · 1981–2050</div>
          <h1 className="text-[30px] md:text-[42px] font-semibold leading-[1.12] tracking-tight">
            {rising ? 'Οι συνθήκες για το κουνούπι τίγρη γίνονται πιο ευνοϊκές.' : 'Πόσο ευνοούν οι συνθήκες το κουνούπι τίγρη;'}
          </h1>
          <p className="text-soft text-[16.5px] leading-relaxed max-w-xl">Ένας δείκτης από 0 ως 100, από δεδομένα της NASA, για κάθε περιοχή της Ελλάδας: πόσο ευνοεί το κλίμα το <i>Aedes albopictus</i>.</p>
          {places.data && <CitySearch places={places.data} />}
          <div className="text-[12.5px] text-muted">Δείχνει καταλληλότητα του περιβάλλοντος, όχι πόσα κουνούπια υπάρχουν ούτε κρούσματα.</div>
        </div>
        <div className="card p-3">
          {map.data ? (
            <>
              <GreeceMap values={map.data.values} palette={info.palette} domain={[10, 50]} height={430}
                tooltip={(id, v) => { const c = m.cells.find((x) => x.cell === id); return `<b>${c?.region ?? id}</b><br/>Καταλληλότητα ${n.last_complete_year}: <b>${nf(v, 0)}</b>/100 · ${esiWord(v)}` }} />
              <div className="mt-2 px-1 flex items-end gap-4">
                <div className="grow"><Legend palette={info.palette} domain={[10, 50]} unit="/100" title={`Καταλληλότητα ${n.last_complete_year}`} /></div>
                <Link to="/map" className="btn shrink-0">Χάρτης →</Link>
              </div>
            </>
          ) : <Loading what="χάρτη" />}
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <Fact label={`Σήμερα (${n.last_complete_year - 4}–${n.last_complete_year})`} value={nf(now5, 0)} unit="/100"
          text={<>{esiWord(now5)} συνθήκες κατά μέσο όρο στην Ελλάδα. Από τον Μάιο ως τον Οκτώβριο: {nf(warmMean, 0)}.</>} />
        <Fact label="Από το 2001" value={signed(tr?.sen_decade, 1)} unit="ανά 10 χρόνια" tone={rising ? 'up' : undefined}
          text={tr?.significant ? <>Η καταλληλότητα ανεβαίνει, και η άνοδος είναι στατιστικά σίγουρη. Από {nf(old, 1)} σε {nf(now5, 1)}.</> : <>Χωρίς στατιστικά σίγουρη τάση.</>} />
        <Fact label="Ως το 2041–2050" value={`${signed(c245?.change, 1)} έως ${signed(c585?.change, 1)}`} forecast
          text={<>Επιπλέον άνοδος, ενδιάμεσο έως υψηλό σενάριο εκπομπών, {(c585?.share_up ?? 0) >= 0.995 ? "σε όλες τις περιοχές" : `σε ${nf((c585?.share_up ?? 0) * 100, 0)}% των περιοχών`}. Πρόβλεψη 8 μοντέλων.</>} />
      </section>

      <section className="grid lg:grid-cols-[1fr_1.35fr] gap-4">
        <Card title="Πού ευνοείται περισσότερο και λιγότερο" sub={`Περιφέρειες, ${n.last_complete_year - 4}–${n.last_complete_year} · σε παρένθεση η αλλαγή από το 2001–2010`}>
          <RegionList rows={top} />
          <div className="border-t border-line my-3" />
          <RegionList rows={bottom} />
        </Card>
        <Card title="Από το 2001 ως το 2050" sub="Μέσος όρος Ελλάδας: μετρήσεις NASA και πρόβλεψη 8 κλιματικών μοντέλων (σκίαση: εύρος μοντέλων)">
          <TimeChart data={chart} series={[{ key: 'obs', name: 'Μετρήσεις', color: '#fe9f6d', dot: true }, { key: 's245', name: 'Ενδιάμεσο σενάριο', color: '#5aa9e6', dashed: true }, { key: 's585', name: 'Υψηλό σενάριο', color: '#f0704a', dashed: true }]}
            bands={[{ lo: 'lo', hi: 'hi', color: '#f5a524', name: 'εύρος μοντέλων' }]} height={290} refX={{ x: n.last_complete_year, label: 'σήμερα' }} shadeFrom={n.last_complete_year} />
        </Card>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <Go to="/compare?a=Αθήνα&b=Θεσσαλονίκη" title="Σύγκρινε δύο πόλεις" text="Αθήνα ή Θεσσαλονίκη; Ή όποιες άλλες θέλεις." />
        <Go to="/map" title="Δες τον χάρτη" text="Κάθε περιοχή, κάθε μήνας, από το 2000 ως το 2050." />
        <Go to="/future" title="Τι έρχεται ως το 2050" text="Δύο σενάρια εκπομπών και η αβεβαιότητα των μοντέλων." />
      </section>

      <section className="card p-5 grid md:grid-cols-[200px_1fr] gap-x-6 gap-y-2">
        <div className="eyebrow pt-1">Δημόσια υγεία</div>
        <div className="text-[14.5px] leading-relaxed">
          <p>Το κουνούπι τίγρη μπορεί να μεταδώσει <b>chikungunya</b>, <b>dengue</b> και <b>Zika</b>. Πιο ευνοϊκές συνθήκες μπορεί να σημαίνουν περισσότερα κουνούπια, για περισσότερους μήνες.</p>
          <p className="text-muted mt-1.5">Αυτό δεν σημαίνει μετάδοση: για να υπάρξει, πρέπει να φτάσει και ο ιός στην περιοχή, συνήθως με έναν ταξιδιώτη. Η εφαρμογή δεν υπολογίζει κίνδυνο μετάδοσης.</p>
        </div>
      </section>
    </div>
  )
}

function CitySearch({ places }: { places: Place[] }) {
  const go = useNavigate()
  const [text, setText] = useState('')
  const [miss, setMiss] = useState(false)
  const submit = () => {
    const p = places.find((x) => norm(x.name) === norm(text)) ?? places.find((x) => norm(x.name).startsWith(norm(text)) && norm(text).length >= 3)
    if (!p) { setMiss(true); return }
    go(`/compare?a=${encodeURIComponent(p.name)}&b=${encodeURIComponent(p.name === 'Αθήνα' ? 'Θεσσαλονίκη' : 'Αθήνα')}`)
  }
  return (
    <form className="flex flex-col gap-1.5 max-w-xl" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <div className="flex gap-2">
        <input list="home-places" value={text} onChange={(e) => { setText(e.target.value); setMiss(false) }} placeholder="Γράψε την πόλη σου, π.χ. Λάρισα" autoComplete="off"
          className="sel grow !text-[16px] !py-3 !px-4" aria-label="Πόλη" />
        <button className="btn on !px-5 !text-[14.5px]" type="submit">Δες την →</button>
      </div>
      <datalist id="home-places">{places.map((p) => <option key={p.name} value={p.name} />)}</datalist>
      {miss && <div className="text-[12.5px] text-up">Δεν τη βρήκα. Δοκίμασε μια από τις {places.length} πόλεις της λίστας.</div>}
      <div className="text-[13px] text-muted">Δοκίμασε: {['Λάρισα', 'Πάτρα', 'Ηράκλειο', 'Ιωάννινα'].map((c, i) => (
        <span key={c}>{i > 0 && ' · '}<Link className="text-soft hover:text-accent underline-offset-2 hover:underline" to={`/compare?a=${encodeURIComponent(c)}&b=Αθήνα`}>{c}</Link></span>
      ))}</div>
    </form>
  )
}

function Fact({ label, value, unit, text, tone, forecast }: { label: string; value: string; unit?: string; text: React.ReactNode; tone?: 'up'; forecast?: boolean }) {
  return (
    <div className={`card p-5 flex flex-col gap-1.5 ${forecast ? 'border-dashed !border-accent/50' : ''}`}>
      <div className="flex items-center gap-2 text-[12.5px] text-muted">{label}{forecast && <span className="forecast-badge rounded px-1.5 py-px text-[10px] font-semibold">ΠΡΟΒΛΕΨΗ</span>}</div>
      <div className={`num text-[34px] font-semibold leading-none ${tone === 'up' ? 'text-up' : ''}`}>{value}{unit && <span className="text-[14px] text-muted font-normal ml-1.5">{unit}</span>}</div>
      <div className="text-[13.5px] text-soft leading-snug mt-1">{text}</div>
    </div>
  )
}

function Go({ to, title, text }: { to: string; title: string; text: string }) {
  return (
    <Link to={to} className="card p-4 group hover:border-accent transition">
      <div className="font-semibold text-[15px] group-hover:text-accent transition">{title} →</div>
      <div className="text-[13px] text-muted mt-1">{text}</div>
    </Link>
  )
}

function RegionList({ rows }: { rows: { region: string; esi: number; change: number | null }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.region} className="grid grid-cols-[1fr_110px_76px] items-center gap-3 text-[13.5px]">
          <span>{r.region}</span>
          <div className="h-2 rounded bg-panel-2 overflow-hidden"><div className="h-full rounded" style={{ width: `${Math.min(1, r.esi / 50) * 100}%`, background: 'linear-gradient(90deg,#8c2981,#fe9f6d)' }} /></div>
          <span className="num text-right">{nf(r.esi, 0)} <span className={`text-[12px] ${(r.change ?? 0) > 0 ? 'text-up' : 'text-down'}`}>({signed(r.change, 1)})</span></span>
        </div>
      ))}
    </div>
  )
}
