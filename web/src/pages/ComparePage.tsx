// Two places side by side: one verdict sentence, a few rows of plain numbers, the year of the
// mosquito month by month, the history since 2001 and where they are on the map.
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApi, type MapLayer, type Meta, type Place, type Summary } from '../api'
import { Card, ErrorBox, Loading, Page } from '../components/Layout'
import GreeceMap, { Legend } from '../components/GreeceMap'
import PlacePicker, { keyForCell, resolvePlace, type ResolvedPlace } from '../components/PlacePicker'
import { MonthLines, TimeChart } from '../components/Charts'
import { LAYER_INFO, MONTHS, esiWord, monthRange, nf, pctWord, signed } from '../fmt'

const CA = '#fe9f6d', CB = '#5aa9e6'
const FACTOR: Record<string, string> = { sT: 'η θερμοκρασία', sP: 'η βροχή', sRH: 'η υγρασία', sW: 'ο άνεμος', sNDVI: 'η βλάστηση' }
const WKEY: Record<string, 'T' | 'P' | 'RH' | 'W' | 'NDVI'> = { sT: 'T', sP: 'P', sRH: 'RH', sW: 'W', sNDVI: 'NDVI' }

export default function ComparePage() {
  const meta = useApi<Meta>('/api/meta')
  const places = useApi<Place[]>('/api/places')
  const [sp, setSp] = useSearchParams()
  const aKey = sp.get('a') || 'Αθήνα'
  const bKey = sp.get('b') || (aKey === 'Θεσσαλονίκη' ? 'Αθήνα' : 'Θεσσαλονίκη')
  const A = resolvePlace(aKey, places.data, meta.data?.cells)
  const B = resolvePlace(bKey, places.data, meta.data?.cells)
  const sa = useApi<Summary>(A ? `/api/summary/${A.cell}` : null)
  const sb = useApi<Summary>(B ? `/api/summary/${B.cell}` : null)
  const ly = meta.data?.last_complete_year
  const nowMap = useApi<MapLayer>(ly ? `/api/map?layer=ESI&year=${ly}` : null)
  const set = (k: 'a' | 'b', v: string) => { const n = new URLSearchParams(sp); n.set(k, v); if (!n.get(k === 'a' ? 'b' : 'a')) n.set(k === 'a' ? 'b' : 'a', k === 'a' ? bKey : aKey); setSp(n, { replace: true }) }
  const swap = () => setSp(new URLSearchParams({ a: bKey, b: aKey }), { replace: true })
  const highlight = useMemo(() => [A && { cell: A.cell, color: CA }, B && { cell: B.cell, color: CB }].filter(Boolean) as { cell: string; color: string }[], [A?.cell, B?.cell])

  if (meta.error || places.error) return <ErrorBox error={(meta.error || places.error)!} />
  if (!meta.data || !places.data) return <Loading />
  const a = sa.data, b = sb.data
  const title = A && B ? `${A.name} ή ${B.name};` : 'Σύγκρινε δύο πόλεις'

  return (
    <Page eyebrow="Σύγκριση" title={title} lead="Πού ευνοούν περισσότερο οι συνθήκες το κουνούπι τίγρη, σήμερα και ως το 2050.">
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <PlacePicker label="Πόλη Α" color={CA} places={places.data} value={A} onChange={(v) => set('a', v)} />
        <button className="btn !py-2.5 !px-3 mb-px" onClick={swap} title="Αντιμετάθεση" aria-label="Αντιμετάθεση των δύο πόλεων">⇄</button>
        <PlacePicker label="Πόλη Β" color={CB} places={places.data} value={B} onChange={(v) => set('b', v)} />
      </div>

      {(!a || !b || !A || !B) ? <Loading what="σύγκρισης" /> : (
        <>
          <Verdict A={A} B={B} a={a} b={b} weights={meta.data.weights.main} />
          <div className="grid xl:grid-cols-[1fr_400px] gap-4 items-start">
            <Card>
              <Rows A={A} B={B} a={a} b={b} />
            </Card>
            <Card title="Πού βρίσκονται" sub="Κάνε κλικ στον χάρτη για να αλλάξεις την πόλη Β">
              {nowMap.data && <GreeceMap values={nowMap.data.values} palette={LAYER_INFO.ESI.palette} domain={[10, 50]} height={360} highlight={highlight}
                onSelect={(cell) => set('b', keyForCell(cell, places.data))}
                tooltip={(id, v) => `<b>${places.data!.find((p) => p.cell === id)?.name ?? meta.data!.cells.find((c) => c.cell === id)?.region ?? id}</b><br/>Καταλληλότητα ${ly}: <b>${nf(v, 0)}</b>/100`} />}
              <div className="mt-3"><Legend palette={LAYER_INFO.ESI.palette} domain={[10, 50]} unit="/100" title={`Καταλληλότητα ${ly}`} /></div>
            </Card>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Η χρονιά του κουνουπιού" sub={`Καταλληλότητα κάθε μήνα, μέσος όρος 2016–2025 · πάνω από τη γραμμή: ευνοϊκές συνθήκες`}>
              <MonthLines data={MONTHS.slice(1).map((label, i) => ({ label, a: a.monthly.now[i], b: b.monthly.now[i] }))}
                series={[{ key: 'a', name: A.name, color: CA }, { key: 'b', name: B.name, color: CB }]} threshold={{ y: a.favourable_threshold, label: 'ευνοϊκές' }} height={260} />
            </Card>
            <Card title="Από το 2001 ως σήμερα" sub="Καταλληλότητα κάθε χρονιάς (μετρήσεις NASA)">
              <TimeChart data={mergeYears(a.annual, b.annual)} series={[{ key: 'a', name: A.name, color: CA, dot: true }, { key: 'b', name: B.name, color: CB, dot: true }]} height={260} digits={1} />
            </Card>
          </div>
          <details className="card p-4 text-[13px] text-soft leading-relaxed">
            <summary className="cursor-pointer text-fg font-medium">Πώς διαβάζεται η σύγκριση</summary>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>Η καταλληλότητα (ESI, 0–100) δείχνει πόσο ευνοούν οι συνθήκες το κουνούπι, όχι πόσα κουνούπια υπάρχουν ούτε κίνδυνο ασθένειας.</li>
              <li>Κάθε πόλη παίρνει τις τιμές του κελιού της NASA (περίπου 55 × 55 km), άρα δείχνει το κλίμα της περιοχής και όχι κάθε γειτονιάς.</li>
              <li>«Ευνοϊκός μήνας» = καταλληλότητα τουλάχιστον {a.favourable_threshold} στα 100. «Σίγουρη τάση» = πέρασε τον έλεγχο Mann-Kendall με διόρθωση για πολλούς ελέγχους.</li>
              <li>Το 2050 είναι πρόβλεψη 8 κλιματικών μοντέλων, ως αλλαγή από το κλίμα 1995–2014. <Link className="text-accent hover:underline" to="/science">Η μέθοδος αναλυτικά →</Link></li>
            </ul>
          </details>
        </>
      )}
    </Page>
  )
}

