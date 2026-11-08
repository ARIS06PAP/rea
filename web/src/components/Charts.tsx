// Recharts wrappers in the app's dark style.
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { nf } from '../fmt'

const AX = { stroke: '#4a566b', tick: { fill: '#8591a6', fontSize: 11 } }
const TT = { contentStyle: { background: '#111723', border: '1px solid #2e3a50', borderRadius: 6, fontSize: 12 }, labelStyle: { color: '#e6ebf3' } }

export type SeriesDef = { key: string; name: string; color: string; dashed?: boolean; width?: number; dot?: boolean }
export type BandDef = { lo: string; hi: string; color: string; name: string }

export function TimeChart({ data, x = 'year', series, bands = [], height = 260, yLabel, digits = 1, refX, shadeFrom, yDomain, refY }:
  { data: Record<string, unknown>[]; x?: string; series: SeriesDef[]; bands?: BandDef[]; height?: number; yLabel?: string; digits?: number
    refX?: { x: number; label: string }; shadeFrom?: number; yDomain?: [number | 'auto', number | 'auto']; refY?: number }) {
  const rows = data.map((d) => {
    const r: Record<string, unknown> = { ...d }
    for (const b of bands) r[`${b.lo}__band`] = d[b.lo] != null && d[b.hi] != null ? [d[b.lo], d[b.hi]] : null
    return r
  })
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1c2433" vertical={false} />
        <XAxis dataKey={x} {...AX} type="number" domain={['dataMin', 'dataMax']} allowDecimals={false} />
        <YAxis {...AX} width={44} domain={yDomain ?? ['auto', 'auto']} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: '#8591a6', fontSize: 11 } : undefined} />
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
        <YAxis {...AX} width={40} domain={yDomain ?? ['auto', 'auto']} />
        <Tooltip {...TT} formatter={(v: unknown) => nf(v as number, digits)} />
        {keys.map((k) => <Bar key={k.key} dataKey={k.key} name={k.name} fill={k.color} radius={[2, 2, 0, 0]} isAnimationActive={false} />)}
        {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: '#b5bfcf' }} />}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ScoreBars({ scores }: { scores: { label: string; value: number | null; weight: number }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {scores.map((s) => (
        <div key={s.label} className="grid grid-cols-[120px_1fr_44px] items-center gap-2 text-[12.5px]">
          <span className="text-soft">{s.label} <span className="text-muted num">·{nf(s.weight * 100, 0)}%</span></span>
          <div className="h-2 rounded bg-panel-2 overflow-hidden"><div className="h-full rounded" style={{ width: `${Math.max(0, Math.min(1, s.value ?? 0)) * 100}%`, background: 'linear-gradient(90deg,#8c2981,#fe9f6d)' }} /></div>
          <span className="num text-right">{nf(s.value, 2)}</span>
        </div>
      ))}
    </div>
  )
}
