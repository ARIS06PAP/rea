// Everything about one grid cell: where it is, its ESI and the five factors, history, trends, projections.
import { useApi, type Meta } from '../api'
import { LAYER_INFO, MONTHS, esiWord, nf, pfmt, signed } from '../fmt'
import { MonthBars, ScoreBars, TimeChart } from './Charts'

type CellResp = {
  cell: { cell: string; lat: number; lon: number; region: string; island: boolean; coastal: boolean; north: boolean; urban_class: string; urban_share: number; elev_m: number; elev_class: string }
  annual: Record<string, number | boolean | null>[]
  trends: { var: string; n: number; first: number; last: number; sen_decade: number; ci_lo: number; ci_hi: number; p_mk: number; ols_decade: number; p_ols: number; sig_fdr: boolean }[]
  seasonal_trends: { var: string; seasonal_sen_decade: number; p_seasonal: number; sig_fdr: boolean }[]
  climatology: Record<string, number | null>[]
  projections: { scenario: string; year: number; ESI_med: number; ESI_p10: number; ESI_p90: number }[]
  snapshots: { scenario: string; snapshot: number; ESI: number; ESI_p10: number; ESI_p90: number; dESI: number; agree_up: number; base: number }[]
  baseline: { ESI: number } | null
  gbif: { n: number; first_year: number | null } | null
}

export const cellName = (c: { lat: number; lon: number; region: string }) => `${c.region} · ${nf(c.lat, 2)}°Β ${nf(c.lon, 2)}°Α`

