import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApi, type Meta } from '../api'
import { Card, ErrorBox, Loading, Page } from '../components/Layout'
import { nf } from '../fmt'

type Sci = {
  values: { id: number | string; parameter: string; value_text: string; short_el?: string; category: string; context: string; quote: string; citation: string; doi: string | null; url: string; verified: string; notes: string }[]
  esi_parameters: { P: Record<string, number>; weights: Record<string, number>; equal: Record<string, number> }
  notes: { note: string; P_notes?: Record<string, string> }
}
const CAT: Record<string, [string, string]> = {
  laboratory: ['Εργαστήριο', 'lab'], 'field observation': ['Παρατήρηση πεδίου', 'field'],
  'statistical/mechanistic model result': ['Αποτέλεσμα μοντέλου', 'model'], 'proposed climatic suitability threshold': ['Προτεινόμενο κλιματικό όριο', 'threshold'],
}
const PAR: Record<string, string> = { temperature: 'Θερμοκρασία', precipitation: 'Βροχόπτωση', humidity: 'Υγρασία', wind: 'Άνεμος', vegetation: 'Βλάστηση' }
const AX = { stroke: '#4a566b', tick: { fill: '#8591a6', fontSize: 11 } }

const sig = (d: number, edge: number) => d / Math.sqrt(2 * Math.log(1 / edge))
function curves(P: Record<string, number>) {
  const T = (t: number) => t < P.T_lo ? Math.exp(-((P.T_lo - t) ** 2) / (2 * sig(P.T_lo - P.T_cold, P.edge) ** 2)) : t > P.T_hi ? Math.exp(-((t - P.T_hi) ** 2) / (2 * sig(P.T_warm - P.T_hi, P.edge) ** 2)) : 1
  const Pr = (x: number) => (1 / (1 + Math.exp(-(x - P.P_lo / 2) / (P.P_lo / 6)))) * (1 / (1 + Math.exp((x - (P.P_hi + 100)) / 50)))
  const RH = (x: number) => x < P.RH_lo ? Math.exp(-((P.RH_lo - x) ** 2) / (2 * sig(P.RH_lo - P.RH_dry, P.edge) ** 2)) : x > P.RH_hi ? Math.exp(-((x - P.RH_hi) ** 2) / (2 * sig(P.RH_wet - P.RH_hi, 0.3) ** 2)) : 1
  const W = (x: number) => 1 / (1 + Math.exp((x - P.W_mid) / P.W_scale))
  const N = (x: number) => 1 / (1 + Math.exp(-(x - P.NDVI_mid) / P.NDVI_scale))
  const r = (lo: number, hi: number, step: number, f: (x: number) => number) => Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => ({ x: +(lo + i * step).toFixed(3), s: f(lo + i * step) }))
  return [
    { key: 'T', title: 'Θερμοκρασία (μέση μηνιαία, °C)', data: r(-5, 42, 0.5, T), band: [P.T_lo, P.T_hi], eq: `s = 1 για ${P.T_lo}–${P.T_hi} °C· Gauss προς τα κάτω (0,02 στους ${P.T_cold} °C) και προς τα πάνω (0,02 στους ${P.T_warm} °C)` },
    { key: 'P', title: 'Βροχή 35 ημερών (mm)', data: r(0, 1100, 10, Pr), band: [P.P_lo, P.P_hi], eq: `διπλό σιγμοειδές: ανεβαίνει γύρω στα ${P.P_lo / 2} mm (0,95 στα ${P.P_lo}), πέφτει μετά τα ${P.P_hi} mm (ξέπλυμα)` },
    { key: 'RH', title: 'Σχετική υγρασία (%)', data: r(20, 100, 1, RH), band: [P.RH_lo, P.RH_hi], eq: `s = 1 για ${P.RH_lo}–${P.RH_hi}%· Gauss προς τα κάτω (0,02 στο ${P.RH_dry}%)` },
    { key: 'W', title: 'Άνεμος 10 m (m/s)', data: r(0, 9, 0.1, W), band: null, eq: `φθίνον σιγμοειδές: 0,5 στα ${P.W_mid} m/s (κλίμακα ${P.W_scale})` },
    { key: 'NDVI', title: 'NDVI', data: r(0, 0.8, 0.01, N), band: null, eq: `αύξον σιγμοειδές: 0,5 στο ${P.NDVI_mid}, κορεσμός πάνω από ~0,3` },
  ]
}

