// The card of one region on the map. ESI: the value at the chosen time, the five factors (0–1), the ESI over
// the years and the seasonal cycle. A parameter: its value, the change per five years with the p-value, and
// the parameter over the years with its trend line.
import { useApi, type Panel, type Place } from '../api'
import { MonthBars, ScoreBars, TimeChart } from './Charts'
import { FACTORS, LAYER_INFO, MONTHS, MONTHS_LONG, esiWord, nf, pfmt, signed, trendRows } from '../fmt'

export default function RegionPanel({ cell, layer, year, month, places, onClose }:
  { cell: string; layer: string; year: number; month: number; places: Place[] | null; onClose: () => void }) {
  const { data, error } = useApi<Panel>(`/api/panel/${cell}?layer=${layer}&year=${year}&month=${month}`)
  const info = LAYER_INFO[layer]
  const place = places?.find((p) => p.cell === cell)
  if (error) return <div className="text-sm text-up">{error}</div>
  if (!data) return <div className="text-sm text-muted py-6">Φόρτωση…</div>
  const c = data.cell
  const proj = data.kind === 'projection'
  const when = month ? `${MONTHS_LONG[month]} ${year}` : data.partial_months ? `${year} (${MONTHS[1]}–${MONTHS[data.partial_months]})` : `${year}, όλο το έτος`
  const per = month ? MONTHS_LONG[month] : info.esi || layer !== 'PRECIP' ? 'μέσος όρος έτους' : 'σύνολο έτους'
  const inSeries = data.series.some((p) => p.year === year)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <div className="text-[19px] font-semibold leading-tight">{place?.name ?? c.region}</div>
          <div className="text-[12px] text-muted mt-1">{place ? `${c.region} · ` : ''}<span className="num">{nf(c.lat, 2)}°Β {nf(c.lon, 2)}°Α</span></div>
        </div>
        <button className="btn ml-auto !px-2.5 !py-1" onClick={onClose} aria-label="Κλείσιμο">✕</button>
      </div>

      <div className={`rounded-lg p-4 ${proj ? 'forecast-badge' : 'bg-panel-2 border border-line'}`}>
        <div className="flex items-center gap-2 text-[12.5px] text-soft">
          {info.label} · {when}
          {proj && <span className="rounded px-1.5 py-px text-[10px] font-semibold border border-accent text-accent-2">ΠΡΟΒΛΕΨΗ</span>}
        </div>
        <div className="num text-[42px] font-semibold leading-none mt-2">
          {nf(data.value, info.digits)}<span className="text-[16px] text-muted font-normal ml-1">{info.unit}</span>
        </div>
        {info.esi && <div className="text-[14px] text-soft mt-1.5">{esiWord(data.value)} συνθήκες</div>}
        {proj && (
          <div className="text-[12.5px] text-soft mt-2 leading-snug">
            SSP2-4.5, διάμεσος {data.n_models} μοντέλων · εύρος <span className="num">{nf(data.p10, 0)}–{nf(data.p90, 0)}</span>
            <br />Αλλαγή από το κλίμα 1995–2014: <span className="num">{signed(data.change, 1)}</span>
          </div>
        )}
      </div>

      {info.esi ? <EsiDetails data={data} year={year} per={per} inSeries={inSeries} /> : <ParamDetails data={data} layer={layer} year={year} month={month} per={per} inSeries={inSeries} />}
    </div>
  )
}

function EsiDetails({ data, year, per, inSeries }: { data: Panel; year: number; per: string; inSeries: boolean }) {
  const f = data.factors
  const clim = (data.seasonal ?? []).map((m) => ({ label: MONTHS[m.month], early: m.early, late: m.late }))
  const [p1, p2] = data.seasonal_periods ?? ['', '']
  return (
    <>
      <Block title="Καταλληλότητα κάθε παράγοντα" sub="0 = καθόλου ευνοϊκός, 1 = ιδανικός">
        <ScoreBars scores={FACTORS.map((x) => ({ label: x.name, value: f ? f[x.score] : null }))} />
      </Block>
      <Block title={`${LAYER_INFO[data.layer].short} ανά έτος`} sub={`${per} · μετρήσεις NASA`}>
        <TimeChart data={data.series} series={[{ key: 'v', name: LAYER_INFO[data.layer].short, color: '#fe9f6d', dot: true, width: 1.6 }]} height={170} digits={1}
          clampY={[0, 100]} refX={inSeries ? { x: year, label: String(year) } : undefined} />
      </Block>
      <Block title="Εποχικός κύκλος" sub={`μέσος όρος κάθε μήνα, ${p1} και ${p2}`}>
        <MonthBars data={clim} keys={[{ key: 'early', name: p1, color: '#5b6b85' }, { key: 'late', name: p2, color: '#fe9f6d' }]} height={170} digits={0} />
      </Block>
    </>
  )
}

function ParamDetails({ data, layer, year, month, per, inSeries }: { data: Panel; layer: string; year: number; month: number; per: string; inSeries: boolean }) {
  const info = LAYER_INFO[layer]
  const t = data.trend
  const rows = t ? trendRows(data.series, t.sen_decade, t.first, t.last) : data.series
  return (
    <>
      {t ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <Cell label="Ανά 5 χρόνια" value={`${signed(t.per5, info.digits + 1)}${info.unit ? ` ${info.unit}` : ''}`} tone={t.significant ? (t.per5 > 0 ? 'text-up' : 'text-down') : ''} />
            <Cell label="p-value" value={pfmt(t.p)} />
            <Cell label="Σημαντική" value={t.significant ? 'Ναι' : 'Όχι'} tone={t.significant ? 'text-ok' : 'text-muted'} />
          </div>
          <div className="text-[12px] text-muted">Τάση {t.first}–{t.last}{month ? `, ${MONTHS_LONG[month]}` : ''} · Mann-Kendall και κλίση Sen · σημαντική όταν p &lt; 0,05</div>
        </div>
      ) : <div className="text-[13px] text-muted">Δεν υπάρχει αρκετή χρονοσειρά για τάση.</div>}
      <Block title={`${info.short} ανά έτος`} sub={`${per} · μετρήσεις NASA${info.unit ? ` · ${info.unit}` : ''}`}>
        <TimeChart data={rows} series={[{ key: 'v', name: info.short, color: '#5aa9e6', dot: true, width: 1.6 }, ...(t ? [{ key: 'trend', name: 'Τάση', color: '#ffcf70', dashed: true, width: 1.6 }] : [])]}
          height={200} digits={info.digits} refX={inSeries ? { x: year, label: String(year) } : undefined} />
      </Block>
    </>
  )
}

function Block({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13.5px] font-semibold">{title}</div>
      {sub && <div className="text-[12px] text-muted mb-2">{sub}</div>}
      {children}
    </div>
  )
}

function Cell({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-panel-2 border border-line px-3 py-2.5">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className={`num text-[15px] sm:text-[17px] font-semibold mt-0.5 whitespace-nowrap ${tone}`}>{value}</div>
    </div>
  )
}
