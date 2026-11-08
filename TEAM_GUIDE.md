# Οδηγός ομάδας: πώς δουλεύουμε το TigerWatch

Live εφαρμογή (δημόσια): **https://rea-tau-seven.vercel.app**
Τι κάνει και πώς είναι φτιαγμένη: [README.md](README.md). Εδώ είναι μόνο τα πρακτικά.

## 1. Πρώτη φορά (περίπου 10 λεπτά)

Χρειάζεσαι: Git, Python 3.12, Node 20 ή νεότερο.

```bash
git clone https://github.com/ARIS06PAP/tigerwatch.git
cd tigerwatch

# backend (FastAPI + DuckDB)
python -m venv .venv
# Windows:      .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt

# frontend (React)
cd web && npm install && npm run build && cd ..

# εκτέλεση
python -m uvicorn api.main:app --port 8010
```

Άνοιξε http://localhost:8010. Η εφαρμογή είναι ίδια με τη live, γιατί η βάση `data/tiger.duckdb` είναι μέσα στο repo. Η τεκμηρίωση του API βρίσκεται στο http://localhost:8010/docs.

**Για αλλαγές στην εμφάνιση** τρέξε, σε δεύτερο τερματικό, `cd web && npm run dev` και άνοιξε http://localhost:5180. Κάθε αλλαγή φαίνεται αμέσως. Το API πρέπει να τρέχει στο 8010.

## 2. Πού αλλάζει τι

| Θέλω να αλλάξω… | Αρχείο |
|---|---|
| Κείμενα και διάταξη μιας σελίδας | `web/src/pages/*.tsx` (Dashboard, MapPage, ParamsPage, HistoryPage, FuturePage, ValidationPage, SciencePage) |
| Μενού, header, footer | `web/src/components/Layout.tsx` |
| Χρώματα χαρτών, ονόματα παραμέτρων, μορφή αριθμών | `web/src/fmt.ts` |
| Χάρτη (πόλεις, υπόβαθρο) | `web/src/components/GreeceMap.tsx` |
| Γραφήματα | `web/src/components/Charts.tsx` |
| Τι επιστρέφει το API | `api/main.py` |
| Τις συναρτήσεις του ESI | `pipeline/esi.py` (μετά ξανατρέχει το pipeline, ενότητα 4) |
| Βάρη και παραμέτρους του ESI | `docs/esi_parameters.json` (επίσης θέλει pipeline) |
| Επιστημονικές τιμές και πηγές | `docs/science_values.json` |

Αλλαγές μόνο στο `web/` ή στο `api/` **δεν** χρειάζονται pipeline: αρκεί `npm run build` και επανεκκίνηση του uvicorn.

## 3. Πώς μοιραζόμαστε τις αλλαγές (Git)

Το `main` είναι αυτό που ανεβαίνει live. Κανείς δεν γράφει απευθείας εκεί.

```bash
git checkout main && git pull                  # πάρε τα τελευταία
git checkout -b onoma/ti-allazo                # δικό σου branch, π.χ. maria/keimena-dashboard
# ... αλλαγές ...
cd web && npm run build && cd ..               # πρέπει να περνάει χωρίς λάθη
git add -A && git commit -m "Τι άλλαξα"
git push -u origin onoma/ti-allazo
```

Μετά, στο GitHub: **Compare & pull request**. Κάποιος άλλος το κοιτάζει και το κάνει merge στο `main`.

## 4. Pipeline (μόνο αν αλλάξει ο δείκτης ή τα δεδομένα)

Τα raw δεδομένα (NASA POWER, MODIS, CMIP6, παγίδες, GBIF, περίπου 287 MB) δεν μπαίνουν στο repo. Είναι στο **Releases → data-2026-11 → `data_raw.zip`**:

```bash
gh release download data-2026-11 -p data_raw.zip     # ή κατέβασέ το από τη σελίδα του repo
# αποσυμπίεσε έτσι ώστε να υπάρχει ο φάκελος data/raw/ (power, ee, traps, gbif_….json)
pip install -r requirements-pipeline.txt
python pipeline/run_all.py --no-fetch                # περίπου 5 λεπτά: ESI, στατιστική, προβλέψεις, επικύρωση, βάση
```

Με `--no-fetch` δεν κατεβαίνει τίποτα. Νέα λήψη από τη NASA (χωρίς `--no-fetch`) θέλει πρόσβαση στο Google Earth Engine του project, και αυτή την έχει μόνο ο Άρης. Η NASA POWER δεν θέλει κλειδί.

Αν αλλάξει η βάση `data/tiger.duckdb` ή τα `api/static/*.json`, γράψ' το στο pull request, ώστε να ξέρουμε ότι άλλαξαν τα νούμερα.

## 5. Live εφαρμογή

Το link ενημερώνεται μόνο από τον λογαριασμό Vercel του Άρη, με μία εντολή από το `main`:
`vercel deploy --prod` (για δοκιμή πρώτα: `vercel deploy`, που δίνει ιδιωτικό preview link). Πες του όταν γίνει merge κάτι που πρέπει να φανεί live.

## 6. Κανόνες

- Κείμενα της εφαρμογής στα ελληνικά. Αγγλικοί όροι μόνο όπου χρειάζονται (ESI, SSP, NDVI).
- Ο ESI είναι **καταλληλότητα**, όχι αριθμός κουνουπιών ή κρουσμάτων. Καμία φράση που λέει «προβλέπουμε dengue» ή κάτι αντίστοιχο.
- Οι προβλέψεις φαίνονται πάντα ως προβλέψεις (γραμμοσκίαση, «ΠΡΟΒΛΕΨΗ»).
- Κανένας αριθμός «από μνήμης»: κάθε νούμερο στην οθόνη έρχεται από το API.
- Ποτέ κλειδιά ή κωδικοί στο repo.

## 7. Με Claude Code

Άνοιξε τον φάκελο του repo με το Claude Code. Το `CLAUDE.md` του δίνει την αρχιτεκτονική και τους κανόνες. Ζήτα του αλλαγές, πες του να τρέξει `npm run build` για έλεγχο, και κάνε push σε δικό σου branch.