// The five datasets: source, code, resolution, units, processing and known gaps (dates come from the database).
const DATASETS: { key: string; name: string; source: string; code: string; res: string; units: string; proc: string; gaps: string }[] = [
  { key: 'T2M', name: 'Θερμοκρασία αέρα 2 m', source: 'NASA POWER, μηνιαίο regional API (πηγή MERRA-2)', code: 'T2M', res: '0,5° × 0,625° · μηνιαία', units: '°C', proc: 'μέσος του μήνα ανά κελί', gaps: 'Τιμή κελιού: στα παράκτια κελιά μετρά και η θάλασσα.' },
  { key: 'PRECIP', name: 'Βροχόπτωση, διορθωμένη', source: 'NASA POWER (MERRA-2, διορθωμένη με παρατηρήσεις)', code: 'PRECTOTCORR', res: '0,5° × 0,625° · μηνιαία', units: 'API: mm/ημέρα → mm/μήνα', proc: '× ημέρες του μήνα· βροχή 35 ημερών = ο μήνας + οι τελευταίες (35 − ημέρες) του προηγούμενου', gaps: 'Η βροχή 35 ημερών είναι προσέγγιση από μηνιαία δεδομένα.' },
  { key: 'RH2M', name: 'Σχετική υγρασία 2 m', source: 'NASA POWER (MERRA-2)', code: 'RH2M', res: '0,5° × 0,625° · μηνιαία', units: '%', proc: 'μέσος του μήνα', gaps: 'Η απόλυτη υγρασία (> 10 g/m³) δεν είναι στις πέντε παραμέτρους.' },
  { key: 'WS10M', name: 'Ταχύτητα ανέμου 10 m', source: 'NASA POWER (MERRA-2)', code: 'WS10M', res: '0,5° × 0,625° · μηνιαία', units: 'm/s', proc: 'μέσος του μήνα', gaps: 'Σε ύψος 10 m· στο ύψος του κουνουπιού ο άνεμος είναι ασθενέστερος.' },
  { key: 'NDVI', name: 'Βλάστηση NDVI', source: 'NASA MODIS/Terra MOD13A3 v6.1 (Earth Engine: MODIS/061/MOD13A3)', code: 'NDVI', res: '1 km → μέσος στην ελληνική στεριά κάθε κελιού · μηνιαία', units: 'αδιάστατο (τιμή × 0,0001)', proc: 'μόνο pixel με SummaryQA ≤ 1· κελί-μήνας με < 10 καλά pixel = κενό', gaps: 'Το MOD13C2.061 (0,05°, ίδιος αλγόριθμος) δεν υπάρχει στο Earth Engine· διατίθεται από το LP DAAC με λογαριασμό NASA Earthdata.' },
]
const monthsFrom1981 = (ym: string) => { const [y, m] = ym.split('-').map(Number); return (y - 1981) * 12 + (m - 1) }

