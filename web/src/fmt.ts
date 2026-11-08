// Number/month formatting in the current language, the map layers and their colour scales.
import { getLang } from './i18n'

const loc = () => (getLang() === 'en' ? 'en-US' : 'el-GR')
export const nf = (x: number | null | undefined, d = 1) =>
  x === null || x === undefined || Number.isNaN(x) ? '—' : x.toLocaleString(loc(), { maximumFractionDigits: d, minimumFractionDigits: d })
export const signed = (x: number | null | undefined, d = 1) =>
  x === null || x === undefined || Number.isNaN(x) ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '') + nf(Math.abs(x), d)
export const pfmt = (p: number | null | undefined) =>
  p === null || p === undefined ? '—' : p < 0.001 ? `< ${nf(0.001, 3)}` : nf(p, 3)

const MONTHS_EL = ['Έτος', 'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ']
const MONTHS_EN = ['Year', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG_EL = ['Όλο το έτος', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος']
const MONTHS_LONG_EN = ['Whole year', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const months = () => (getLang() === 'en' ? MONTHS_EN : MONTHS_EL)
export const monthsLong = () => (getLang() === 'en' ? MONTHS_LONG_EN : MONTHS_LONG_EL)

const ESI_PALETTE = ['#1b1036', '#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf']
export type LayerInfo = { el: [string, string]; en: [string, string]; unit: string; digits: number; palette: string[]; first: number; esi: boolean }
// el/en: [label, short]
export const LAYER_INFO: Record<string, LayerInfo> = {
  ESI: { el: ['Δείκτης καταλληλότητας ESI', 'ESI'], en: ['Suitability index ESI', 'ESI'], unit: '/100', digits: 0, palette: ESI_PALETTE, first: 2001, esi: true },
  ESI_eq: { el: ['ESI με ίσα βάρη', 'ESI ίσα βάρη'], en: ['ESI, equal weights', 'ESI equal weights'], unit: '/100', digits: 0, palette: ESI_PALETTE, first: 2001, esi: true },
  T2M: { el: ['Θερμοκρασία', 'Θερμοκρασία'], en: ['Temperature', 'Temperature'], unit: '°C', digits: 1, palette: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'], first: 1981, esi: false },
  PRECIP: { el: ['Βροχόπτωση', 'Βροχόπτωση'], en: ['Precipitation', 'Precipitation'], unit: 'mm', digits: 0, palette: ['#3b2a14', '#8c6d31', '#d9c27a', '#c7e9b4', '#41b6c4', '#225ea8', '#0c2c84'], first: 1981, esi: false },
  RH2M: { el: ['Υγρασία', 'Υγρασία'], en: ['Humidity', 'Humidity'], unit: '%', digits: 0, palette: ['#5c3a12', '#a6611a', '#dfc27d', '#80cdc1', '#018571', '#014636'], first: 1981, esi: false },
  WS10M: { el: ['Άνεμος', 'Άνεμος'], en: ['Wind', 'Wind'], unit: 'm/s', digits: 1, palette: ['#132036', '#2c4a74', '#4d7fb0', '#8fb8de', '#d6e6f5', '#ffffff'], first: 1981, esi: false },
  NDVI: { el: ['Βλάστηση (NDVI)', 'Βλάστηση'], en: ['Vegetation (NDVI)', 'Vegetation'], unit: '', digits: 2, palette: ['#5a3e1b', '#a67c3d', '#d9c98c', '#a6d96a', '#4daf4a', '#1a7837', '#00441b'], first: 2001, esi: false },
}
export const label = (l: LayerInfo) => (getLang() === 'en' ? l.en[0] : l.el[0])
export const short = (l: LayerInfo) => (getLang() === 'en' ? l.en[1] : l.el[1])
export const CHANGE_PALETTE = ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b']

// The five factors of the ESI, in the order of their weight.
export const FACTORS = [
  { key: 'T', score: 'sT', layer: 'T2M', el: 'Θερμοκρασία', en: 'Temperature' },
  { key: 'P', score: 'sP', layer: 'PRECIP', el: 'Βροχόπτωση', en: 'Precipitation' },
  { key: 'W', score: 'sW', layer: 'WS10M', el: 'Άνεμος', en: 'Wind' },
  { key: 'RH', score: 'sRH', layer: 'RH2M', el: 'Υγρασία', en: 'Humidity' },
  { key: 'NDVI', score: 'sNDVI', layer: 'NDVI', el: 'Βλάστηση', en: 'Vegetation' },
] as const
export const factorName = (f: { el: string; en: string }) => (getLang() === 'en' ? f.en : f.el)

// ESI classes: lower bound, word (el, en). A shown (rounded) number always gets the word of its class.
export const CLASSES: [number, string, string][] = [[60, 'Πολύ ευνοϊκές', 'Very favourable'], [45, 'Ευνοϊκές', 'Favourable'], [30, 'Μέτριες', 'Moderate'], [15, 'Περιορισμένες', 'Limited'], [0, 'Δυσμενείς', 'Unfavourable']]
export const classWord = (c: [number, string, string]) => (getLang() === 'en' ? c[2] : c[1])
export const esiWord = (x: number | null | undefined) => {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—'
  const r = Math.round(x)
  return classWord(CLASSES.find(([lo]) => r >= lo) ?? CLASSES[CLASSES.length - 1])
}
export const ESI_DOMAIN = (month: number): [number, number] => (month === 0 ? [10, 50] : [0, 80])

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
export function colorAt(palette: string[], t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (palette.length - 1)
  const i = Math.min(palette.length - 2, Math.floor(x)), f = x - i
  const a = hex(palette[i]), b = hex(palette[i + 1])
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`
}
export function niceDomain(vals: number[]): [number, number] {
  const v = vals.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return [0, 1]
  const lo = v[Math.floor(v.length * 0.02)], hi = v[Math.ceil(v.length * 0.98) - 1]
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi]
}

// A Sen trend drawn as a line: slope per year from the stored trend, intercept = median of v − slope·year.
export function trendRows(series: { year: number; v: number | null }[], perDecade: number | null | undefined, first: number, last: number) {
  if (perDecade === null || perDecade === undefined) return series.map((p) => ({ ...p }))
  const b = perDecade / 10
  const res = series.filter((p) => p.v !== null && p.year >= first && p.year <= last).map((p) => (p.v as number) - b * p.year).sort((x, y) => x - y)
  if (!res.length) return series.map((p) => ({ ...p }))
  const n = res.length, a = n % 2 ? res[(n - 1) / 2] : (res[n / 2 - 1] + res[n / 2]) / 2
  return series.map((p) => ({ ...p, trend: p.year >= first && p.year <= last ? a + b * p.year : undefined }))
}
