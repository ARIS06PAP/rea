import { useState } from 'react'
import { useApi, type Meta, type Trend } from '../api'
import { Card, ErrorBox, Loading, Page, Stat } from '../components/Layout'
import GreeceMap, { Legend } from '../components/GreeceMap'
import { MonthBars, TimeChart } from '../components/Charts'
import { LAYER_INFO, MONTHS, MONTHS_LONG, niceDomain, nf, pfmt, signed } from '../fmt'

type ParamResp = {
  var: string; monthly: { year: number; month: number; v: number | null }[]; annual: { year: number; v: number | null }[]
  max: { cell: string; region: string; year: number; month: number; v: number } | null
  min: { cell: string; region: string; year: number; month: number; v: number } | null
  climatology: { month: number; v: number }[]; map: Record<string, number | null>; trend: Trend
  favourable_by_decade: { dec: number; share_favourable: number; mean_score: number }[] | null
}

const FAV: Record<string, string> = {
  T2M: 'Πλήρης καταλληλότητα σε μέση μηνιαία θερμοκρασία 25–30 °C (εύρος βέλτιστου ρυθμού αύξησης πληθυσμού στο εργαστήριο, Delatte et al. 2009). Η δραστηριότητα κορυφώνεται γύρω στους 26,5 °C (Yin et al. 2019) και τελειώνει το φθινόπωρο όταν η ελάχιστη πέφτει κάτω από 9 °C (Roiz et al. 2010).',
  PRECIP: 'Ευνοϊκή συνολική βροχή 35 ημερών 90–800 mm (στατιστικό μοντέλο προνυμφών, Tran et al. 2020, Ρεϊνιόν). Πάνω από 800 mm οι εστίες ξεπλένονται. Ετήσια βροχή πάνω από 500 mm είναι παλιό κριτήριο ειδικών, όχι βιολογικό όριο.',
  RH2M: 'Το 75–80% είναι συνθήκη εκτροφής στο εργαστήριο, όχι όριο πεδίου. Στο πεδίο η πυκνότητα αυξάνεται με την υγρασία (Yin et al. 2019).',
  WS10M: 'Καμία επίδραση του μέσου ανέμου 5 εβδομάδων ως ~4,3 m/s, αρνητική πάνω από αυτό (Bartholomée et al. 2025, Μονπελιέ).',
  NDVI: 'Η χαμηλή βλάστηση (σκιά, καταφύγιο) σχετίζεται θετικά με την αφθονία ως ~23% κάλυψη σε ακτίνα 250 m, χωρίς πτώση πάνω από αυτό (Bartholomée et al. 2025). Σε κελιά 50 km το NDVI δείχνει μόνο αν υπάρχει βλάστηση.',
}

