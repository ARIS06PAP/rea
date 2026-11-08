import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useApi, type Meta } from '../api'
import { monthsLong } from '../fmt'
import { setLang, useLang, useT } from '../i18n'

// The R.E.A. logo: mosquito over a globe (light version for the dark UI, made by web/scripts/logo_dark.py).
export function Logo({ size = 34 }: { size?: number }) {
  return <img src="/rea-icon-dark.png" alt="" width={Math.round((size * 107) / 115)} height={size} className="shrink-0" />
}

function LangSwitch() {
  const lang = useLang()
  return (
    <div className="flex rounded-md border border-line-2 overflow-hidden text-[12px] font-semibold shrink-0" role="group" aria-label="Language">
      {(['en', 'el'] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`px-2.5 py-1 transition ${lang === l ? 'bg-accent text-ink' : 'text-muted hover:text-fg'}`}>{l.toUpperCase()}</button>
      ))}
    </div>
  )
}

export default function Layout() {
  const { data: meta } = useApi<Meta>('/api/meta')
  const [open, setOpen] = useState(false)
  const t = useT()
  const lang = useLang()
  useEffect(() => {
    document.title = lang === 'en' ? 'Mosquito Track · The tiger mosquito in Greece' : 'Mosquito Track · Το κουνούπι τίγρη στην Ελλάδα'
  }, [lang])
  const NAV = [['/', t('Επισκόπηση', 'Overview')], ['/map', t('Χάρτης', 'Map')], ['/results', t('Αποτελέσματα', 'Results')]] as const
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 h-14 flex items-center gap-8">
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0" aria-label="Mosquito Track">
            <Logo />
            <div className="leading-tight">
              <div className="font-bold tracking-tight text-[16px]">Mosquito Track</div>
              <div className="text-[10.5px] text-muted">{t('Κουνούπι τίγρη · Ελλάδα', 'Tiger mosquito · Greece')}</div>
            </div>
          </NavLink>
          <nav className="hidden md:flex items-stretch gap-7 h-full text-[14.5px]" aria-label={t('Κύρια πλοήγηση', 'Main navigation')}>
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex items-center border-b-2 pt-0.5 transition ${isActive ? 'text-fg border-accent' : 'text-muted border-transparent hover:text-fg'}`}>{label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden lg:block text-[11.5px] text-muted text-right">
            {meta && <>{t('Δεδομένα ως', 'Data up to')}: <span className="text-soft">{monthsLong()[meta.last_month.month]} {meta.last_month.year}</span></>}
          </div>
          <div className="ml-auto lg:ml-0 flex items-center gap-2">
            <LangSwitch />
            <button className="md:hidden btn" onClick={() => setOpen(!open)} aria-label={t('Μενού', 'Menu')}>☰</button>
          </div>
        </div>
        {open && (
          <nav className="md:hidden border-t border-line px-4 py-2 flex flex-col">
            {NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `py-2 ${isActive ? 'text-accent' : 'text-soft'}`}>{label}</NavLink>)}
          </nav>
        )}
      </header>
      <main className="flex-1 mx-auto w-full max-w-[1400px] px-4 py-6"><Outlet /></main>
      <footer className="border-t border-line text-[11.5px] text-muted">
        <div className="mx-auto max-w-[1400px] px-4 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span><b className="text-soft">Mosquito Track</b> · NASA Space Apps 2026</span>
          <span>{t('Δεδομένα', 'Data')}: NASA POWER · MODIS · NEX-GDDP-CMIP6</span>
          <span>{t('Δείχνει καταλληλότητα, όχι κουνούπια ή κρούσματα.', 'Shows suitability, not mosquitoes or disease cases.')}</span>
          <img src="/rea-logo-dark.png" alt="R.E.A." width={73} height={28} className="ml-auto" />
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

export function Loading() {
  const t = useT()
  return <div className="text-muted text-sm py-10 text-center">{t('Φόρτωση…', 'Loading…')}</div>
}

export function ErrorBox({ error }: { error: string }) {
  const t = useT()
  return <div className="card p-4 text-sm text-up">{t('Σφάλμα', 'Error')}: {error}</div>
}
