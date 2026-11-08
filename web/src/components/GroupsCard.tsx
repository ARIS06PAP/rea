// Comparison of cell groups (north/south, mainland/island, coastal/inland, urbanisation, elevation).
// The attributes only describe the cells; none of them enters the ESI.
import { useMemo, useState } from 'react'
import { useApi } from '../api'
import { Card, Loading } from './Layout'
import { TimeChart } from './Charts'
import { LAYER_INFO, nf, pfmt, signed } from '../fmt'

type GItem = {
  group: string; cells: number; recent: number | null; early: number | null; change: number | null
  trend: { sen_decade: number; p: number; significant: boolean } | null
  proj_2041_2050?: Record<string, number> | null
  series: { year: number; v: number | null }[]
}
type Groups = { var: string; recent_period: string; early_period: string; groupings: { key: string; label: string; groups: GItem[] }[] }

const VARS = ['ESI', 'T2M', 'PRECIP', 'RH2M', 'WS10M', 'NDVI']
const SHORT: Record<string, string> = { north: 'Βόρεια / νότια', island: 'Ηπειρωτική / νησιωτική', coastal: 'Παράκτια / εσωτερική', urban: 'Αστικοποίηση', elev: 'Υψόμετρο' }
const COLORS = ['#fe9f6d', '#5aa9e6', '#9be29b']

export default function GroupsCard() {
  const [v, setV] = useState('ESI')
  const [k, setK] = useState('north')
  const g = useApi<Groups>(`/api/groups?var=${v}`)
  const info = LAYER_INFO[v]
  const sel = g.data?.groupings.find((x) => x.key === k)
  const rows = useMemo(() => {
    if (!sel) return []
    const by = new Map<number, Record<string, number | null>>()
    sel.groups.forEach((it, i) => it.series.forEach((p) => {
      const r = by.get(p.year) ?? { year: p.year }
      r[`g${i}`] = p.v
      by.set(p.year, r)
    }))
    return [...by.values()].sort((a, b) => (a.year as number) - (b.year as number))
  }, [sel])
  const isEsi = v === 'ESI'
  const d = isEsi ? 1 : info.digits   // group means differ by a few ESI points: show one decimal
  return (
    <Card title="Σύγκριση γεωγραφικών ομάδων"
      sub="Βόρεια/νότια, ηπειρωτική/νησιωτική, παράκτια/εσωτερική, αστικοποίηση, υψόμετρο · μέσος όρος σταθμισμένος με την ελληνική στεριά κάθε κελιού"
      right={<div className="flex gap-1.5 flex-wrap justify-end">{VARS.map((x) => <button key={x} className={`btn ${v === x ? 'on' : ''}`} onClick={() => setV(x)}>{LAYER_INFO[x].short}</button>)}</div>}>
      {g.error && <div className="text-up text-sm">Σφάλμα: {g.error}</div>}
      {!g.data || !sel ? <Loading /> : (
        <div className="grid lg:grid-cols-[1fr_1.3fr] gap-5">
          <div>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {g.data.groupings.map((x) => <button key={x.key} className={`btn ${k === x.key ? 'on' : ''}`} onClick={() => setK(x.key)}>{SHORT[x.key] ?? x.key}</button>)}
            </div>
            <div className="text-[12px] text-muted mb-1">{sel.label} · {info.label}{info.unit ? ` (${info.unit.replace('/100', '0–100')})` : ''}, πλήρη έτη</div>
            <TimeChart data={rows} series={sel.groups.map((it, i) => ({ key: `g${i}`, name: `${it.group} (${it.cells} κελιά)`, color: COLORS[i % COLORS.length], width: 1.6 }))} height={250} digits={d} />
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ομάδα</th><th className="num">Κελιά</th><th className="num">{g.data.early_period}</th><th className="num">{g.data.recent_period}</th>
                  <th className="num">Μεταβολή</th><th className="num">Sen /10 έτη</th><th className="num">p</th>
                  {isEsi && <th className="num" title="Διάμεσος 8 μοντέλων CMIP6, 2041–2050 έναντι 1995–2014">2041–2050 SSP2-4.5 / 5-8.5</th>}
                </tr>
              </thead>
              <tbody>
                {g.data.groupings.map((gr) => [
                  <tr key={gr.key}><td colSpan={isEsi ? 8 : 7} className={`text-[11.5px] uppercase tracking-wide pt-3 ${gr.key === k ? 'text-accent' : 'text-muted'}`}>{SHORT[gr.key]}</td></tr>,
                  ...gr.groups.map((it) => (
                    <tr key={gr.key + it.group}>
                      <td>{it.group}</td>
                      <td className="num text-muted">{it.cells}</td>
                      <td className="num">{nf(it.early, d)}</td>
                      <td className="num">{nf(it.recent, d)}</td>
                      <td className={`num ${(it.change ?? 0) > 0 ? 'text-up' : (it.change ?? 0) < 0 ? 'text-down' : ''}`}>{signed(it.change, d)}</td>
                      <td className="num">{it.trend ? signed(it.trend.sen_decade, info.digits + 1) : '—'}</td>
                      <td className={`num ${it.trend?.significant ? '' : 'text-muted'}`}>{it.trend ? pfmt(it.trend.p) : '—'}</td>
                      {isEsi && <td className="num">{it.proj_2041_2050 ? `${signed(it.proj_2041_2050.ssp245, 1)} / ${signed(it.proj_2041_2050.ssp585, 1)}` : '—'}</td>}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="text-[11.5px] text-muted mt-3 leading-relaxed">
        Τα χαρακτηριστικά αυτά περιγράφουν τα κελιά (FAO GAUL, ESA WorldCover, GMTED2010) και δεν μπαίνουν στον ESI. p: Mann-Kendall με διόρθωση Hamed-Rao για αυτοσυσχέτιση,
        χωρίς διόρθωση για πολλαπλούς ελέγχους. Μια διαφορά ανάμεσα σε ομάδες δεν αποδεικνύει αιτία. Τα «πιο αστικοποιημένα» κελιά είναι λίγα, γιατί κάθε κελί (0,5° × 0,625°)
        είναι πολύ μεγαλύτερο από μια πόλη: η αστική σύγκριση είναι ενδεικτική.
      </div>
    </Card>
  )
}