export default function ParamsPage() {
  const meta = useApi<Meta>('/api/meta')
  const [v, setV] = useState('T2M')
  const [start, setStart] = useState(v === 'NDVI' ? 2000 : 1981)
  const [end, setEnd] = useState(2026)
  const s0 = v === 'NDVI' ? Math.max(start, 2000) : start
  const p = useApi<ParamResp>(`/api/param/${v}?start=${s0}&end=${end}`)
  const info = LAYER_INFO[v]
  if (meta.error || p.error) return <ErrorBox error={(meta.error || p.error)!} />
  if (!meta.data) return <Loading />
  const m = meta.data
  const d = p.data
  const mapVals = d?.map ?? {}
  const dom = niceDomain(Object.values(mapVals).filter((x): x is number => x !== null))
  const ann = (d?.annual ?? []).filter((a) => a.v !== null && a.year <= m.last_complete_year)
  const monthly = (d?.monthly ?? []).map((r) => ({ year: r.year + (r.month - 0.5) / 12, v: r.v }))
  const t = d?.trend
  return (
    <Page eyebrow="Παράμετροι" title="Οι πέντε παράμετροι, μία προς μία"
      lead="Διάλεξε μια παράμετρο και μια περίοδο: πώς άλλαξε και πόσο συχνά ήταν ευνοϊκή για το κουνούπι."
      more="Για κάθε παράμετρο: ιστορικό, ετήσιοι μέσοι όροι, ακραίες τιμές, χωρική κατανομή, μακροχρόνια τάση και σύγκριση με τις συνθήκες που ευνοούν το κουνούπι τίγρη. Οι τιμές Ελλάδας είναι σταθμισμένος μέσος όρος της ελληνικής στεριάς στα κελιά.">
      <div className="card p-3 flex flex-wrap items-center gap-3">
        {['T2M', 'PRECIP', 'RH2M', 'WS10M', 'NDVI'].map((k) => (
          <button key={k} className={`btn ${v === k ? 'on' : ''}`} onClick={() => { setV(k); if (k === 'NDVI' && start < 2000) setStart(2000) }}>{LAYER_INFO[k].label}</button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-[13px] text-soft">Από
          <input className="sel w-20 num" type="number" min={v === 'NDVI' ? 2000 : 1981} max={end} value={s0} onChange={(e) => setStart(+e.target.value)} />
          έως <input className="sel w-20 num" type="number" min={s0} max={2026} value={end} onChange={(e) => setEnd(+e.target.value)} />
        </label>
      </div>
      {!d ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label={`Μακροχρόνια τάση ${t?.first ?? ''}–${t?.last ?? ''}`} value={signed(t?.sen_decade, info.digits + 1)} unit={`${info.unit}/10 έτη`} tone={t?.significant ? (t.sen_decade > 0 ? 'up' : 'down') : 'none'}
              note={<>Sen, Mann-Kendall p = <span className="num">{pfmt(t?.p)}</span> · {t?.significant ? 'σίγουρη' : 'όχι σίγουρη'}</>} />
            <Stat label="Ετήσιος μέσος (περίοδος)" value={nf(ann.reduce((s, a) => s + (a.v ?? 0), 0) / (ann.length || 1), info.digits)} unit={v === 'PRECIP' ? 'mm/έτος' : info.unit} note={`${ann.length} πλήρη έτη`} />
            <Stat label="Μέγιστη μηνιαία τιμή" value={nf(d.max?.v, info.digits)} unit={info.unit} note={d.max ? `${d.max.region} · ${MONTHS[d.max.month]} ${d.max.year}` : ''} />
            <Stat label="Ελάχιστη μηνιαία τιμή" value={nf(d.min?.v, info.digits)} unit={info.unit} note={d.min ? `${d.min.region} · ${MONTHS[d.min.month]} ${d.min.year}` : ''} />
          </div>
          <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
            <Card title="Μηνιαίες τιμές (Ελλάδα)" sub={`${info.label} · ${s0}–${end}`}>
              <TimeChart data={monthly} series={[{ key: 'v', name: info.short, color: '#5aa9e6', width: 1 }]} height={240} digits={info.digits} />
            </Card>
            <Card title="Ετήσιος μέσος όρος και τάση" sub={v === 'PRECIP' ? 'συνολική ετήσια βροχή' : 'μέσος όρος 12 μηνών'}>
              <TimeChart data={ann.map((a) => ({ year: a.year, v: a.v, trend: t ? (t.sen_decade / 10) * (a.year - (t.first + t.last) / 2) + ann.reduce((s, x) => s + (x.v ?? 0), 0) / ann.length : null }))}
                series={[{ key: 'v', name: 'Ετήσια τιμή', color: '#fe9f6d', dot: true }, { key: 'trend', name: 'Τάση Sen (κεντραρισμένη)', color: '#ffcf70', dashed: true, width: 1.5 }]} height={240} digits={info.digits} />
            </Card>
          </div>
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4">
            <Card title="Χωρική κατανομή" sub={`μέσος όρος ${s0}–${end}${v === 'PRECIP' ? ' (mm/έτος)' : ''}`}>
              <GreeceMap values={mapVals} palette={info.palette} domain={dom} height={420}
                tooltip={(id, x) => `<b>${m.cells.find((c) => c.cell === id)?.region ?? id}</b><br/>${info.short}: <b>${nf(x, info.digits)}</b> ${info.unit}`} />
              <div className="mt-3"><Legend palette={info.palette} domain={dom} unit={info.unit} title={info.label} digits={info.digits} /></div>
            </Card>
            <div className="flex flex-col gap-4">
              <Card title="Εποχικός κύκλος" sub={`μέσος όρος ανά μήνα, ${s0}–${end}`}>
                <MonthBars data={d.climatology.map((c) => ({ label: MONTHS[c.month], v: c.v }))} keys={[{ key: 'v', name: info.short, color: '#5aa9e6' }]} height={190} digits={info.digits} />
              </Card>
              <Card title="Σε σχέση με τις ευνοϊκές συνθήκες για το κουνούπι τίγρη">
                <p className="text-[13px] text-soft leading-relaxed">{FAV[v]}</p>
                {d.favourable_by_decade && (
                  <table className="tbl mt-3">
                    <thead><tr><th>Δεκαετία</th><th>Μήνες με καταλληλότητα ≥ 0,8</th><th>Μέση καταλληλότητα</th></tr></thead>
                    <tbody>{d.favourable_by_decade.map((r) => <tr key={r.dec}><td className="num">{r.dec}s</td><td className="num">{nf(r.share_favourable * 100, 1)}%</td><td className="num">{nf(r.mean_score, 2)}</td></tr>)}</tbody>
                  </table>
                )}
                <div className="text-[11.5px] text-muted mt-2">Η «καταλληλότητα» είναι η συνάρτηση της παραμέτρου στον ESI (0–1), σε όλα τα κελιά και τους μήνες. Ο τρέχων μήνας: {MONTHS_LONG[m.last_month.month]} {m.last_month.year}.</div>
              </Card>
            </div>
          </div>
        </>
      )}
    </Page>
  )
}
