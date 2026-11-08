// Results: every parameter over time for Greece (mean of all regions) with its trend, then the regions
// with the highest and the lowest suitability.
import { useApi, type National } from '../api'
import { Card, ErrorBox, Loading } from '../components/Layout'
import { TimeChart } from '../components/Charts'
import { LAYER_INFO, nf, pfmt, signed, trendRows } from '../fmt'

const VARS = ['ESI', 'T2M', 'PRECIP', 'RH2M', 'WS10M', 'NDVI']
const UNIT: Record<string, string> = { ESI: '0–100', T2M: '°C', PRECIP: 'mm ανά έτος', RH2M: '%', WS10M: 'm/s', NDVI: 'MODIS' }

export default function ResultsPage() {
  const nat = useApi<National>('/api/national')
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
        <h1 className="text-2xl md:text-[30px] font-semibold tracking-tight">Αποτελέσματα</h1>
        <p className="text-soft mt-1.5 text-[15px]">Ελλάδα, μέσος όρος όλων των περιοχών. Μεταβολή ανά 5 χρόνια, σημαντική όταν p &lt; 0,05.</p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {VARS.map((v) => <VarChart key={v} v={v} n={n} ly={ly} />)}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <RegionTable title="Περιφέρειες με τη μεγαλύτερη καταλληλότητα" rows={top} max={max} color="#fe9f6d" period={`${ly - 4}–${ly}`} />
        <RegionTable title="Περιφέρειες με τη μικρότερη καταλληλότητα" rows={bottom} max={max} color="#5aa9e6" period={`${ly - 4}–${ly}`} />
      </div>
    </div>
  )
}

function VarChart({ v, n, ly }: { v: string; n: National; ly: number }) {
  const info = LAYER_INFO[v]
  const t = n.trends[v]
  const obs = n.annual.filter((r) => r[v] != null && (r.year as number) >= info.first && (r.year as number) <= ly).map((r) => ({ year: r.year as number, v: r[v] as number }))
  const rows: Record<string, unknown>[] = t ? trendRows(obs, t.sen_decade, t.first, t.last) : obs
  if (v === 'ESI') {   // the intermediate scenario only (SSP2-4.5), from the last complete year on
    for (const p of n.projections.filter((p) => p.scenario === 'ssp245' && p.year >= ly)) {
      const row = rows.find((r) => r.year === p.year)
      const add = { s245: p.ESI_med, lo: p.ESI_p10, hi: p.ESI_p90 }
      if (row) Object.assign(row, add)
      else rows.push({ year: p.year, ...add })
    }
  }
  const sub = t ? (
    <>Ανά 5 χρόνια <b className={`num ${t.significant ? (t.sen_decade > 0 ? 'text-up' : 'text-down') : 'text-fg'}`}>{signed(t.sen_decade / 2, info.digits + 1)}</b>
      {' '}· p <span className="num">{pfmt(t.p)}</span> · {t.significant ? <span className="text-ok">σημαντική</span> : 'όχι σημαντική'}</>
  ) : null
  return (
    <Card title={<>{info.label} <span className="text-muted font-normal text-[13px]">· {UNIT[v]}</span></>} sub={sub} className={v === 'ESI' ? 'md:col-span-2 xl:col-span-1' : ''}>
      <TimeChart data={rows}
        series={[
          { key: 'v', name: 'Μετρήσεις', color: v === 'ESI' ? '#fe9f6d' : '#5aa9e6', dot: true, width: 1.5 },
          ...(t ? [{ key: 'trend', name: 'Τάση', color: '#ffcf70', dashed: true, width: 1.4 }] : []),
          ...(v === 'ESI' ? [{ key: 's245', name: 'Πρόβλεψη SSP2-4.5', color: '#5aa9e6', dashed: true, width: 1.8 }] : []),
        ]}
        bands={v === 'ESI' ? [{ lo: 'lo', hi: 'hi', color: '#5aa9e6', name: 'εύρος μοντέλων' }] : []}
        refX={v === 'ESI' ? { x: ly, label: 'σήμερα' } : undefined} shadeFrom={v === 'ESI' ? ly : undefined}
        clampY={v === 'ESI' ? [0, 100] : undefined} height={210} digits={info.digits === 0 ? 1 : info.digits} />
    </Card>
  )
}

function RegionTable({ title, rows, max, color, period }: { title: string; rows: National['regions']; max: number; color: string; period: string }) {
  return (
    <Card title={title} sub={`ESI ${period} · σε παρένθεση η αλλαγή από το 2001–2010`}>
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.region} className="grid grid-cols-[1fr_minmax(80px,140px)_92px] items-center gap-3 text-[14px]">
            <span className="text-fg">{r.region}</span>
            <div className="h-2.5 rounded bg-line-2 overflow-hidden"><div className="h-full rounded" style={{ width: `${(r.esi / max) * 100}%`, background: color }} /></div>
            <span className="num text-right text-fg">{nf(r.esi, 0)} <span className={`text-[12px] ${(r.change ?? 0) > 0 ? 'text-up' : 'text-down'}`}>({signed(r.change, 1)})</span></span>
          </div>
        ))}
      </div>
    </Card>
  )
}