function mergeYears(a: { year: number; v: number }[], b: { year: number; v: number }[]) {
  const years = Array.from(new Set([...a, ...b].map((r) => r.year))).sort((x, y) => x - y)
  return years.map((year) => ({ year, a: a.find((r) => r.year === year)?.v ?? null, b: b.find((r) => r.year === year)?.v ?? null }))
}

function Verdict({ A, B, a, b, weights }: { A: ResolvedPlace; B: ResolvedPlace; a: Summary; b: Summary; weights: Record<string, number> }) {
  if (A.cell === B.cell) {
    return <div className="card p-4 text-[15px] text-soft">Οι δύο πόλεις πέφτουν στο ίδιο κελί της NASA (περίπου 55 × 55 km), οπότε έχουν τις ίδιες τιμές.</div>
  }
  const x = a.esi_now ?? 0, y = b.esi_now ?? 0, d = x - y
  // biggest weighted difference among the five factors, on the side of the winner when possible
  const diffs = (Object.keys(FACTOR) as (keyof Summary['factors'])[]).map((k) => {
    const w = weights[WKEY[k]] ?? 0
    return { k, v: w * (Math.log(Math.max(a.factors[k], 1e-3)) - Math.log(Math.max(b.factors[k], 1e-3))) }
  })
  const pick = diffs.filter((f) => Math.sign(f.v) === Math.sign(d)).sort((p, q) => Math.abs(q.v) - Math.abs(p.v))[0]
    ?? diffs.sort((p, q) => Math.abs(q.v) - Math.abs(p.v))[0]
  // the winner always comes first, every value carries its place's colour and name
  const W = d >= 0 ? { p: A, s: a, c: CA } : { p: B, s: b, c: CB }
  const L = d >= 0 ? { p: B, s: b, c: CB } : { p: A, s: a, c: CA }
  const two = (f: (s: Summary) => string, unit = '') => (
    <><span style={{ color: W.c }}>{W.p.name} {f(W.s)}</span> · <span style={{ color: L.c }}>{L.p.name} {f(L.s)}</span>{unit}</>
  )
  const detail: Record<string, React.ReactNode> = {
    sT: <>Ιούλιος {two((s) => nf(s.climate.t_jul, 1), ' °C')}, Ιανουάριος {two((s) => nf(s.climate.t_jan, 1), ' °C')}</>,
    sP: <>{two((s) => nf(s.climate.rain_year, 0), ' mm τον χρόνο')}</>,
    sRH: <>{two((s) => nf(s.climate.rh, 0), ' %')}</>,
    sW: <>{two((s) => nf(s.climate.wind, 1), ' m/s κατά μέσο όρο')}</>,
    sNDVI: <>NDVI {two((s) => nf(s.climate.ndvi, 2))}</>,
  }
  const up = a.proj.ssp245.change != null && b.proj.ssp245.change != null
  return (
    <div className="card p-5 flex flex-col gap-2">
      {Math.abs(d) < 1.5
        ? <div className="text-[19px] md:text-[21px] font-semibold leading-snug">Σχεδόν ίδιες συνθήκες σήμερα: {two((s) => nf(s.esi_now, 0))} <span className="text-muted font-normal text-[15px]">στα 100</span></div>
        : <div className="text-[19px] md:text-[21px] font-semibold leading-snug">Πιο ευνοϊκή σήμερα: <span style={{ color: W.c }}>{W.p.name}</span> <span className="text-muted font-normal text-[15px] ml-1"><span className="num">{nf(W.s.esi_now, 0)}</span> έναντι <span className="num">{nf(L.s.esi_now, 0)}</span> στα 100</span></div>}
      {pick && Math.abs(d) >= 1.5 && <div className="text-[14.5px] text-soft">Η μεγαλύτερη διαφορά είναι <b className="text-fg">{FACTOR[pick.k]}</b>: <span className="num">{detail[pick.k]}</span>.</div>}
      {up && <div className="text-[14.5px] text-soft">Ως το 2041–2050, ενδιάμεσο σενάριο <span className="text-muted">(πρόβλεψη)</span>: <span className="num">{two((s) => signed(s.proj.ssp245.change, 1))}</span></div>}
    </div>
  )
}

