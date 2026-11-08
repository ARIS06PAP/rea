import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { useApi, type Meta } from '../api'
import { MONTHS_LONG } from '../fmt'

const NAV = [
  ['/', 'Επισκόπηση'], ['/map', 'Χάρτης'], ['/parameters', 'Παράμετροι'], ['/history', 'Ιστορική εξέλιξη'],
  ['/future', 'Προβλέψεις 2050'], ['/validation', 'Αφθονία & επικύρωση'], ['/science', 'Τεκμηρίωση'],
] as const

export default function Layout() {
  const { data: meta } = useApi<Meta>('/api/meta')
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 h-14 flex items-center gap-6">
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden><circle cx="16" cy="16" r="14" fill="none" stroke="#f5a524" strokeWidth="2" /><path d="M9 16h14M16 9v14" stroke="#f5a524" strokeWidth="2" /><circle cx="16" cy="16" r="4" fill="#f5a524" /></svg>
            <div className="leading-tight">
              <div className="font-semibold tracking-wide text-[15px]">TigerWatch <span className="text-muted font-normal">Ελλάδα</span></div>
              <div className="text-[10.5px] text-muted">Aedes albopictus · NASA data</div>
            </div>
          </NavLink>
          <nav className="hidden lg:flex items-center gap-1 text-[13.5px]">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `px-3 py-1.5 rounded-md transition ${isActive ? 'text-fg bg-panel-2' : 'text-muted hover:text-fg'}`}>{label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden md:block text-[11.5px] text-muted text-right">
            {meta && <>Τελευταίος μήνας δεδομένων: <span className="text-soft">{MONTHS_LONG[meta.last_month.month]} {meta.last_month.year}</span></>}
          </div>
          <button className="lg:hidden btn" onClick={() => setOpen(!open)} aria-label="Μενού">☰</button>
        </div>
        {open && (
          <nav className="lg:hidden border-t border-line px-4 py-2 flex flex-col">
            {NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `py-2 ${isActive ? 'text-accent' : 'text-soft'}`}>{label}</NavLink>)}
          </nav>
        )}
      </header>
      <main className="flex-1 mx-auto w-full max-w-[1400px] px-4 py-6"><Outlet /></main>
      <footer className="border-t border-line text-[11.5px] text-muted">
        <div className="mx-auto max-w-[1400px] px-4 py-4 flex flex-wrap gap-x-6 gap-y-1">
          <span>Δεδομένα: NASA POWER (MERRA-2) · NASA MODIS MOD13A3 · NASA NEX-GDDP-CMIP6 · GBIF · LIFE CONOPS (Zenodo) · Ecodevelopment (Mendeley Data)</span>
          <span>Ο δείκτης δείχνει περιβαλλοντική καταλληλότητα, όχι αριθμό κουνουπιών ή κρούσματα.</span>
        </div>
      </footer>
    </div>
  )
}

export function Page({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="text-2xl md:text-[28px] font-semibold mt-1 tracking-tight">{title}</h1>
        {lead && <p className="text-soft mt-2 max-w-3xl leading-relaxed text-[14.5px]">{lead}</p>}
      </div>
      {children}
    </div>
  )
}

export function Card({ title, sub, children, className = '', right }: { title?: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <section className={`card p-4 ${className}`}>
      {(title || right) && (
        <div className="flex items-start gap-3 mb-3">
          <div>
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {sub && <div className="text-[12.5px] text-muted mt-0.5">{sub}</div>}
          </div>
          {right && <div className="ml-auto">{right}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, unit, note, tone }: { label: string; value: string; unit?: string; note?: React.ReactNode; tone?: 'up' | 'down' | 'none' }) {
  const color = tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-fg'
  return (
    <div className="card p-4">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`num text-[28px] font-semibold mt-1 ${color}`}>{value}{unit && <span className="text-[14px] text-muted font-normal ml-1">{unit}</span>}</div>
      {note && <div className="text-[12px] text-soft mt-1 leading-snug">{note}</div>}
    </div>
  )
}

export function Loading({ what = 'δεδομένα' }: { what?: string }) {
  return <div className="text-muted text-sm py-10 text-center">Φόρτωση {what}…</div>
}

export function ErrorBox({ error }: { error: string }) {
  return <div className="card p-4 text-sm text-up">Σφάλμα: {error}. Τρέχει το API; (uvicorn api.main:app --port 8010)</div>
}

export function ForecastNote({ children }: { children?: React.ReactNode }) {
  return (
    <div className="forecast-badge rounded-md px-3 py-2 text-[12.5px] leading-relaxed">
      <b>Πρόβλεψη, όχι μέτρηση.</b> {children ?? 'Οι μελλοντικές τιμές προκύπτουν από 8 κλιματικά μοντέλα CMIP6 (NASA NEX-GDDP) με τη μέθοδο delta πάνω στο παρατηρημένο κλίμα της NASA POWER. Δείχνεται η διάμεσος των μοντέλων και το εύρος τους.'}
    </div>
  )
}
