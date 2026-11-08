// Overview: what the ESI is and shows, then the five parameters with their weight in the main ESI.
import { Link } from 'react-router-dom'
import { useApi, type Meta } from '../api'
import { ErrorBox, Loading } from '../components/Layout'
import { CLASSES, LAYER_INFO, classWord, colorAt, nf } from '../fmt'
import { useT } from '../i18n'

// Favourable ranges are the plateau of each suitability function (pipeline/esi.py, docs/science_values.json).
const PARAMS = [
  { key: 'T', el: 'Θερμοκρασία', en: 'Temperature', code: 'T2M', source: 'NASA POWER', good: ['25–30 °C', '25–30 °C'],
    text: ['Κάτω από 12,6 °C ή πάνω από 37 °C (μέση του μήνα) η καταλληλότητα σχεδόν μηδενίζεται.',
      'Below 12.6 °C or above 37 °C (monthly mean) suitability drops to almost zero.'] },
  { key: 'P', el: 'Βροχόπτωση', en: 'Precipitation', code: 'PRECTOTCORR', source: 'NASA POWER', good: ['90–800 mm σε 35 ημέρες', '90–800 mm in 35 days'],
    text: ['Γεμίζει τα νερά όπου ζουν οι προνύμφες. Με περισσότερη βροχή λιγοστεύουν, πιθανώς επειδή ξεπλένονται.',
      'It fills the water where the larvae live. With more rain they decline, probably flushed away.'] },
  { key: 'W', el: 'Άνεμος', en: 'Wind', code: 'WS10M', source: 'NASA POWER', good: ['ως περίπου 4 m/s', 'up to about 4 m/s'],
    text: ['Πιο δυνατός άνεμος σημαίνει λιγότερα κουνούπια.', 'Stronger wind means fewer mosquitoes.'] },
  { key: 'RH', el: 'Υγρασία', en: 'Humidity', code: 'RH2M', source: 'NASA POWER', good: ['περίπου 75–80%', 'about 75–80%'],
    text: ['Όσο πιο ξηρός ο αέρας, τόσο μικρότερη η καταλληλότητα.', 'The drier the air, the lower the suitability.'] },
  { key: 'NDVI', el: 'Βλάστηση', en: 'Vegetation', code: 'NDVI', source: 'MODIS', good: ['NDVI πάνω από 0,2', 'NDVI above 0.2'],
    text: ['Λίγη βλάστηση κοντά στις εστίες ευνοεί το κουνούπι.', 'Some vegetation near breeding sites favours the mosquito.'] },
] as const

