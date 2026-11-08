// The card of one region on the map. ESI: the value at the chosen time, the five parameters with their
// suitability (0–1), the ESI over the years and the seasonal cycle. A parameter: its value, the change per
// five years with the p-value, and the parameter over the years with its trend line. Every chart goes on
// to 2050 with the SSP2-4.5 projection (median of 8 models, 10–90% range).
import { useApi, type Panel, type Place } from '../api'
import { MonthBars, TimeChart } from './Charts'
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
            SSP2-4.5, διάμεσος 8 μοντέλων · εύρος <span className="num">{nf(data.p10, info.digits)}–{nf(data.p90, info.digits)}</span>
            {data.change !== undefined && data.change !== null && <><br />Αλλαγή από το κλίμα 1995–2014: <span className="num">{signed(data.change, 1)}</span></>}
          </div>
        )}
      </div>

      {info.esi ? <EsiDetails data={data} year={year} per={per} proj={proj} /> : <ParamDetails data={data} layer={layer} year={year} month={month} per={per} />}
    </div>
  )
}

// Observed series + projection (dashed, with the models' 10–90% band) in one chart.
function rowsWithProjection(data: Panel, extra?: (rows: Record<string, unknown>[]) => Record<string, unknown>[]) {
  const obs: Record<string, unknown>[] = extra ? extra(data.series.map((p) => ({ ...p }))) : data.series.map((p) => ({ ...p }))
  return [...obs, ...data.projection.map((p) => ({ year: p.year, p: p.v, lo: p.p10, hi: p.p90 }))]
}

const FIELD_FMT: Record<string, [number, string]> = { T2M: [1, ' °C'], PRECIP: [0, ' mm'], WS10M: [1, ' m/s'], RH2M: [0, '%'], NDVI: [2, ''] }

function EsiDetails({ data, year, per, proj }: { data: Panel; year: number; per: string; proj: boolean }) {
  const f = data.factors
  const clim = (data.seasonal ?? []).map((m) => ({ label: MONTHS[m.month], early: m.early, late: m.late }))
  const [p1, p2] = data.seasonal_periods ?? ['', '']
  const rows = rowsWithProjection(data)
  const first = data.projection[0]?.year
  return (
    <>
      <Block title={proj ? 'Πρόβλεψη κάθε παράγοντα' : 'Οι πέντε παράγοντες'} sub="τιμή και καταλληλότητα (0 = καθόλου ευνοϊκή, 1 = ιδανική)">
        <div className="flex flex-col gap-2.5">
          {FACTORS.map((x) => {
            const v = data.fields?.[x.layer] ?? null
            const s = f ? f[x.score] : null
            const [d, u] = FIELD_FMT[x.layer]
            return (
              <div key={x.key} className="grid grid-cols-[88px_66px_1fr_34px] items-center gap-2 text-[13px]">
                <span className="text-soft">{x.name}</span>
                <span className="num text-[12px] text-fg text-right">{v === null ? '—' : `${nf(v, d)}${u}`}</span>
                <div className="h-2 rounded bg-line-2 overflow-hidden"><div className="h-full rounded bg-[#fe9f6d]" style={{ width: `${Math.max(0, Math.min(1, s ?? 0)) * 100}%` }} /></div>
                <span className="num text-right">{nf(s, 2)}</span>
              </div>
            )
          })}
        </div>
        {proj && <div className="text-[12px] text-muted mt-2">Ο ESI βγαίνει από αυτές τις προβλέψεις με τον τύπο της Επισκόπησης, για κάθε μοντέλο· δείχνεται η διάμεσος των 8.</div>}
      </Block>
      <Block title={`${LAYER_INFO[data.layer].short} ανά έτος, ως το 2050`} sub={`${per} · μετρήσεις NASA, μετά πρόβλεψη SSP2-4.5`}>
        <TimeChart data={rows} height={190} digits={1} clampY={[0, 100]}
          series={[{ key: 'v', name: 'Μετρήσεις', color: '#fe9f6d', dot: true, width: 1.6 }, { key: 'p', name: 'Πρόβλεψη', color: '#5aa9e6', dashed: true, width: 1.8 }]}
          bands={[{ lo: 'lo', hi: 'hi', color: '#5aa9e6', name: 'εύρος μοντέλων' }]} shadeFrom={first}
          refX={{ x: year, label: String(year) }} />
      </Block>
      <Block title="Εποχικός κύκλος" sub={`μέσος όρος κάθε μήνα, ${p1} και ${p2}`}>
        <MonthBars data={clim} keys={[{ key: 'early', name: p1, color: '#5b6b85' }, { key: 'late', name: p2, color: '#fe9f6d' }]} height={170} digits={0} />
      </Block>
    </>
  )
}

function ParamDetails({ data, layer, year, month, per }: { data: Panel; layer: string; year: number; month: number; per: string }) {
  const info = LAYER_INFO[layer]
  const t = data.trend
  const rows = rowsWithProjection(data, (obs) => (t ? trendRows(obs as { year: number; v: number | null }[], t.sen_decade, t.first, t.last) : obs))
  const first = data.projection[0]?.year
  return (
    <>
      {t ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <Cell label="Ανά 5 χρόνια" value={`${signed(t.per5, info.digits + 1)}${info.unit ? ` ${info.unit}` : ''}`} tone={t.significant ? (t.per5 > 0 ? 'text-up' : 'text-down') : ''} />
            <Cell label="p-value" value={pfmt(t.p)} />
            <Cell label="Σημαντική" value={t.significant ? 'Ναι' : 'Όχι'} tone={t.significant ? 'text-ok' : 'text-muted'} />
          </div>
          <div className="text-[12px] text-muted">Τάση των μετρήσεων {t.first}–{t.last}{month ? `, ${MONTHS_LONG[month]}` : ''} · Mann-Kendall και κλίση Sen · σημαντική όταν p &lt; 0,05</div>
        </div>
      ) : <div className="text-[13px] text-muted">Δεν υπάρχει αρκετή χρονοσειρά για τάση.</div>}
      <Block title={`${info.short} ανά έτος, ως το 2050`} sub={`${per} · μετρήσεις NASA, μετά πρόβλεψη SSP2-4.5${layer === 'NDVI' ? ' (προέκταση της τάσης)' : ''}${info.unit ? ` · ${info.unit}` : ''}`}>
        <TimeChart data={rows} height={210} digits={info.digits}
          series={[{ key: 'v', name: 'Μετρήσεις', color: '#5aa9e6', dot: true, width: 1.6 }, ...(t ? [{ key: 'trend', name: 'Τάση', color: '#ffcf70', dashed: true, width: 1.4 }] : []),
            { key: 'p', name: 'Πρόβλεψη', color: '#fe9f6d', dashed: true, width: 1.8 }]}
          bands={[{ lo: 'lo', hi: 'hi', color: '#fe9f6d', name: 'εύρος μοντέλων' }]} shadeFrom={first}
          refX={{ x: year, label: String(year) }} />
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