function Rows({ A, B, a, b }: { A: ResolvedPlace; B: ResolvedPlace; a: Summary; b: Summary }) {
  const cell = (v: React.ReactNode, sub?: React.ReactNode) => (
    <div><div className="num text-[22px] font-semibold leading-tight">{v}</div>{sub && <div className="text-[12.5px] text-soft mt-0.5">{sub}</div>}</div>
  )
  const trendCell = (s: Summary) => s.trend?.significant
    ? cell(<span className={s.trend.sen_decade > 0 ? 'text-up' : 'text-down'}>{signed(s.trend.sen_decade, 1)}<span className="text-[13px] text-muted font-normal"> /10 χρόνια</span></span>, s.trend.sen_decade > 0 ? 'σίγουρη άνοδος' : 'σίγουρη πτώση')
    : cell(<span className="text-muted">—</span>, <>χωρίς σίγουρη τάση <span className="num text-muted">({signed(s.trend?.sen_decade, 1)})</span></>)
  const projCell = (s: Summary) => {
    const p = s.proj.ssp245, q = s.proj.ssp585
    const agree = q.agree_up != null && q.n_models ? Math.round(q.agree_up * q.n_models) : null
    return cell(<span>{signed(p.change, 1)} <span className="text-muted font-normal">έως</span> {signed(q.change, 1)}</span>,
      <>ενδιάμεσο → υψηλό σενάριο{agree != null ? <> · άνοδος σε {agree}/{q.n_models} μοντέλα</> : null}</>)
  }
  const rows: { label: string; hint: string; fc?: boolean; f: (s: Summary) => React.ReactNode }[] = [
    { label: 'Καταλληλότητα σήμερα', hint: `μέσος όρος ${a.period_now}, 0–100`, f: (s) => cell(<>{nf(s.esi_now, 0)}<span className="text-[13px] text-muted font-normal">/100</span></>, <><Bar v={s.esi_now} /> {esiWord(s.esi_now)} συνθήκες</>) },
    { label: 'Σε σχέση με την Ελλάδα', hint: 'ανάμεσα στα 111 κελιά', f: (s) => <div className="text-[14px] text-soft leading-snug">{pctWord(s.percentile)}</div> },
    { label: 'Ευνοϊκοί μήνες τον χρόνο', hint: `καταλληλότητα ≥ ${a.favourable_threshold}, 2016–2025`, f: (s) => cell(<>{s.season.now.n}<span className="text-[13px] text-muted font-normal"> {s.season.now.n === 1 ? 'μήνας' : 'μήνες'}</span></>, <>{monthRange(s.season.now.months)} · 2001–2010: {s.season.early.n}</>) },
    { label: 'Τάση από το 2001', hint: 'μετρήσεις, έλεγχος σημαντικότητας', f: trendCell },
    { label: 'Ως το 2041–2050', hint: 'αλλαγή από το κλίμα 1995–2014', fc: true, f: projCell },
    { label: 'Χειμώνας και καλοκαίρι', hint: 'μέση θερμοκρασία, 2016–2025', f: (s) => <div className="text-[14px] num">Ιαν {nf(s.climate.t_jan, 1)} °C · Ιουλ {nf(s.climate.t_jul, 1)} °C</div> },
    { label: 'Βροχή και άνεμος', hint: 'μέσοι όροι 2016–2025', f: (s) => <div className="text-[14px] num">{nf(s.climate.rain_year, 0)} mm/χρόνο · {nf(s.climate.wind, 1)} m/s</div> },
  ]
  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-2 sm:grid-cols-[minmax(130px,1fr)_1fr_1fr] gap-4 pb-3 border-b border-line text-[13px] font-semibold">
        <span className="hidden sm:block" />
        <span className="flex items-center gap-2"><i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CA }} />{A.name}</span>
        <span className="flex items-center gap-2"><i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CB }} />{B.name}</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-2 sm:grid-cols-[minmax(130px,1fr)_1fr_1fr] gap-x-4 gap-y-2 py-3.5 border-b border-line last:border-0 items-start">
          <div className="col-span-2 sm:col-span-1">
            <div className="text-[14px] font-medium flex items-center gap-2">{r.label}{r.fc && <span className="forecast-badge rounded px-1.5 py-px text-[10px] font-semibold">ΠΡΟΒΛΕΨΗ</span>}</div>
            <div className="text-[12px] text-muted">{r.hint}</div>
          </div>
          <div>{r.f(a)}</div>
          <div>{r.f(b)}</div>
        </div>
      ))}
    </div>
  )
}

function Bar({ v }: { v: number | null }) {
  return <span className="inline-block align-middle w-16 h-1.5 rounded bg-panel-2 overflow-hidden mr-1"><span className="block h-full rounded" style={{ width: `${Math.min(1, (v ?? 0) / 60) * 100}%`, background: 'linear-gradient(90deg,#8c2981,#fe9f6d)' }} /></span>
}