export default function OverviewPage() {
  const meta = useApi<Meta>('/api/meta')
  const t = useT()
  if (meta.error) return <ErrorBox error={meta.error} />
  if (!meta.data) return <Loading />
  const w = meta.data.weights.main
  const pct = (k: string) => (w[k] ?? 0) * 100
  const params = [...PARAMS].sort((a, b) => pct(b.key) - pct(a.key))
  const pal = LAYER_INFO.ESI.palette
  const scale = [...CLASSES].reverse().map((c, i, all) => ({ name: classWord(c), range: i < all.length - 1 ? `${c[0]}–${all[i + 1][0]}` : `${c[0]}–100` }))
  return (
    <div className="flex flex-col gap-10 pt-2">
      <section className="grid lg:grid-cols-[1.15fr_1fr] gap-8 items-start">
        <div className="flex flex-col gap-5">
          <div className="eyebrow">{t('Επισκόπηση', 'Overview')}</div>
          <h1 className="text-[30px] md:text-[40px] font-semibold leading-[1.12] tracking-tight">{t('Ο δείκτης καταλληλότητας ESI', 'The suitability index ESI')}</h1>
          <p className="text-soft text-[16.5px] leading-relaxed max-w-2xl">
            {t('Ένας αριθμός από 0 ως 100 για κάθε περιοχή της Ελλάδας και κάθε μήνα: πόσο ευνοεί το περιβάλλον το κουνούπι τίγρη ',
              'A number from 0 to 100 for every region of Greece and every month: how favourable the environment is for the tiger mosquito ')}
            (<i>Aedes albopictus</i>).
          </p>
          <ul className="flex flex-col gap-2.5 text-[14.5px] max-w-2xl">
            <Point>{t('Συνδυάζει ', 'It combines ')}<b>{t('5 παραμέτρους', '5 parameters')}</b>{t(' από δεδομένα της NASA.', ' from NASA data.')}</Point>
            <Point>{t('Ο ', 'The ')}<b>{t('κανονικός ESI', 'main ESI')}</b>{t(' δίνει σε κάθε παράμετρο το δικό της βάρος, βαθμονομημένο με πραγματικές παγίδες κουνουπιών (Αθήνα, 2018) και καταγραφές του είδους.',
              ' gives each parameter its own weight, calibrated with real mosquito traps (Athens, 2018) and records of the species.')}</Point>
            <Point>{t('Δείχνει πόσο ευνοϊκό είναι το περιβάλλον, ', 'It shows how favourable the environment is, ')}<b>{t('όχι', 'not')}</b>{t(' πόσα κουνούπια υπάρχουν ή κρούσματα.', ' how many mosquitoes there are or disease cases.')}</Point>
          </ul>
          <div className="text-[13px] text-muted">{t('111 περιοχές (~55 × 55 km) · μετρήσεις NASA από το 1981, ESI από το 2001 · πρόβλεψη ως το 2050 (SSP2-4.5)',
            '111 regions (~55 × 55 km) · NASA data from 1981, ESI from 2001 · projection to 2050 (SSP2-4.5)')}</div>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link to="/map" className="btn on !px-5 !py-2.5 !text-[14.5px]">{t('Άνοιξε τον χάρτη →', 'Open the map →')}</Link>
            <Link to="/results" className="btn !px-5 !py-2.5 !text-[14.5px]">{t('Αποτελέσματα', 'Results')}</Link>
          </div>
        </div>

        <div className="card p-5 flex flex-col gap-5">
          <div>
            <div className="text-[13px] text-muted mb-2.5">{t('Πώς διαβάζεται', 'How to read it')}</div>
            <div className="grid sm:grid-cols-5 gap-x-1 gap-y-2">
              {scale.map(({ name, range }, i) => (
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
            <div className="text-[13px] text-muted mb-2">{t('Ο κανονικός ESI', 'The main ESI')}</div>
            <div className="num text-[15px] md:text-[16px] text-fg leading-relaxed">
              ESI = 100 × {params.map((p, i) => (
                <span key={p.key}>{i > 0 && ' × '}s<sub className="text-[11px]">{p.key}</sub><sup className="text-accent-2 text-[11px]">{nf(w[p.key], 2)}</sup></span>
              ))}
            </div>
            <div className="text-[12.5px] text-soft mt-2">{t('s = πόσο ευνοϊκή είναι κάθε παράμετρος, από 0 ως 1. Ο εκθέτης είναι το βάρος της.',
              's = how favourable each parameter is, from 0 to 1. The exponent is its weight.')}</div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">{t('Οι 5 παράμετροι', 'The 5 parameters')}</h2>
          <p className="text-[14px] text-soft mt-1">{t('Το ποσοστό είναι το βάρος της παραμέτρου στον κανονικό ESI. Ο ESI με ίσα βάρη δίνει 20% σε καθεμία.',
            'The percentage is the weight of the parameter in the main ESI. The equal-weights ESI gives 20% to each.')}</p>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {params.map((p) => (
            <div key={p.key} className="card p-4 flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-[15.5px]">{t(p.el, p.en)}</span>
                <span className="num text-[26px] font-semibold text-accent leading-none">{nf(pct(p.key), 0)}%</span>
              </div>
              <div className="h-1.5 rounded bg-line-2 overflow-hidden"><div className="h-full rounded bg-accent" style={{ width: `${pct(p.key)}%` }} /></div>
              <div className="num text-[11.5px] text-muted">{p.code} · {p.source}</div>
              <div className="text-[13px]"><span className="text-muted">{t('Ευνοϊκή: ', 'Favourable: ')}</span><span className="text-fg">{t(p.good[0], p.good[1])}</span></div>
              <p className="text-[13px] text-soft leading-snug">{t(p.text[0], p.text[1])}</p>
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
