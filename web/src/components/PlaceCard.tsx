// The short card of one place (map click): one sentence and one big number first, then a few plain
// facts, a link to the comparison, and everything else folded under «Περισσότερα».
import { Link } from 'react-router-dom'
import { useApi, type Meta, type Place, type Summary } from '../api'
import { esiWord, monthRange, nf, pctWord, signed } from '../fmt'
import CellPanel from './CellPanel'

export default function PlaceCard({ cell, meta, places, onClose }: { cell: string; meta: Meta; places: Place[]; onClose: () => void }) {
  const { data: s, error } = useApi<Summary>(`/api/summary/${cell}`)
  if (error) return <div className="text-sm text-up">{error}</div>
  if (!s) return <div className="text-sm text-muted py-6">Φόρτωση…</div>
  const city = places.find((p) => p.cell === cell)
  const key = city?.name ?? cell
  const t = s.trend
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div>
          <div className="text-[19px] font-semibold leading-tight">{city ? city.name : `Περιοχή ${s.cell.region}`}</div>
          <div className="text-[12.5px] text-muted">{city ? `${s.cell.region} · ` : ''}κελί NASA περίπου 55 × 55 km</div>
        </div>
        <button className="btn ml-auto !px-2.5" onClick={onClose} aria-label="Κλείσιμο">✕</button>
      </div>
      <div>
        <div className="num text-[44px] font-semibold leading-none">{nf(s.esi_now, 0)}<span className="text-[15px] text-muted font-normal">/100</span></div>
        <div className="text-[14px] text-soft mt-1.5">{esiWord(s.esi_now)} συνθήκες σήμερα ({s.period_now}), {pctWord(s.percentile)}.</div>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2.5 text-[13.5px] border-t border-line pt-3">
        <dt className="text-muted">Ευνοϊκοί μήνες</dt>
        <dd className="text-right"><b className="num">{s.season.now.n}</b> <span className="text-soft">({monthRange(s.season.now.months)})</span></dd>
        <dt className="text-muted">Τάση από το 2001</dt>
        <dd className="text-right">{t?.significant ? <b className={`num ${t.sen_decade > 0 ? 'text-up' : 'text-down'}`}>{signed(t.sen_decade, 1)} /10 χρόνια</b> : <span className="text-soft">χωρίς σίγουρη τάση</span>}</dd>
        <dt className="text-muted">Ως το 2041–2050 <span className="text-[11px]">(πρόβλεψη)</span></dt>
        <dd className="text-right num">{signed(s.proj.ssp245.change, 1)} έως {signed(s.proj.ssp585.change, 1)}</dd>
        <dt className="text-muted">Χειμώνας / καλοκαίρι</dt>
        <dd className="text-right num">{nf(s.climate.t_jan, 1)} / {nf(s.climate.t_jul, 1)} °C</dd>
      </dl>
      <Link to={`/compare?a=${encodeURIComponent(key)}&b=${encodeURIComponent(key === 'Αθήνα' ? 'Θεσσαλονίκη' : 'Αθήνα')}`} className="btn on text-center !py-2">Σύγκρινε με άλλη πόλη →</Link>
      <details className="group">
        <summary className="cursor-pointer text-[13.5px] text-soft hover:text-fg select-none">Περισσότερα: παράγοντες, ιστορικό, τάσεις</summary>
        <div className="mt-3"><CellPanel id={cell} meta={meta} bare /></div>
      </details>
    </div>
  )
}
