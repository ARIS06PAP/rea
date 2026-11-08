// Greek number/month formatting and the colour scales of the maps.
export const nf = (x: number | null | undefined, d = 1) =>
  x === null || x === undefined || Number.isNaN(x) ? '—' : x.toLocaleString('el-GR', { maximumFractionDigits: d, minimumFractionDigits: d })
export const signed = (x: number | null | undefined, d = 1) =>
  x === null || x === undefined || Number.isNaN(x) ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '') + nf(Math.abs(x), d)
export const pfmt = (p: number | null | undefined) =>
  p === null || p === undefined ? '—' : p < 0.001 ? '< 0,001' : nf(p, 3)
export const MONTHS = ['Ετήσιο', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ']
export const MONTHS_LONG = ['Όλο το έτος', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος']

export const LAYER_INFO: Record<string, { label: string; short: string; unit: string; digits: number; palette: string[]; domain?: [number, number] }> = {
  ESI: { label: 'Καταλληλότητα (ESI)', short: 'Καταλληλότητα', unit: '/100', digits: 0, palette: ['#1b1036', '#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf'], domain: [0, 80] },
  ESI_eq: { label: 'Καταλληλότητα με ίσα βάρη', short: 'Ίσα βάρη', unit: '/100', digits: 0, palette: ['#1b1036', '#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf'], domain: [0, 80] },
  T2M: { label: 'Θερμοκρασία αέρα (T2M)', short: 'Θερμοκρασία', unit: '°C', digits: 1, palette: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'] },
  PRECIP: { label: 'Βροχόπτωση (PRECTOTCORR)', short: 'Βροχή', unit: 'mm', digits: 0, palette: ['#3b2a14', '#8c6d31', '#d9c27a', '#c7e9b4', '#41b6c4', '#225ea8', '#0c2c84'] },
  RH2M: { label: 'Σχετική υγρασία (RH2M)', short: 'Υγρασία', unit: '%', digits: 0, palette: ['#5c3a12', '#a6611a', '#dfc27d', '#80cdc1', '#018571', '#014636'] },
  WS10M: { label: 'Ταχύτητα ανέμου (WS10M)', short: 'Άνεμος', unit: 'm/s', digits: 1, palette: ['#132036', '#2c4a74', '#4d7fb0', '#8fb8de', '#d6e6f5', '#ffffff'] },
  NDVI: { label: 'Βλάστηση (NDVI, MODIS)', short: 'NDVI', unit: '', digits: 2, palette: ['#5a3e1b', '#a67c3d', '#d9c98c', '#a6d96a', '#4daf4a', '#1a7837', '#00441b'] },
}
export const CHANGE_PALETTE = ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b']

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
export function colorAt(palette: string[], t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (palette.length - 1)
  const i = Math.min(palette.length - 2, Math.floor(x)), f = x - i
  const a = hex(palette[i]), b = hex(palette[i + 1])
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`
}
export function niceDomain(vals: number[], fixed?: [number, number]): [number, number] {
  if (fixed) return fixed
  const v = vals.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return [0, 1]
  const lo = v[Math.floor(v.length * 0.02)], hi = v[Math.ceil(v.length * 0.98) - 1]
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi]
}
// The word follows the number as it is shown (a whole number), so a displayed «30» always reads «Μέτριες».
export const esiWord = (x: number | null | undefined) => {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—'
  const r = Math.round(x)
  return r >= 60 ? 'Πολύ ευνοϊκές' : r >= 45 ? 'Ευνοϊκές' : r >= 30 ? 'Μέτριες' : r >= 15 ? 'Περιορισμένες' : 'Δυσμενείς'
}

// "Μάι–Οκτ" style text for a set of months (1–12); separate runs are joined with commas.
export function monthRange(months: number[]): string {
  if (!months.length) return 'κανένας μήνας'
  const s = [...months].sort((a, b) => a - b)
  const runs: [number, number][] = []
  for (const m of s) {
    const last = runs[runs.length - 1]
    if (last && m === last[1] + 1) last[1] = m
    else runs.push([m, m])
  }
  return runs.map(([a, b]) => (a === b ? MONTHS[a] : `${MONTHS[a]}–${MONTHS[b]}`)).join(', ')
}

// Where a place stands in Greece, in groups rather than ranks.
export const pctWord = (p: number | null | undefined) =>
  p === null || p === undefined ? '—' : p >= 75 ? 'στο πιο ευνοϊκό 25% της Ελλάδας' : p >= 50 ? 'λίγο πάνω από τη μέση της Ελλάδας'
    : p >= 25 ? 'λίγο κάτω από τη μέση της Ελλάδας' : 'στο λιγότερο ευνοϊκό 25% της Ελλάδας'