export default function CellPanel({ id, meta, onClose }: { id: string; meta: Meta; onClose?: () => void }) {
  const { data, error } = useApi<CellResp>(`/api/cell/${id}`)
  if (error) return <div className="text-sm text-up">{error}</div>
  if (!data) return <div className="text-sm text-muted py-6">Φόρτωση κελιού…</div>
  const c = data.cell
  const ly = meta.last_complete_year
  const recent = data.annual.filter((a) => (a.year as number) >= ly - 4 && (a.year as number) <= ly && a.ESI != null)
  const esiNow = recent.length ? recent.reduce((s, a) => s + (a.ESI as number), 0) / recent.length : null
  const w = meta.weights.main
  const sc = (k: string) => data.climatology.reduce((s, m) => s + ((m[k] as number) ?? 0), 0) / 12
  const scores = [
    { label: 'Θερμοκρασία', value: sc('sT'), weight: w.T }, { label: 'Βροχή 35 ημ.', value: sc('sP'), weight: w.P },
    { label: 'Υγρασία', value: sc('sRH'), weight: w.RH }, { label: 'Άνεμος', value: sc('sW'), weight: w.W }, { label: 'Βλάστηση', value: sc('sNDVI'), weight: w.NDVI },
  ]
  const tr = (v: string) => data.trends.find((t) => t.var === v)
  const proj = Array.from(new Set(data.projections.map((p) => p.year))).map((y) => {
    const a = data.projections.find((p) => p.year === y && p.scenario === 'ssp245')
    const b = data.projections.find((p) => p.year === y && p.scenario === 'ssp585')
    return { year: y, s245: a?.ESI_med, s245lo: a?.ESI_p10, s245hi: a?.ESI_p90, s585: b?.ESI_med }
  })
  const hist = data.annual.filter((a) => a.ESI != null).map((a) => ({ year: a.year, ESI: a.ESI, ESI_eq: a.ESI_eq }))
  const clim = data.climatology.map((m) => ({ label: MONTHS[m.month as number], early: m.esi_2001_2010, late: m.esi_2016_2025 }))
  const snap = (s: string) => data.snapshots.find((x) => x.scenario === s && x.snapshot === 2050)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div>
          <div className="eyebrow">Επιλεγμένο κελί</div>
          <div className="text-lg font-semibold mt-0.5">{c.region}</div>
          <div className="text-[12px] text-muted num">{nf(c.lat, 2)}°Β {nf(c.lon, 3)}°Α · 0,5° × 0,625°</div>
        </div>
        {onClose && <button className="btn ml-auto" onClick={onClose}>Κλείσιμο</button>}
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11.5px]">
        {[c.north ? 'Βόρεια Ελλάδα' : 'Νότια Ελλάδα', c.island ? 'Νησιωτική' : 'Ηπειρωτική', c.coastal ? 'Παράκτια' : 'Εσωτερική', c.urban_class, `υψόμετρο ${c.elev_class}`].map((t) => <span key={t} className="tag">{t}</span>)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3">
          <div className="text-[11.5px] text-muted">ESI {ly - 4}–{ly}</div>
          <div className="num text-2xl font-semibold">{nf(esiNow, 0)}<span className="text-sm text-muted">/100</span></div>
          <div className="text-[12px] text-soft">{esiWord(esiNow)} συνθήκες</div>
        </div>
        <div className="card p-3">
          <div className="text-[11.5px] text-muted">Τάση ESI 2001–{ly}</div>
          <div className={`num text-2xl font-semibold ${tr('ESI')?.sig_fdr ? (tr('ESI')!.sen_decade > 0 ? 'text-up' : 'text-down') : ''}`}>{signed(tr('ESI')?.sen_decade, 1)}</div>
          <div className="text-[12px] text-soft">ανά δεκαετία · {tr('ESI')?.sig_fdr ? 'σίγουρη (FDR)' : 'όχι σίγουρη'}</div>
        </div>
      </div>
      <div>
        <div className="text-[12.5px] text-muted mb-2">Καταλληλότητα κάθε παράγοντα (0–1, μέσος όρος μηνών 2016–2025) και βάρος στον ESI</div>
        <ScoreBars scores={scores} />
      </div>
      <div>
        <div className="text-[12.5px] text-muted mb-1">ESI ανά έτος (μετρήσεις)</div>
        <TimeChart data={hist} series={[{ key: 'ESI', name: 'ESI', color: '#fe9f6d' }, { key: 'ESI_eq', name: 'ESI ίσα βάρη', color: '#8591a6', dashed: true, width: 1.4 }]} height={170} digits={1} />
      </div>
      <div>
        <div className="text-[12.5px] text-muted mb-1">Εποχικός κύκλος του ESI: 2001–2010 έναντι 2016–2025</div>
        <MonthBars data={clim} keys={[{ key: 'early', name: '2001–2010', color: '#4a566b' }, { key: 'late', name: '2016–2025', color: '#de4968' }]} height={170} />
      </div>
      <div>
        <div className="text-[12.5px] text-muted mb-1">Πρόβλεψη ESI έως 2050 (διάμεσος 8 μοντέλων, εύρος 10–90% για SSP2-4.5)</div>
        <TimeChart data={proj} series={[{ key: 's245', name: 'SSP2-4.5', color: '#5aa9e6' }, { key: 's585', name: 'SSP5-8.5', color: '#f0704a' }]} bands={[{ lo: 's245lo', hi: 's245hi', color: '#5aa9e6', name: 'εύρος SSP2-4.5' }]} height={170} digits={1} refY={data.baseline?.ESI} />
        <div className="text-[12px] text-soft mt-1">
          Αναφορά (κλίμα 1995–2014): <span className="num">{nf(data.baseline?.ESI, 1)}</span> · 2041–2050: SSP2-4.5 <span className="num">{signed(snap('ssp245')?.dESI, 1)}</span>, SSP5-8.5 <span className="num">{signed(snap('ssp585')?.dESI, 1)}</span>
          {snap('ssp585') && <> · συμφωνία μοντέλων για άνοδο <span className="num">{nf((snap('ssp585')!.agree_up ?? 0) * 100, 0)}%</span></>}
        </div>
      </div>
      <div>
        <div className="text-[12.5px] text-muted mb-1">Τάσεις των παραμέτρων (Mann-Kendall με διόρθωση Hamed-Rao, κλίση Sen, Benjamini-Hochberg)</div>
        <table className="tbl">
          <thead><tr><th>Μεταβλητή</th><th>Περίοδος</th><th>Sen /10 έτη</th><th>p</th><th>Σίγουρη</th></tr></thead>
          <tbody>
            {['T2M', 'PRECIP', 'RH2M', 'WS10M', 'NDVI', 'ESI'].map((v) => {
              const t = tr(v)
              return t ? (
                <tr key={v}><td>{LAYER_INFO[v].short}</td><td className="num">{t.first}–{t.last}</td>
                  <td className="num">{signed(t.sen_decade, LAYER_INFO[v].digits + 1)} {LAYER_INFO[v].unit}</td><td className="num">{pfmt(t.p_mk)}</td><td>{t.sig_fdr ? 'ναι' : 'όχι'}</td></tr>
              ) : null
            })}
          </tbody>
        </table>
      </div>
      {data.gbif && <div className="text-[12.5px] text-soft">Καταγραφές του κουνουπιού τίγρη (GBIF) σε αυτό το κελί: <span className="num">{data.gbif.n}</span>{data.gbif.first_year ? ` · πρώτη το ${data.gbif.first_year}` : ''}</div>}
    </div>
  )
}
