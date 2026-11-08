// Overview: what the ESI is and shows, then the five parameters with their weight in the main ESI.
import { Link } from 'react-router-dom'
import { useApi, type Meta } from '../api'
import { ErrorBox, Loading } from '../components/Layout'
import { CLASSES, LAYER_INFO, colorAt, nf } from '../fmt'

// Favourable ranges are the plateau of each suitability function (pipeline/esi.py, docs/science_values.json).
const PARAMS = [
  { key: 'T', name: 'Θερμοκρασία', code: 'T2M', source: 'NASA POWER', good: '25–30 °C',
    text: 'Κάτω από 12,6 °C ή πάνω από 37 °C (μέση του μήνα) η καταλληλότητα σχεδόν μηδενίζεται.' },
  { key: 'P', name: 'Βροχόπτωση', code: 'PRECTOTCORR', source: 'NASA POWER', good: '90–800 mm σε 35 ημέρες',
    text: 'Γεμίζει τα νερά όπου ζουν οι προνύμφες. Με περισσότερη βροχή λιγοστεύουν, πιθανώς επειδή ξεπλένονται.' },
  { key: 'W', name: 'Άνεμος', code: 'WS10M', source: 'NASA POWER', good: 'ως περίπου 4 m/s',
    text: 'Πιο δυνατός άνεμος σημαίνει λιγότερα κουνούπια.' },
  { key: 'RH', name: 'Υγρασία', code: 'RH2M', source: 'NASA POWER', good: 'περίπου 75–80%',
    text: 'Όσο πιο ξηρός ο αέρας, τόσο μικρότερη η καταλληλότητα.' },
  { key: 'NDVI', name: 'Βλάστηση', code: 'NDVI', source: 'MODIS', good: 'NDVI πάνω από 0,2',
    text: 'Λίγη βλάστηση κοντά στις εστίες ευνοεί το κουνούπι.' },
] as const

const SCALE: [string, string][] = [...CLASSES].reverse().map(([lo], i, all) => [all[i][1], i < all.length - 1 ? `${lo}–${all[i + 1][0]}` : `${lo}–100`])

export default function OverviewPage() {
  const meta = useApi<Meta>('/api/meta')
  if (meta.error) return <ErrorBox error={meta.error} />
  if (!meta.data) return <Loading />
  const w = meta.data.weights.main
  const pct = (k: string) => (w[k] ?? 0) * 100
  const params = [...PARAMS].sort((a, b) => pct(b.key) - pct(a.key))
  const pal = LAYER_INFO.ESI.palette
  return (
    <div className="flex flex-col gap-10 pt-2">
      <section className="grid lg:grid-cols-[1.15fr_1fr] gap-8 items-start">
        <div className="flex flex-col gap-5">
          <div className="eyebrow">Επισκόπηση</div>
          <h1 className="text-[30px] md:text-[40px] font-semibold leading-[1.12] tracking-tight">Ο δείκτης καταλληλότητας ESI</h1>
          <p className="text-soft text-[16.5px] leading-relaxed max-w-2xl">
            Ένας αριθμός από 0 ως 100 για κάθε περιοχή της Ελλάδας και κάθε μήνα: πόσο ευνοεί το περιβάλλον το κουνούπι τίγρη (<i>Aedes albopictus</i>).
          </p>
          <ul className="flex flex-col gap-2.5 text-[14.5px] max-w-2xl">
            <Point>Συνδυάζει <b>5 παραμέτρους</b> από δεδομένα της NASA.</Point>
            <Point>Ο <b>κανονικός ESI</b> δίνει σε κάθε παράμετρο το δικό της βάρος, βαθμονομημένο με πραγματικές παγίδες κουνουπιών (Αθήνα, 2018) και καταγραφές του είδους.</Point>
            <Point>Δείχνει πόσο ευνοϊκό είναι το περιβάλλον, <b>όχι</b> πόσα κουνούπια υπάρχουν ή κρούσματα.</Point>
          </ul>
          <div className="text-[13px] text-muted">111 περιοχές (~55 × 55 km) · μετρήσεις NASA από το 1981, ESI από το 2001 · πρόβλεψη ως το 2050 (SSP2-4.5)</div>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link to="/map" className="btn on !px-5 !py-2.5 !text-[14.5px]">Άνοιξε τον χάρτη →</Link>
            <Link to="/results" className="btn !px-5 !py-2.5 !text-[14.5px]">Αποτελέσματα</Link>
          </div>
        </div>

        <div className="card p-5 flex flex-col gap-5">
          <div>
            <div className="text-[13px] text-muted mb-2.5">Πώς διαβάζεται</div>
            <div className="grid sm:grid-cols-5 gap-x-1 gap-y-2">
              {SCALE.map(([name, range], i) => (
                <div key={name} className="flex sm:flex-col items-center sm:items-stretch gap-3 sm:gap-2">
                  <div className="h-3 w-10 sm:w-auto shrink-0 rounded-sm border border-white/10" style={{ background: colorAt(pal, (7.5 + 15 * i) / 75) }} />
                  <div className="flex sm:block items-baseline gap-2 leading-tight">
                    <div className="text-[12.5px] text-fg">{name}</div>
                    <div className="num text-[11.5px] text-muted sm:mt-0.5">{range}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-line pt-4">
            <div className="text-[13px] text-muted mb-2">Ο κανονικός ESI</div>
            <div className="num text-[15px] md:text-[16px] text-fg leading-relaxed">
              ESI = 100 × {params.map((p, i) => (
                <span key={p.key}>{i > 0 && ' × '}s<sub className="text-[11px]">{p.key}</sub><sup className="text-accent-2 text-[11px]">{nf(w[p.key], 2)}</sup></span>
              ))}
            </div>
            <div className="text-[12.5px] text-soft mt-2">s = πόσο ευνοϊκή είναι κάθε παράμετρος, από 0 ως 1. Ο εκθέτης είναι το βάρος της.</div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">Οι 5 παράμετροι</h2>
          <p className="text-[14px] text-soft mt-1">Το ποσοστό είναι το βάρος της παραμέτρου στον κανονικό ESI. Ο ESI με ίσα βάρη δίνει 20% σε καθεμία.</p>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {params.map((p) => (
            <div key={p.key} className="card p-4 flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-[15.5px]">{p.name}</span>
                <span className="num text-[26px] font-semibold text-accent leading-none">{nf(pct(p.key), 0)}%</span>
              </div>
              <div className="h-1.5 rounded bg-line-2 overflow-hidden"><div className="h-full rounded bg-accent" style={{ width: `${pct(p.key)}%` }} /></div>
              <div className="num text-[11.5px] text-muted">{p.code} · {p.source}</div>
              <div className="text-[13px]"><span className="text-muted">Ευνοϊκή: </span><span className="text-fg">{p.good}</span></div>
              <p className="text-[13px] text-soft leading-snug">{p.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Point({ children }: { children: React.ReactNode }) {
  return <li className="flex gap-3 leading-relaxed"><span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-accent shrink-0" /><span className="text-soft">{children}</span></li>
}
