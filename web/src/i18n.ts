// Two languages, English by default. The choice is kept in localStorage; every component that shows text
// calls useT() (or useLang()), so a switch re-renders it. Numbers follow the language (0.47 / 0,47).
import { useSyncExternalStore } from 'react'

export type Lang = 'en' | 'el'
let lang: Lang = (typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'el') ? 'el' : 'en'
const subs = new Set<() => void>()
if (typeof document !== 'undefined') document.documentElement.lang = lang

export const getLang = () => lang
export function setLang(l: Lang) {
  lang = l
  localStorage.setItem('lang', l)
  document.documentElement.lang = l
  subs.forEach((f) => f())
}
export function useLang(): Lang {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => lang)
}
// t('Ελληνικά', 'English')
export function useT() {
  const l = useLang()
  return (el: string, en: string) => (l === 'en' ? en : el)
}

export const REGION_EN: Record<string, string> = {
  'Αττική': 'Attica', 'Κεντρική Μακεδονία': 'Central Macedonia', 'Θεσσαλία': 'Thessaly', 'Κρήτη': 'Crete',
  'Δυτική Ελλάδα': 'Western Greece', 'Πελοπόννησος': 'Peloponnese', 'Ανατολική Μακεδονία και Θράκη': 'Eastern Macedonia and Thrace',
  'Στερεά Ελλάδα': 'Central Greece', 'Νότιο Αιγαίο': 'South Aegean', 'Ήπειρος': 'Epirus', 'Δυτική Μακεδονία': 'Western Macedonia',
  'Ιόνια Νησιά': 'Ionian Islands', 'Βόρειο Αιγαίο': 'North Aegean',
}
export const PLACE_EN: Record<string, string> = {
  'Αθήνα': 'Athens', 'Θεσσαλονίκη': 'Thessaloniki', 'Πάτρα': 'Patras', 'Ηράκλειο': 'Heraklion', 'Λάρισα': 'Larissa', 'Βόλος': 'Volos',
  'Ιωάννινα': 'Ioannina', 'Τρίκαλα': 'Trikala', 'Χαλκίδα': 'Chalkida', 'Σέρρες': 'Serres', 'Αλεξανδρούπολη': 'Alexandroupoli',
  'Ξάνθη': 'Xanthi', 'Κομοτηνή': 'Komotini', 'Καβάλα': 'Kavala', 'Δράμα': 'Drama', 'Κατερίνη': 'Katerini', 'Βέροια': 'Veria',
  'Έδεσσα': 'Edessa', 'Κιλκίς': 'Kilkis', 'Πολύγυρος': 'Polygyros', 'Κοζάνη': 'Kozani', 'Φλώρινα': 'Florina', 'Καστοριά': 'Kastoria',
  'Γρεβενά': 'Grevena', 'Καρδίτσα': 'Karditsa', 'Λαμία': 'Lamia', 'Άμφισσα': 'Amfissa', 'Λιβαδειά': 'Livadeia', 'Θήβα': 'Thebes',
  'Καλαμάτα': 'Kalamata', 'Τρίπολη': 'Tripoli', 'Σπάρτη': 'Sparta', 'Κόρινθος': 'Corinth', 'Ναύπλιο': 'Nafplio', 'Πύργος': 'Pyrgos',
  'Αγρίνιο': 'Agrinio', 'Μεσολόγγι': 'Missolonghi', 'Άρτα': 'Arta', 'Πρέβεζα': 'Preveza', 'Ηγουμενίτσα': 'Igoumenitsa', 'Κέρκυρα': 'Corfu',
  'Λευκάδα': 'Lefkada', 'Αργοστόλι': 'Argostoli', 'Ζάκυνθος': 'Zakynthos', 'Χανιά': 'Chania', 'Ρέθυμνο': 'Rethymno',
  'Άγιος Νικόλαος': 'Agios Nikolaos', 'Ιεράπετρα': 'Ierapetra', 'Μυτιλήνη': 'Mytilene', 'Χίος': 'Chios', 'Σάμος': 'Samos', 'Ρόδος': 'Rhodes',
  'Κως': 'Kos', 'Ερμούπολη (Σύρος)': 'Ermoupoli (Syros)', 'Νάξος': 'Naxos', 'Θήρα (Σαντορίνη)': 'Thira (Santorini)', 'Μύρινα (Λήμνος)': 'Myrina (Lemnos)',
}
export const regionName = (r: string) => (lang === 'en' ? REGION_EN[r] ?? r : r)
export const placeName = (p: string) => (lang === 'en' ? PLACE_EN[p] ?? p : p)
