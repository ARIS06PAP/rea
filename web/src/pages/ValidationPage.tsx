import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend as RLegend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApi, type Meta } from '../api'
import { Card, ErrorBox, Loading, Page, Stat } from '../components/Layout'
import GreeceMap, { Legend } from '../components/GreeceMap'
import { LAYER_INFO, nf, pfmt, signed } from '../fmt'

type V = {
  validation: {
    gbif: { records_used: number; cells_with_records: number; cells_total: number; years: [number, number]; auc_main_esi: number; auc_equal_weights: number; mean_esi_with_records: number; mean_esi_without: number; by_cell: { cell: string; ESI: number; n: number; first_year: number | null }[] }
    temporal_athens: Record<string, number>; hobo_vs_nasa: Record<string, number>; thessaly_genus_aedes: Record<string, unknown>
  }
  calibration: { split: Record<string, string | number>; chosen: { weights: Record<string, number>; rho_train: number; rho_test: number; auc_train: number; auc_test: number }; equal: Record<string, unknown>; temperature_only: Record<string, unknown>; best_on_grid: { weights: Record<string, number> } }
  sensitivity: { variants: { variant: string; esi_2016_2025?: number; trend_decade?: number; trend_p?: number; d2050_ssp245?: number; d2050_ssp585?: number; athens_2019_rho?: number | null }[]; monte_carlo_weights: { n: number; esi_2016_2025_p05_p95: number[]; athens_rho_p05_p95: number[] } }
  abundance: { athens: { monthly_series: { date: string; rate: number; ESI: number; T2M: number }[]; weekly_spearman_by_lag: { lag_weeks: number; rho_esi: number; rho_temperature_score: number; n: number }[]; seasonal_profile_rate_per_trap_day: Record<string, number>; best_lag_weeks: number } }
}
type Custom = { weights: Record<string, number>; values: Record<string, number | null>; trend: { sen_decade: number; p: number; significant: boolean } | null; projection_2041_2050: Record<string, { esi: number; change: number; min: number; max: number }> }
const AX = { stroke: '#4a566b', tick: { fill: '#8591a6', fontSize: 11 } }
const TT = { contentStyle: { background: '#111723', border: '1px solid #2e3a50', borderRadius: 6, fontSize: 12 } }
const WN: Record<string, string> = { T: 'Θερμοκρασία', P: 'Βροχή', RH: 'Υγρασία', W: 'Άνεμος', NDVI: 'Βλάστηση' }
const WO: Record<string, string> = { T: 'θερμοκρασία', P: 'βροχή', RH: 'υγρασία', W: 'άνεμο', NDVI: 'βλάστηση' }
function variantName(v: string) {
  if (v.startsWith('main')) return 'Κύριος ESI (βαθμονομημένα βάρη)'
  if (v === 'equal') return 'Ίσα βάρη (αρχική προσέγγιση)'
  if (v === 'temperature only') return 'Μόνο θερμοκρασία'
  if (v.startsWith('without ')) return `Χωρίς ${WO[v.slice(8)] ?? v.slice(8)}`
  if (v.startsWith('arithmetic')) return 'Αριθμητικός αντί γεωμετρικού μέσου'
  if (v.startsWith('NDVI ×')) return `NDVI ×${v.split('×')[1].split(' ')[0].replace('.', ',')} στο μέλλον`
  return `Παράμετρος ${v.replace('-', '−')}`
}

