// Recharts wrappers in the app's dark style.
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { nf } from '../fmt'

const AX = { stroke: '#4a566b', tick: { fill: '#8591a6', fontSize: 11 } }
const TT = { contentStyle: { background: '#111723', border: '1px solid #2e3a50', borderRadius: 6, fontSize: 12 }, labelStyle: { color: '#e6ebf3' } }

export type SeriesDef = { key: string; name: string; color: string; dashed?: boolean; width?: number; dot?: boolean }
export type BandDef = { lo: string; hi: string; color: string; name: string }

// Round axis limits and ticks (1, 2, 2.5 or 5 × 10^k), so the axis reads 14, 15, 16 rather than 13.65, 14.7.
export function niceScale(lo: number, hi: number, n = 5): { domain: [number, number]; ticks: number[]; dec: number } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { domain: [0, 1], ticks: [0, 1], dec: 0 }
  if (lo === hi) { lo -= 1; hi += 1 }
  const raw = (hi - lo) / (n - 1)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = +([1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw * 0.999) ?? 10 * mag).toPrecision(6)
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step
  const ticks: number[] = []
  for (let t = a; t <= b + step / 2; t += step) ticks.push(+t.toPrecision(10))
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks, dec: (String(step).split('.')[1] ?? '').length }
}

export function TimeChart({ data, x = 'year', series, bands = [], height = 260, yLabel, digits = 1, refX, shadeFrom, clampY, refY }:
  { data: Record<string, unknown>[]; x?: string; series: SeriesDef[]; bands?: BandDef[]; height?: number; yLabel?: string; digits?: number
    refX?: { x: number; label: string }; shadeFrom?: number; clampY?: [number, number]; refY?: number }) {
  const rows = data.map((d) => {
    const r: Record<string, unknown> = { ...d }
    for (const b of bands) r[`${b.lo}__band`] = d[b.lo] != null && d[b.hi] != null ? [d[b.lo], d[b.hi]] : null
    return r
  })
  const ys = data.flatMap((d) => [...series.map((s) => d[s.key]), ...bands.flatMap((b) => [d[b.lo], d[b.hi]])]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  let lo = Math.min(...ys), hi = Math.max(...ys)
  if (clampY) { lo = Math.max(clampY[0], lo); hi = Math.min(clampY[1], hi) }
  const sc = niceScale(lo, hi)
  if (clampY) sc.domain = [Math.max(clampY[0], sc.domain[0]), Math.min(clampY[1], sc.domain[1])]
  const ticks = sc.ticks.filter((t) => t >= sc.domain[0] && t <= sc.domain[1])
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1c2433" vertical={false} />
        <XAxis dataKey={x} {...AX} type="number" domain={['dataMin', 'dataMax']} allowDecimals={false} />
        <YAxis {...AX} width={44} domain={sc.domain} ticks={ticks} tickFormatter={(v: number) => nf(v, sc.dec)} allowDataOverflow
          label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: '#8591a6', fontSize: 11 } : undefined} />
        <Tooltip {...TT} formatter={(v: unknown) => (Array.isArray(v) ? `${nf(v[0] as number, digits)} – ${nf(v[1] as number, digits)}` : nf(v as number, digits))} />
        {shadeFrom !== undefined && <ReferenceArea x1={shadeFrom} fill="#f5a524" fillOpacity={0.05} />}
        {refX && <ReferenceLine x={refX.x} stroke="#f5a524" strokeDasharray="4 4" label={{ value: refX.label, fill: '#ffcf70', fontSize: 11, position: 'insideTopRight' }} />}
        {refY !== undefined && <ReferenceLine y={refY} stroke="#4a566b" strokeDasharray="3 3" />}
        {bands.map((b) => <Area key={b.lo} dataKey={`${b.lo}__band`} name={b.name} stroke="none" fill={b.color} fillOpacity={0.22} isAnimationActive={false} connectNulls />)}
        {series.map((s) => <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={s.width ?? 2} dot={s.dot ? { r: 2 } : false} strokeDasharray={s.dashed ? '5 4' : undefined} connectNulls isAnimationActive={false} />)}
        {(series.length > 1 || bands.length > 0) && <Legend wrapperStyle={{ fontSize: 12, color: '#b5bfcf' }} />}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function MonthBars({ data, keys, height = 220, digits = 0, yDomain }: { data: Record<string, unknown>[]; keys: SeriesDef[]; height?: number; digits?: number; yDomain?: [number, number] }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1c2433" vertical={false} />
        <XAxis dataKey="label" {...AX} />
        <YAxis {...AX} width={40} domain={yDomain ?? ['auto', 'auto']} tickFormatter={(v: number) => nf(v, 0)} />
        <Tooltip {...TT} formatter={(v: unknown) => nf(v as number, digits)} />
        {keys.map((k) => <Bar key={k.key} dataKey={k.key} name={k.name} fill={k.color} radius={[2, 2, 0, 0]} isAnimationActive={false} />)}
        {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: '#b5bfcf' }} />}
      </BarChart>
    </ResponsiveContainer>
  )
}

// One bar per factor, 0–1. The track is lighter than the card so a low value still reads as a bar.
export function ScoreBars({ scores }: { scores: { label: string; value: number | null }[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {scores.map((s) => (
        <div key={s.label} className="grid grid-cols-[104px_1fr_40px] items-center gap-3 text-[13px]">
          <span className="text-soft">{s.label}</span>
          <div className="h-2 rounded bg-line-2 overflow-hidden"><div className="h-full rounded bg-[#fe9f6d]" style={{ width: `${Math.max(0, Math.min(1, s.value ?? 0)) * 100}%` }} /></div>
          <span className="num text-right">{nf(s.value, 2)}</span>
        </div>
      ))}
    </div>
  )
}
