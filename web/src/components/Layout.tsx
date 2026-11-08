import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { useApi, type Meta } from '../api'
import { MONTHS_LONG } from '../fmt'

const NAV = [['/', 'Επισκόπηση'], ['/map', 'Χάρτης'], ['/results', 'Αποτελέσματα']] as const

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <radialGradient id="rea-planet" cx=".35" cy=".35" r=".75">
          <stop offset="0" stopColor="#a9d6ff" /><stop offset=".55" stopColor="#22528f" /><stop offset="1" stopColor="#0a1a33" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="7.5" fill="url(#rea-planet)" />
      <ellipse cx="16" cy="16" rx="14" ry="5" transform="rotate(-24 16 16)" fill="none" stroke="#6fb7ff" strokeOpacity=".75" strokeWidth="1" />
      <circle cx="28.2" cy="10.9" r="1.6" fill="#e6ecf5" />
    </svg>
  )
}

export default function Layout() {
  const { data: meta } = useApi<Meta>('/api/meta')
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 h-14 flex items-center gap-8">
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0" aria-label="Mosquito Track, επισκόπηση">
            <Logo />
            <div className="leading-tight">
              <div className="font-bold tracking-tight text-[16px]">Mosquito Track</div>
              <div className="text-[10.5px] text-muted">Κουνούπι τίγρη · Ελλάδα</div>
            </div>
          </NavLink>
          <nav className="hidden md:flex items-stretch gap-7 h-full text-[14.5px]" aria-label="Κύρια πλοήγηση">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex items-center border-b-2 pt-0.5 transition ${isActive ? 'text-fg border-accent' : 'text-muted border-transparent hover:text-fg'}`}>{label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden lg:block text-[11.5px] text-muted text-right">
            {meta && <>Δεδομένα ως: <span className="text-soft">{MONTHS_LONG[meta.last_month.month]} {meta.last_month.year}</span></>}
          </div>
          <button className="md:hidden btn ml-auto" onClick={() => setOpen(!open)} aria-label="Μενού">☰</button>
        </div>
        {open && (
          <nav className="md:hidden border-t border-line px-4 py-2 flex flex-col">
            {NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `py-2 ${isActive ? 'text-accent' : 'text-soft'}`}>{label}</NavLink>)}
          </nav>
        )}
      </header>
      <main className="flex-1 mx-auto w-full max-w-[1400px] px-4 py-6"><Outlet /></main>
      <footer className="border-t border-line text-[11.5px] text-muted">
        <div className="mx-auto max-w-[1400px] px-4 py-4 flex flex-wrap gap-x-6 gap-y-1">
          <span><b className="text-soft">Mosquito Track</b> · NASA Space Apps 2026</span>
          <span>Δεδομένα: NASA POWER · MODIS · NEX-GDDP-CMIP6</span>
          <span>Δείχνει καταλληλότητα, όχι κουνούπια ή κρούσματα.</span>
        </div>
      </footer>
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

export function Loading({ what = 'δεδομένα' }: { what?: string }) {
  return <div className="text-muted text-sm py-10 text-center">Φόρτωση {what}…</div>
}

export function ErrorBox({ error }: { error: string }) {
  return <div className="card p-4 text-sm text-up">Σφάλμα: {error}. Τρέχει το API; (uvicorn api.main:app --port 8010)</div>
}
