import { useMemo, useState } from 'react'
import { useApi, type Meta, type National } from '../api'
import { Card, ErrorBox, Loading, Page } from '../components/Layout'
import GreeceMap, { Legend } from '../components/GreeceMap'
import { MonthBars, TimeChart } from '../components/Charts'
import GroupsCard from '../components/GroupsCard'
import { CHANGE_PALETTE, LAYER_INFO, MONTHS, nf, pfmt, signed } from '../fmt'

type TrendRow = { cell: string; sen_decade: number; p_mk: number; sig_fdr: boolean }
const VARS = ['ESI', 'T2M', 'PRECIP', 'RH2M', 'WS10M', 'NDVI']

export default function HistoryPage() {
  const meta = useApi<Meta>('/api/meta')
  const nat = useApi<National>('/api/national')
  const [tv, setTv] = useState('ESI')
  const [onlySig, setOnlySig] = useState(false)
  const tr = useApi<Record<string, TrendRow>>(`/api/trends?var=${tv}&scope=annual`)
  const shares = VARS.map((v) => useApi<Record<string, TrendRow>>(`/api/trends?var=${v}&scope=annual`))
  const values = useMemo(() => Object.fromEntries(Object.entries(tr.data ?? {}).map(([k, r]) => [k, onlySig && !r.sig_fdr ? null : r.sen_decade])), [tr.data, onlySig])
  if (meta.error || nat.error) return <ErrorBox error={(meta.error || nat.error)!} />
  if (!meta.data || !nat.data) return <Loading />
  const m = meta.data, n = nat.data
  const info = LAYER_INFO[tv]
  const absMax = Math.max(0.01, ...Object.values(tr.data ?? {}).map((r) => Math.abs(r.sen_decade)))
  const dom: [number, number] = [-absMax, absMax]
  const decades: [string, number, number][] = [['1981–1990', 1981, 1990], ['1991–2000', 1991, 2000], ['2001–2010', 2001, 2010], ['2011–2020', 2011, 2020], ['2016–2025', 2016, 2025]]
  const dmean = (v: string, a: number, b: number) => {
    const rows = n.annual.filter((r) => (r.year as number) >= a && (r.year as number) <= b && r[v] != null)
    return rows.length ? rows.reduce((s, r) => s + (r[v] as number), 0) / rows.length : null
  }
  const clim = (v: string, a: number, b: number) => Array.from({ length: 12 }, (_, i) => {
    const rows = n.monthly.filter((r) => r.month === i + 1 && (r.year as number) >= a && (r.year as number) <= b && r[v] != null)
    return rows.length ? rows.reduce((s, r) => s + (r[v] as number), 0) / rows.length : null
  })
  const esiEarly = clim('ESI', 2001, 2010), esiLate = clim('ESI', 2016, 2025)
  const tEarly = clim('T2M', 1981, 1990), tLate = clim('T2M', 2016, 2025)
  const regions = [...n.regions].sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
  return (
    <Page eyebrow="Ιστορική εξέλιξη" title="Πώς άλλαξαν οι συνθήκες από το 1981"
      lead="Οι πέντε παράμετροι από το 1981 και ο ESI από το 2001, για όλη την Ελλάδα. Τάσεις με Mann-Kendall (διόρθωση Hamed-Rao για αυτοσυσχέτιση), κλίση Sen, γραμμική παλινδρόμηση με σφάλματα Newey-West και έλεγχο Benjamini-Hochberg για τους πολλούς ελέγχους.">
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {VARS.map((v) => {
          const t = n.trends[v]
          const rows = n.annual.filter((r) => r[v] != null && (r.year as number) <= n.last_complete_year).map((r) => ({ year: r.year, v: r[v] }))
          return (
            <Card key={v} title={LAYER_INFO[v].label} sub={t ? <>Sen <span className="num">{signed(t.sen_decade, LAYER_INFO[v].digits + 1)} {LAYER_INFO[v].unit}</span>/10 έτη · p <span className="num">{pfmt(t.p)}</span> · {t.significant ? 'σίγουρη' : 'όχι σίγουρη'}</> : null}>
              <TimeChart data={rows} series={[{ key: 'v', name: LAYER_INFO[v].short, color: v === 'ESI' ? '#fe9f6d' : '#5aa9e6', dot: true, width: 1.5 }]} height={170} digits={LAYER_INFO[v].digits} />
            </Card>
          )
        })}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Εποχικός κύκλος του ESI" sub="Ελλάδα: 2001–2010 έναντι 2016–2025">
          <MonthBars data={MONTHS.slice(1).map((l, i) => ({ label: l, a: esiEarly[i], b: esiLate[i] }))} keys={[{ key: 'a', name: '2001–2010', color: '#4a566b' }, { key: 'b', name: '2016–2025', color: '#de4968' }]} height={220} digits={1} />
        </Card>
        <Card title="Εποχικός κύκλος της θερμοκρασίας" sub="Ελλάδα: 1981–1990 έναντι 2016–2025 (°C)">
          <MonthBars data={MONTHS.slice(1).map((l, i) => ({ label: l, a: tEarly[i], b: tLate[i] }))} keys={[{ key: 'a', name: '1981–1990', color: '#4a566b' }, { key: 'b', name: '2016–2025', color: '#f0704a' }]} height={220} digits={1} />
        </Card>
      </div>
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4">
        <Card title="Χάρτης τάσεων ανά κελί" sub="κλίση Sen ανά δεκαετία στα πλήρη έτη"
          right={<div className="flex gap-1.5 flex-wrap justify-end">{VARS.map((v) => <button key={v} className={`btn ${tv === v ? 'on' : ''}`} onClick={() => setTv(v)}>{LAYER_INFO[v].short}</button>)}</div>}>
          <GreeceMap values={values} palette={CHANGE_PALETTE} domain={dom} height={420}
            tooltip={(id, x) => { const r = tr.data?.[id]; return `<b>${m.cells.find((c) => c.cell === id)?.region ?? id}</b><br/>Sen: <b>${signed(x ?? r?.sen_decade, info.digits + 1)}</b> ${info.unit}/10 έτη<br/>p = ${pfmt(r?.p_mk)} · ${r?.sig_fdr ? 'σίγουρη (FDR)' : 'όχι σίγουρη'}` }} />
          <div className="mt-3 flex items-center gap-4">
            <div className="grow"><Legend palette={CHANGE_PALETTE} domain={dom} unit={`${info.unit}/10 έτη`} title={`Τάση ${info.label}`} digits={info.digits + 1} /></div>
            <label className="text-[12.5px] text-soft flex items-center gap-1.5"><input type="checkbox" checked={onlySig} onChange={(e) => setOnlySig(e.target.checked)} /> μόνο σίγουρες τάσεις</label>
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="Σύγκριση δεκαετιών (Ελλάδα)">
            <table className="tbl">
              <thead><tr><th>Μεταβλητή</th>{decades.map(([d]) => <th key={d} className="num">{d}</th>)}</tr></thead>
              <tbody>{VARS.map((v) => <tr key={v}><td>{LAYER_INFO[v].short}</td>{decades.map(([d, a, b]) => <td key={d} className="num">{nf(dmean(v, a, b), LAYER_INFO[v].digits)}</td>)}</tr>)}</tbody>
            </table>
            <div className="text-[11.5px] text-muted mt-2">ESI και NDVI υπάρχουν από το 2000 (MODIS).</div>
          </Card>
          <Card title="Ποσοστό κελιών με σίγουρη τάση" sub="Benjamini-Hochberg, α = 0,05 · ↑ άνοδος / ↓ πτώση">
            <table className="tbl">
              <thead><tr><th>Μεταβλητή</th><th>↑ σίγουρη</th><th>↓ σίγουρη</th><th>Χωρίς σίγουρη τάση</th></tr></thead>
              <tbody>{VARS.map((v, i) => {
                const rows = Object.values(shares[i].data ?? {})
                const up = rows.filter((r) => r.sig_fdr && r.sen_decade > 0).length, down = rows.filter((r) => r.sig_fdr && r.sen_decade < 0).length
                return <tr key={v}><td>{LAYER_INFO[v].short}</td><td className="num text-up">{rows.length ? nf((up / rows.length) * 100, 0) : '—'}%</td><td className="num text-down">{rows.length ? nf((down / rows.length) * 100, 0) : '—'}%</td><td className="num">{rows.length ? nf(((rows.length - up - down) / rows.length) * 100, 0) : '—'}%</td></tr>
              })}</tbody>
            </table>
          </Card>
        </div>
      </div>
      <Card title="Πού αυξήθηκε και πού μειώθηκε η καταλληλότητα" sub={`μέσος ESI ${n.last_complete_year - 4}–${n.last_complete_year} έναντι 2001–2010, ανά περιφέρεια`}>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          {regions.map((r) => (
            <div key={r.region} className="grid grid-cols-[1fr_70px_60px] gap-2 text-[13px] items-center">
              <span>{r.region}</span><span className="num text-muted text-right">{nf(r.esi_2001_2010, 1)} → {nf(r.esi, 1)}</span>
              <span className={`num text-right ${(r.change ?? 0) > 0 ? 'text-up' : 'text-down'}`}>{signed(r.change, 1)}</span>
            </div>
          ))}
        </div>
      </Card>
      <GroupsCard />
    </Page>
  )
}