export default function ValidationPage() {
  const meta = useApi<Meta>('/api/meta')
  const v = useApi<V>('/api/validation')
  const [w, setW] = useState({ T: 0.56, P: 0.25, RH: 0.02, W: 0.15, NDVI: 0.02 })
  const [applied, setApplied] = useState(w)
  const cu = useApi<Custom>(`/api/custom?wT=${applied.T}&wP=${applied.P}&wRH=${applied.RH}&wW=${applied.W}&wN=${applied.NDVI}&year=2025`)
  if (meta.error || v.error) return <ErrorBox error={(meta.error || v.error)!} />
  if (!meta.data || !v.data) return <Loading />
  const m = meta.data, d = v.data
  const g = d.validation.gbif, cal = d.calibration, ath = d.abundance.athens
  const gbifVals = Object.fromEntries(g.by_cell.map((c) => [c.cell, c.n > 0 ? Math.log10(c.n + 1) : null]))
  const monthly = ath.monthly_series.map((r) => ({ date: r.date, rate: r.rate, ESI: r.ESI }))
  const valBars = [
    { name: 'Ίσα βάρη', rho: cal.equal.rho_test as number, auc: cal.equal.auc_test as number },
    { name: 'Μόνο θερμοκρασία', rho: cal.temperature_only.rho_test as number, auc: cal.temperature_only.auc_test as number },
    { name: 'Κύριος ESI', rho: cal.chosen.rho_test, auc: cal.chosen.auc_test },
  ]
  return (
    <Page eyebrow="Επικύρωση" title="Ταιριάζει ο δείκτης με τα πραγματικά κουνούπια;"
      lead="Τον ελέγξαμε σε πραγματικές παγίδες και καταγραφές που ο δείκτης δεν είχε δει."
      more={<>Ο δείκτης μετρά <b>περιβαλλοντική καταλληλότητα</b>, όχι αφθονία. Τον συγκρίνουμε με πραγματικές καταγραφές: εβδομαδιαίες παγίδες στην Αθήνα (2018–2019), καταγραφές παρουσίας σε όλη την Ελλάδα (GBIF) και παγίδες στη Θεσσαλία. Τα βάρη επιλέχθηκαν με δεδομένα ως το 2018 και ελέγχθηκαν σε μεταγενέστερα, χωρίς διαρροή πληροφορίας.</>}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Αθήνα 2019 (δεν χρησιμοποιήθηκε στη βαθμονόμηση)" value={nf(cal.chosen.rho_test, 2)} note={<>Spearman ρ, ESI έναντι εβδομαδιαίων αλιευμάτων · ίσα βάρη <span className="num">{nf(cal.equal.rho_test as number, 2)}</span></>} />
        <Stat label="Νέες περιοχές εμφάνισης από 2019" value={nf(cal.chosen.auc_test, 2)} note={<>AUC (0,5 = τύχη) · ίσα βάρη <span className="num">{nf(cal.equal.auc_test as number, 2)}</span></>} />
        <Stat label="NASA POWER έναντι αισθητήρων πόλης" value={nf(d.validation.hobo_vs_nasa.temp_r, 3)} note={<>r θερμοκρασίας ({d.validation.hobo_vs_nasa.days} μέρες) · η NASA δίνει <span className="num">{signed(d.validation.hobo_vs_nasa.temp_bias_power_minus_hobo, 1)}</span> °C (θερμική νησίδα)</>} />
        <Stat label="Καλύτερη υστέρηση" value={`${ath.best_lag_weeks} εβδ.`} note="θερμοκρασία → αλιεύματα (περίπου ο χρόνος από αυγό σε ενήλικο)" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Αθήνα (Μοσχάτο–Ταύρος): ESI και πραγματικά κουνούπια" sub="μέσα αλιεύματα θηλυκών Ae. albopictus ανά παγίδα-ημέρα (6 παγίδες BG-Sentinel) και μηνιαίος ESI του κελιού">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1c2433" vertical={false} />
              <XAxis dataKey="date" {...AX} />
              <YAxis yAxisId="a" {...AX} width={36} />
              <YAxis yAxisId="b" orientation="right" {...AX} width={36} domain={[0, 100]} />
              <Tooltip {...TT} formatter={(x: unknown) => nf(x as number, 1)} />
              <Bar yAxisId="a" dataKey="rate" name="Κουνούπια / παγίδα / ημέρα" fill="#de4968" isAnimationActive={false} />
              <Line yAxisId="b" dataKey="ESI" name="ESI (δεξιός άξονας)" stroke="#ffcf70" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
              <RLegend wrapperStyle={{ fontSize: 12 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="text-[12px] text-muted mt-2">Πηγή: Michaelakis et al., Zenodo 10.5281/zenodo.23580672 (LIFE CONOPS), CC BY 4.0.</div>
        </Card>
        <Card title="Έλεγχος σε δεδομένα που δεν είδε η βαθμονόμηση" sub="ρ: εποχικότητα Αθήνας 2019 · AUC: κελιά με πρώτη καταγραφή από το 2019 έναντι κελιών χωρίς καταγραφή">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={valBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1c2433" vertical={false} />
              <XAxis dataKey="name" {...AX} />
              <YAxis {...AX} width={36} domain={[0, 1]} />
              <Tooltip {...TT} formatter={(x: unknown) => nf(x as number, 2)} />
              <Bar dataKey="rho" name="Spearman ρ (Αθήνα 2019)" fill="#5aa9e6" isAnimationActive={false} />
              <Bar dataKey="auc" name="AUC (νέες περιοχές)" fill="#f5a524" isAnimationActive={false} />
              <RLegend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-[12.5px] text-soft mt-2">Βάρη κύριου ESI: {Object.entries(cal.chosen.weights).map(([k, x]) => `${WN[k]} ${nf(x, 2)}`).join(' · ')}. Επιλέχθηκαν ανάμεσα σε όλους τους συνδυασμούς με βήμα 0,05, μέσα σε όρια από την ισχύ των δημοσιεύσεων: βροχή ≤ 0,25, υγρασία, άνεμος και βλάστηση ≤ 0,15.</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4">
        <Card title="Πού έχει καταγραφεί το κουνούπι τίγρης (GBIF)" sub={`${g.records_used} καταγραφές ${g.years?.[0]}–${g.years?.[1]} σε ${g.cells_with_records} από ${g.cells_total} κελιά · χρώμα: πλήθος (log)`}>
          <GreeceMap values={gbifVals} palette={['#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf']} domain={[0, 2.5]} height={400}
            tooltip={(id) => { const c = g.by_cell.find((x) => x.cell === id); return `<b>${m.cells.find((x) => x.cell === id)?.region ?? id}</b><br/>καταγραφές: <b>${c?.n ?? 0}</b>${c?.first_year ? ` (από ${c.first_year})` : ''}<br/>ESI 2016–2025: ${nf(c?.ESI, 0)}` }} />
          <div className="text-[12px] text-muted mt-2">Μέσος ESI σε κελιά με καταγραφές <span className="num">{nf(g.mean_esi_with_records, 1)}</span>, χωρίς <span className="num">{nf(g.mean_esi_without, 1)}</span>. Οι καταγραφές παρουσίας ακολουθούν το πού ψάχνει κανείς (πόλεις, προγράμματα επιτήρησης), οπότε «καμία καταγραφή» δεν σημαίνει απουσία.</div>
        </Card>
        <Card title="Υστέρηση: πόσες εβδομάδες μετά ακολουθεί το κουνούπι;" sub="Spearman ρ μεταξύ εβδομαδιαίων αλιευμάτων και συνθηκών Ν εβδομάδες νωρίτερα (Αθήνα, 350 εβδομάδες-παγίδες)">
          <table className="tbl">
            <thead><tr><th>Υστέρηση</th><th>Καταλληλότητα θερμοκρασίας</th><th>ESI με ίσα βάρη</th></tr></thead>
            <tbody>{ath.weekly_spearman_by_lag.map((r) => <tr key={r.lag_weeks}><td className="num">{r.lag_weeks} εβδ.</td><td className="num">{nf(r.rho_temperature_score, 3)}</td><td className="num">{nf(r.rho_esi, 3)}</td></tr>)}</tbody>
          </table>
          <div className="text-[12.5px] text-soft mt-3">Η θερμοκρασία εξηγεί τα περισσότερα: ο πληθυσμός ακολουθεί με 2–3 εβδομάδες καθυστέρηση. Η ξηρασία του καλοκαιριού δεν τον σταματά στην πόλη (γεννά σε δοχεία με νερό), γι’ αυτό τα ίσα βάρη τα πάνε χειρότερα.</div>
          <div className="text-[12px] text-muted mt-2">Θεσσαλία (Ecodevelopment, Mendeley Data 10.17632/9frz4845vw.1): οι παγίδες μετρούν όλο το γένος Aedes, όχι μόνο το κουνούπι τίγρη, οπότε η συσχέτιση με τον ESI (ρ ≈ {nf(d.validation.thessaly_genus_aedes.spearman_esi_aedes_genus as number, 2)}) δεν είναι δίκαιος έλεγχος.</div>
        </Card>
      </div>

      <Card title="Ανάλυση ευαισθησίας" sub="Τι αλλάζει αν αλλάξουν τα βάρη, οι καμπύλες ή ο τρόπος συνδυασμού">
        {(() => {
          const vs = d.sensitivity.variants
          const withTrend = vs.filter((r) => r.trend_decade != null)
          const up = withTrend.filter((r) => (r.trend_decade ?? 0) > 0).length
          const withProj = vs.filter((r) => r.d2050_ssp245 != null)
          const projUp = withProj.filter((r) => (r.d2050_ssp245 ?? 0) > 0).length
          const exceptions = withProj.filter((r) => (r.d2050_ssp245 ?? 0) <= 0).map((r) => variantName(r.variant))
          const mc = d.sensitivity.monte_carlo_weights.esi_2016_2025_p05_p95
          return (
            <div className="grid sm:grid-cols-3 gap-4 mb-3">
              <div><div className="num text-[28px] font-semibold">{up}/{withTrend.length}</div><div className="text-[13px] text-soft">παραλλαγές δείχνουν άνοδο από το 2001</div></div>
              <div><div className="num text-[28px] font-semibold">{projUp}/{withProj.length}</div><div className="text-[13px] text-soft">δείχνουν άνοδο ως το 2041–2050 (ενδιάμεσο σενάριο){exceptions.length ? <> · εξαίρεση: {exceptions.join(", ")}</> : null}</div></div>
              <div><div className="num text-[28px] font-semibold">{nf(mc[0], 1)}–{nf(mc[1], 1)}</div><div className="text-[13px] text-soft">καταλληλότητα 2016–2025 με 300 τυχαία σύνολα βαρών (5–95%)</div></div>
            </div>
          )
        })()}
        <details>
          <summary className="cursor-pointer text-[13.5px] text-soft hover:text-fg select-none">Όλες οι παραλλαγές ({d.sensitivity.variants.length})</summary>
        <div className="overflow-auto mt-2">
          <table className="tbl">
            <thead><tr><th>Παραλλαγή</th><th>ESI 2016–2025</th><th>Τάση /10 έτη</th><th>p</th><th>Δ 2041–2050 SSP2-4.5</th><th>Δ SSP5-8.5</th><th>ρ Αθήνα 2019</th></tr></thead>
            <tbody>{d.sensitivity.variants.map((r) => (
              <tr key={r.variant}><td>{variantName(r.variant)}</td><td className="num">{nf(r.esi_2016_2025, 1)}</td><td className="num">{signed(r.trend_decade, 2)}</td><td className="num">{pfmt(r.trend_p)}</td>
                <td className="num">{signed(r.d2050_ssp245, 2)}</td><td className="num">{signed(r.d2050_ssp585, 2)}</td><td className="num">{r.athens_2019_rho != null ? nf(r.athens_2019_rho, 2) : '—'}</td></tr>
            ))}</tbody>
          </table>
        </div>
        </details>
        <div className="text-[13px] text-soft mt-3">Η <b>κατεύθυνση</b> (άνοδος) μένει ίδια σχεδόν σε όλες τις παραλλαγές. Το μέγεθος εξαρτάται κυρίως από το πόσο μετράει η ξηρασία του καλοκαιριού.</div>
      </Card>

      <Card title="Δοκίμασε τα δικά σου βάρη" sub="Ο υπολογισμός γίνεται στο backend πάνω σε όλα τα κελιά, τους μήνες και τα 8 μοντέλα">
        <div className="grid lg:grid-cols-[320px_1fr] gap-5">
          <div className="flex flex-col gap-3">
            {(Object.keys(w) as (keyof typeof w)[]).map((k) => (
              <label key={k} className="text-[13px] text-soft">{WN[k]} <span className="num text-fg">{nf(w[k], 2)}</span>
                <input type="range" min={0} max={1} step={0.01} value={w[k]} onChange={(e) => setW({ ...w, [k]: +e.target.value })} className="w-full" />
              </label>
            ))}
            <div className="flex gap-2"><button className="btn on" onClick={() => setApplied(w)}>Υπολογισμός</button>
              <button className="btn" onClick={() => { const e = { T: 0.2, P: 0.2, RH: 0.2, W: 0.2, NDVI: 0.2 }; setW(e); setApplied(e) }}>Ίσα βάρη</button></div>
            {cu.data && (
              <div className="text-[13px] text-soft leading-relaxed">
                Τάση 2001–2025: <b className="num">{signed(cu.data.trend?.sen_decade, 2)}</b>/10 έτη (p <span className="num">{pfmt(cu.data.trend?.p)}</span>)<br />
                2041–2050 έναντι 1995–2014: SSP2-4.5 <b className="num">{signed(cu.data.projection_2041_2050.ssp245?.change, 2)}</b> · SSP5-8.5 <b className="num">{signed(cu.data.projection_2041_2050.ssp585?.change, 2)}</b>
              </div>
            )}
          </div>
          <div>
            {cu.data ? <GreeceMap values={cu.data.values} palette={LAYER_INFO.ESI.palette} domain={[10, 50]} height={360} cities={false}
              tooltip={(id, x) => `<b>${m.cells.find((c) => c.cell === id)?.region ?? id}</b><br/>ESI 2025 με αυτά τα βάρη: <b>${nf(x, 0)}</b>`} /> : <Loading />}
            <div className="mt-2"><Legend palette={LAYER_INFO.ESI.palette} domain={[10, 50]} unit="/100" title="ESI 2025 με τα βάρη σου" /></div>
          </div>
        </div>
      </Card>
    </Page>
  )
}
