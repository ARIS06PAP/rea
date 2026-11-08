// City picker (typed, with suggestions) and the resolver that turns a URL key — a city name or a
// grid-cell id from a map click — into a place with its cell.
import { useEffect, useId, useState } from 'react'
import type { Cell, Place } from '../api'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export type ResolvedPlace = { key: string; name: string; cell: string; region: string; city: boolean }

export function resolvePlace(key: string, places?: Place[] | null, cells?: Cell[] | null): ResolvedPlace | null {
  if (!places || !cells) return null
  const p = places.find((x) => norm(x.name) === norm(key))
  if (p) return { key: p.name, name: p.name, cell: p.cell, region: p.region, city: true }
  const c = cells.find((x) => x.cell === key)
  if (c) return { key: c.cell, name: `Περιοχή ${c.region}`, cell: c.cell, region: c.region, city: false }
  return null
}

// The city that stands for a map cell, if there is one; otherwise the cell id itself.
export function keyForCell(cell: string, places?: Place[] | null): string {
  return places?.find((p) => p.cell === cell)?.name ?? cell
}

export default function PlacePicker({ places, value, onChange, label, color }:
  { places: Place[]; value: ResolvedPlace | null; onChange: (key: string) => void; label: string; color: string }) {
  const id = useId()
  const shown = value?.name ?? ''
  const [text, setText] = useState(shown)
  useEffect(() => setText(shown), [shown])
  const commit = (t: string) => {
    const p = places.find((x) => norm(x.name) === norm(t))
    if (p) onChange(p.name)
    else setText(shown)
  }
  return (
    <label className="flex flex-col gap-1.5 grow min-w-[210px]">
      <span className="flex items-center gap-2 text-[11.5px] uppercase tracking-wider text-muted">
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />{label}
      </span>
      <input list={id} value={text} placeholder="Γράψε μια πόλη…" autoComplete="off"
        className="sel !text-[16px] !py-2.5 !px-3 font-medium" style={{ borderColor: color }}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => { setText(e.target.value); const p = places.find((x) => x.name === e.target.value); if (p) onChange(p.name) }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value) }} />
      <datalist id={id}>{places.map((p) => <option key={p.name} value={p.name} />)}</datalist>
    </label>
  )
}