export default function SciencePage() {
  const s = useApi<Sci>('/api/science')
  const meta = useApi<Meta>('/api/meta')
  if (s.error) return <ErrorBox error={s.error} />
  if (!s.data) return <Loading />
  const { values, esi_parameters: ep, notes } = s.data
  const W = ep.weights
  const cov = meta.data?.coverage
  return (
    <Page eyebrow="Μέθοδος" title="Από πού έρχεται κάθε τιμή"
      lead="Ο δείκτης, οι πηγές κάθε τιμής, τα δεδομένα και τα όρια του μοντέλου."
      more="Κάθε επιστημονική τιμή επαληθεύτηκε στην πρωτογενή δημοσίευση. Διακρίνουμε εργαστηριακές τιμές, παρατηρήσεις πεδίου, αποτελέσματα μοντέλων και προτεινόμενα κλιματικά όρια. Καμία δεν παρουσιάζεται ως απόλυτο όριο επιβίωσης.">
      <Card title="Ο δείκτης ESI" sub="Environmental Suitability Index, 0–100">
        <div className="text-[14px] leading-relaxed text-soft">
          <div className="num text-fg bg-panel-2 border border-line rounded-md px-3 py-2 inline-block">ESI = 100 · s<sub>T</sub><sup>w<sub>T</sub></sup> · s<sub>P</sub><sup>w<sub>P</sub></sup> · s<sub>RH</sub><sup>w<sub>RH</sub></sup> · s<sub>W</sub><sup>w<sub>W</sub></sup> · s<sub>NDVI</sub><sup>w<sub>NDVI</sub></sup>,&nbsp; Σw = 1</div>
          <p className="mt-3">Κάθε s<sub>i</sub> ∈ [0, 1] είναι η καταλληλότητα μιας παραμέτρου (καμπύλες παρακάτω). Ο <b>σταθμισμένος γεωμετρικός μέσος</b> είναι ο κανόνας των μοντέλων Habitat Suitability Index (U.S. Fish &amp; Wildlife Service, 1981): ένας πολύ δυσμενής παράγοντας, όπως ένας μήνας με 5 °C, δεν «αντισταθμίζεται» από τους άλλους.</p>
          <p className="mt-2">Βάρη κύριου δείκτη: {Object.entries(W).map(([k, v]) => `${k} ${nf(v, 2)}`).join(' · ')}. {notes.note}</p>
          <p className="mt-2 text-muted text-[13px]">Ο ετήσιος ESI είναι ο μέσος όρος των 12 μηνιαίων. Τα κριτήρια Ιανουάριος &gt; 0 °C, ετήσιος μέσος &gt; 11 °C και βροχή &gt; 500 mm αναφέρονται ξεχωριστά, ως ενδείξεις, και δεν πολλαπλασιάζονται στον δείκτη, γιατί είναι προτεινόμενα όρια και όχι βιολογικά.</p>
        </div>
      </Card>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {curves(ep.P).map((c) => (
          <Card key={c.key} title={c.title} sub={<>{c.eq} · βάρος <span className="num">{nf(W[c.key], 2)}</span></>}>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={c.data} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#1c2433" vertical={false} />
                <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} {...AX} />
                <YAxis domain={[0, 1]} {...AX} width={34} />
                <Tooltip contentStyle={{ background: '#111723', border: '1px solid #2e3a50', fontSize: 12 }} formatter={(v: unknown) => nf(v as number, 2)} />
                {c.band && <ReferenceArea x1={c.band[0]} x2={c.band[1]} fill="#f5a524" fillOpacity={0.08} />}
                <Line dataKey="s" stroke="#fe9f6d" dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
            {ep && notes.P_notes && Object.entries(notes.P_notes).filter(([k]) => k.startsWith(c.key === 'P' ? 'P_' : c.key === 'RH' ? 'RH' : c.key === 'W' ? 'W_' : c.key === 'NDVI' ? 'NDVI' : 'T_')).map(([k, t]) => <p key={k} className="text-[12px] text-muted mt-2">{t}</p>)}
          </Card>
        ))}
      </div>
      <Card title="Επιστημονικές τιμές αναφοράς" sub="Επαλήθευση από πρωτογενείς δημοσιεύσεις · «μερικώς» = ο αριθμός ισχύει με διαφορετικό πλαίσιο από αυτό που γράφει συνήθως η βιβλιογραφία">
        <div className="overflow-auto">
          <table className="tbl">
            <thead><tr><th>#</th><th>Παράμετρος</th><th>Τιμή και πλαίσιο</th><th>Είδος</th><th>Επαλήθευση</th><th>Πηγή</th></tr></thead>
            <tbody>{values.map((r) => (
              <tr key={r.id}>
                <td className="num">{r.id}</td><td>{PAR[r.parameter] ?? r.parameter}</td>
                <td className="max-w-[520px]"><div className="text-[13.5px]">{r.short_el ?? r.value_text}</div><details className="mt-1"><summary className="text-[12px] text-muted cursor-pointer select-none hover:text-soft">Αρχικό κείμενο και σημειώσεις</summary><div className="text-[12px] text-soft mt-1">{r.value_text}</div>{r.notes && <div className="text-[12px] text-muted mt-1">{r.notes}</div>}</details></td>
                <td><span className={`tag ${CAT[r.category]?.[1] ?? ''}`}>{CAT[r.category]?.[0] ?? r.category}</span></td>
                <td>{r.verified === 'yes' ? 'ναι' : r.verified === 'partly' ? 'μερικώς' : 'όχι'}</td>
                <td className="text-[12px]"><div className="text-soft">{r.citation}</div><div className="flex flex-wrap gap-x-2">{r.doi && <a className="text-accent underline-offset-2 hover:underline" href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">doi:{r.doi}</a>}{r.url && <a className="text-accent underline-offset-2 hover:underline" href={r.url} target="_blank" rel="noreferrer">σύνδεσμος</a>}</div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      <Card title="Τα πέντε σύνολα δεδομένων" sub="Πηγή, κωδικός, περίοδος, ανάλυση, μονάδες, επεξεργασία και κενά · οι ημερομηνίες και τα κενά διαβάζονται από τη βάση">
        <div className="overflow-auto">
          <table className="tbl">
            <thead><tr><th>Παράμετρος</th><th>Πηγή / dataset</th><th>Κωδικός</th><th>Περίοδος στη βάση</th><th>Ανάλυση</th><th>Μονάδες</th><th>Επεξεργασία</th><th>Κενά και περιορισμοί</th></tr></thead>
            <tbody>{DATASETS.map((d) => {
              const c = cov?.[d.key]
              const ownMissing = c && meta.data ? c.missing_cell_months - meta.data.coverage.cells * monthsFrom1981(c.first) : null
              return (
                <tr key={d.key}>
                  <td>{d.name}</td><td className="text-[12.5px] max-w-[220px]">{d.source}</td><td className="num">{d.code}</td>
                  <td className="num whitespace-nowrap">{c ? `${c.first} → ${c.last}` : '…'}</td>
                  <td className="text-[12.5px]">{d.res}</td><td className="text-[12.5px]">{d.units}</td>
                  <td className="text-[12.5px] max-w-[240px]">{d.proc}</td>
                  <td className="text-[12.5px] max-w-[260px]">{ownMissing !== null ? <><span className="num">{ownMissing}</span> κελί-μήνες κενοί μέσα στην περίοδο. </> : null}{d.gaps}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
        <ul className="text-[12.5px] text-soft mt-3 space-y-1 leading-relaxed list-disc pl-5">
          <li><b>Μέγιστη ιστορική ανάλυση</b>: κάθε παράμετρος με όλη τη σειρά της (μετεωρολογικές από το 1981, NDVI από το 2000). <b>Κοινή περίοδος</b> και των πέντε, για τον ESI: <span className="num">{cov ? `${cov.common_period.first} → ${cov.common_period.last}` : '…'}</span>. Ετήσιος ESI μόνο για πλήρη έτη (2001–{meta.data?.last_complete_year ?? '…'}). Το τρέχον έτος δεν παρουσιάζεται ποτέ ως πλήρες.</li>
          <li>Καμία τιμή που λείπει δεν συμπληρώνεται. Οι τιμές −999 της NASA γίνονται κενά.</li>
          <li>Οι πιο πρόσφατοι μήνες της NASA POWER μπορεί να προέρχονται από το προϊόν σχεδόν πραγματικού χρόνου GEOS FP-IT και να αντικατασταθούν όταν βγει το MERRA-2. Γι' αυτό, σε κάθε ανανέωση, τα αρχεία του τρέχοντος και του προηγούμενου έτους κατεβαίνουν ξανά (NASA POWER και NDVI).</li>
          <li>Το MODIS Collection 6.1 είναι όλη η σειρά επεξεργασμένη ξανά με τον ίδιο αλγόριθμο.</li>
        </ul>
      </Card>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Δεδομένα και επεξεργασία">
          <ul className="text-[13px] text-soft space-y-2 leading-relaxed list-disc pl-5">
            <li><b>NASA POWER (MERRA-2)</b>, μηνιαία, πλέγμα 0,5° × 0,625°, Ιαν 1981 → Σεπ 2026: T2M (°C), PRECTOTCORR (mm/ημέρα × ημέρες μήνα → mm/μήνα), RH2M (%), WS10M (m/s). Ένα αίτημα regional API ανά παράμετρο.</li>
            <li><b>NASA MODIS/Terra MOD13A3 v6.1</b> (μηνιαίο NDVI, 1 km), Φεβ 2000 → Οκτ 2026, μέσω Google Earth Engine. Ο μέσος όρος ανά κελί γίνεται μόνο πάνω από ελληνική στεριά, με SummaryQA ≤ 1. Το MOD13C2 (ίδιος μηνιαίος αλγόριθμος, 0,05°) δεν υπάρχει στο Earth Engine· είναι διαθέσιμο από το LP DAAC με λογαριασμό NASA Earthdata.</li>
            <li><b>Βροχή 35 ημερών</b>: ο μήνας και οι τελευταίες (35 − ημέρες) ημέρες του προηγούμενου, με ομοιόμορφη κατανομή μέσα στον μήνα. Είναι προσέγγιση, γιατί το προϊόν είναι μηνιαίο.</li>
            <li><b>Πλέγμα</b>: 111 κελιά με ≥ 2% ελληνική στεριά (όρια USDOS LSIB, MODIS MOD44W). Για κάθε κελί: περιφέρεια (FAO GAUL), βόρεια/νότια (39° Β), νησιωτική/ηπειρωτική, παράκτια/εσωτερική, αστικό ποσοστό (ESA WorldCover), μέσο υψόμετρο (GMTED2010). Τα χαρακτηριστικά αυτά περιγράφουν τα κελιά και δεν μπαίνουν στο μοντέλο.</li>
            <li><b>Προβλέψεις</b>: NASA NEX-GDDP-CMIP6, 8 μοντέλα, SSP2-4.5 και SSP5-8.5. Μηνιαίοι μέσοι tas, pr, hurs και sfcWind ανά κελί. Μέθοδος delta (Δ ή λόγος) έναντι 1995–2014, εξομάλυνση 11 ετών. Το NDVI μένει στην κλιματολογία 2016–2025, με ανάλυση ευαισθησίας ±10%.</li>
            <li><b>Στατιστική</b>: Mann-Kendall με Hamed-Rao (n ≥ 20), κλίση Sen με διάστημα εμπιστοσύνης, OLS με σφάλματα Newey-West, εποχικό Kendall (Hirsch 1982), Spearman, Benjamini-Hochberg ανά μεταβλητή.</li>
            <li><b>Ανανέωση</b>: <span className="num">pipeline/run_all.py</span> κατεβάζει τους νέους μήνες της NASA και ξαναϋπολογίζει όλα τα αποτελέσματα.</li>
          </ul>
        </Card>
        <Card title="Περιορισμοί">
          <ul className="text-[13px] text-soft space-y-2 leading-relaxed list-disc pl-5">
            <li>Ο ESI δείχνει <b>περιβαλλοντική καταλληλότητα</b>, όχι αριθμό κουνουπιών ή κίνδυνο μετάδοσης ιών.</li>
            <li>Κελιά ~55 km: δεν βλέπουν μικροπεριβάλλοντα της πόλης (δοχεία, ποτίσματα, σκιά). Στην Αθήνα η NASA δίνει 1,5 °C χαμηλότερη θερμοκρασία από τους αισθητήρες του δρόμου.</li>
            <li>Η βαθμονόμηση στηρίζεται σε μία πόλη (Αθήνα, 2 εποχές) και σε καταγραφές παρουσίας με μεροληψία δειγματοληψίας. Η γενίκευση σε άλλες περιοχές είναι λογική αλλά όχι αποδεδειγμένη.</li>
            <li>Η βροχή 35 ημερών υπολογίζεται κατά προσέγγιση από μηνιαία δεδομένα. Το όριο 90–800 mm προέρχεται από τροπικό νησί (Ρεϊνιόν).</li>
            <li>Το NDVI σε κελιά 50 km είναι σχεδόν παντού πάνω από 0,3 και δεν διαφοροποιεί πολύ.</li>
            <li>Οι προβλέψεις εξαρτώνται από τα κλιματικά μοντέλα. Δείχνουμε τη διασπορά τους και όχι μία μόνο τιμή.</li>
            <li>Οι συσχετίσεις δεν αποδεικνύουν αιτιότητα. Οι μηχανισμοί προέρχονται από τη βιβλιογραφία, όχι από αυτά τα δεδομένα.</li>
          </ul>
        </Card>
      </div>
      <Card title="Ιοί που μπορεί να μεταδώσει το κουνούπι τίγρης">
        <p className="text-[13.5px] text-soft leading-relaxed">Chikungunya, Dengue και Zika. Η εφαρμογή τούς αναφέρει ενημερωτικά και δεν υπολογίζει δείκτες μετάδοσης. Για να υπάρξει μετάδοση πρέπει να υπάρχει στην περιοχή ο αντίστοιχος ιός, όχι μόνο το κουνούπι.</p>
      </Card>
    </Page>
  )
}
