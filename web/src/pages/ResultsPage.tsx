// Results: every parameter over time for Greece (mean of all regions) with its trend, then the regions
// with the highest and the lowest suitability.
import { useApi, type National } from '../api'
import { Card, ErrorBox, Loading } from '../components/Layout'
import { TimeChart } from '../components/Charts'
import { LAYER_INFO, label, nf, pfmt, signed, trendRows } from '../fmt'
import { regionName, useT } from '../i18n'

const VARS = ['ESI', 'T2M', 'PRECIP', 'RH2M', 'WS10M', 'NDVI']

export default function ResultsPage() {
  const nat = useApi<National>('/api/national')
  const t = useT()
  if (nat.error) return <ErrorBox error={nat.error} />
  if (!nat.data) return <Loading />
  const n = nat.data
  const ly = n.last_complete_year
  const top = n.regions.slice(0, 5)
  const bottom = n.regions.slice(-5).reverse()
  const max = Math.max(...n.regions.map((r) => r.esi))
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl md:text-[30px] font-semibold tracking-tight">{t('Αποτελέσματα', 'Results')}</h1>
        <p className="text-soft mt-1.5 text-[15px]">{t('Ελλάδα, μέσος όρος όλων των περιοχών. Μεταβολή ανά 5 χρόνια, σημαντική όταν p < 0,05.',
          'Greece, mean of all regions. Change per 5 years, significant when p < 0.05.')}</p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {VARS.map((v) => <VarChart key={v} v={v} n={n} ly={ly} />)}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <RegionTable title={t('Περιφέρειες με τη μεγαλύτερη καταλληλότητα', 'Regions with the highest suitability')} rows={top} max={max} color="#fe9f6d" period={`${ly - 4}–${ly}`} />
        <RegionTable title={t('Περιφέρειες με τη μικρότερη καταλληλότητα', 'Regions with the lowest suitability')} rows={bottom} max={max} color="#5aa9e6" period={`${ly - 4}–${ly}`} />
      </div>
    </div>
  )
}

function VarChart({ v, n, ly }: { v: string; n: National; ly: number }) {
  const t = useT()
  const info = LAYER_INFO[v]
  const unit: Record<string, string> = { ESI: '0–100', T2M: '°C', PRECIP: t('mm ανά έτος', 'mm per year'), RH2M: '%', WS10M: 'm/s', NDVI: 'MODIS' }
  const tr = n.trends[v]
  const obs = n.annual.filter((r) => r[v] != null && (r.year as number) >= info.first && (r.year as number) <= ly).map((r) => ({ year: r.year as number, v: r[v] as number }))
  const rows: Record<string, unknown>[] = tr ? trendRows(obs, tr.sen_decade, tr.first, tr.last) : obs
  // every parameter goes on to 2050: the intermediate scenario (SSP2-4.5), from the last complete year on
  for (const p of n.projections.filter((p) => p.scenario === 'ssp245' && (p.year as number) >= ly)) {
    const row = rows.find((r) => r.year === p.year)
    const add = { s245: p[`${v}_med`], lo: p[`${v}_p10`], hi: p[`${v}_p90`] }
    if (row) Object.assign(row, add)
    else rows.push({ year: p.year, ...add })
  }
  const sub = tr ? (
    <>{t('Ανά 5 χρόνια', 'Per 5 years')} <b className={`num ${tr.significant ? (tr.sen_decade > 0 ? 'text-up' : 'text-down') : 'text-fg'}`}>{signed(tr.sen_decade / 2, info.digits + 1)}</b>
      {' '}· p <span className="num">{pfmt(tr.p)}</span> · {tr.significant ? <span className="text-ok">{t('σημαντική', 'significant')}</span> : t('όχι σημαντική', 'not significant')}</>
  ) : null
  return (
    <Card title={<>{label(info)} <span className="text-muted font-normal text-[13px]">· {unit[v]}</span></>} sub={sub} className={v === 'ESI' ? 'md:col-span-2 xl:col-span-1' : ''}>
      <TimeChart data={rows}
        series={[
          { key: 'v', name: t('Μετρήσεις', 'Observed'), color: v === 'ESI' ? '#fe9f6d' : '#5aa9e6', dot: true, width: 1.5 },
          ...(tr ? [{ key: 'trend', name: t('Τάση', 'Trend'), color: '#ffcf70', dashed: true, width: 1.4 }] : []),
          { key: 's245', name: t('Πρόβλεψη SSP2-4.5', 'Projection SSP2-4.5'), color: v === 'ESI' ? '#5aa9e6' : '#fe9f6d', dashed: true, width: 1.8 },
        ]}
        bands={[{ lo: 'lo', hi: 'hi', color: v === 'ESI' ? '#5aa9e6' : '#fe9f6d', name: t('εύρος μοντέλων', 'model range') }]}
        refX={{ x: ly, label: t('σήμερα', 'today') }} shadeFrom={ly}
        clampY={v === 'ESI' ? [0, 100] : undefined} height={210} digits={info.digits === 0 ? 1 : info.digits} />
    </Card>
  )
}

function RegionTable({ title, rows, max, color, period }: { title: string; rows: National['regions']; max: number; color: string; period: string }) {
  const t = useT()
  return (
    <Card title={title} sub={`ESI ${period} · ${t('σε παρένθεση η αλλαγή από το 2001–2010', 'in brackets the change since 2001–2010')}`}>
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.region} className="grid grid-cols-[1fr_minmax(80px,140px)_92px] items-center gap-3 text-[14px]">
            <span className="text-fg">{regionName(r.region)}</span>
            <div className="h-2.5 rounded bg-line-2 overflow-hidden"><div className="h-full rounded" style={{ width: `${(r.esi / max) * 100}%`, background: color }} /></div>
            <span className="num text-right text-fg">{nf(r.esi, 0)} <span className={`text-[12px] ${(r.change ?? 0) > 0 ? 'text-up' : 'text-down'}`}>({signed(r.change, 1)})</span></span>
          </div>
        ))}
      </div>
    </Card>
  )
}
