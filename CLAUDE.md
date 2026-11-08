# Mosquito Track: το κουνούπι τίγρη στην Ελλάδα

Hackathon app (NASA Space Apps 2026): environmental suitability (ESI, 0–100) of the tiger mosquito *Aedes albopictus* for all of Greece. It uses NASA POWER data from 1981 (T2M, PRECTOTCORR, RH2M, WS10M), MODIS NDVI from 2000, and CMIP6 projections (NEX-GDDP, 8 models) to 2050. The app shows SSP2-4.5 only; the pipeline also computes SSP5-8.5.
Live: https://rea-tau-seven.vercel.app. Full method: `README.md` (Greek). Team workflow: `TEAM_GUIDE.md`.

## Architecture
- `pipeline/` (Python): fetch → build_dataset → esi → abundance → calibrate → analysis → projections → validate → export.
  - `run_all.py` runs the whole chain; `--no-fetch` skips downloads.
  - Raw data live in `data/raw/`, which is not in git (release `data-2026-11`).
- `data/tiger.duckdb`: the database built by `export.py`. The API opens it read-only.
- `api/main.py`: FastAPI. Every number the UI shows comes from here. It also serves `web/dist`. Vercel entry: `api/index.py` plus `vercel.json`.
  - The map uses `/api/map` (any year and month for every layer; projections for 2027–2050, SSP2-4.5) and `/api/panel/{cell}` (the region card, with observed and projected series).
  - Projections: the five parameters come from `pipeline/projections.py`:
    - T, P, RH and W use the CMIP6 delta method;
    - NDVI uses the extension of its 2001–2025 trend.
    - The ensemble of each parameter is in `proj_monthly` and `proj_annual`.
    - The ESI comes from the five parameters with the same formula, per model (`proj_scores`). The app shows the median of the 8 models.
- `web/`: React 19, TypeScript, Tailwind 4, MapLibre, Recharts. Three sections in `web/src/pages/`:
  - `OverviewPage` (what the ESI is, the five parameters and their weights);
  - `MapPage` with `components/RegionPanel` (one layer, a year slider, a month; one region at a time; state in the URL);
  - `ResultsPage` (every parameter over time for Greece, and the regions with the highest and lowest ESI).
- UI rule: a clean app with only what is needed. No text blocks, no emoji, no pill chips. The team decided this structure (8/11): don't add pages or sections without asking.

## Commands
- API and app: `python -m uvicorn api.main:app --port 8010`, then open http://localhost:8010.
- Frontend dev: `cd web && npm run dev` (port 5180, proxies `/api` to 8010).
- Check before any commit: `cd web && npm run build` (tsc plus vite) must pass.

## Rules
- UI text is Greek; English only for technical terms.
- The ESI is suitability, never mosquito counts or disease risk. Never claim causality from correlations.
- Projections are always labelled as projections: hatch, «ΠΡΟΒΛΕΨΗ» badge, model spread. Only SSP2-4.5 is offered to the user.
- The current year is partial. Never present it as a complete year.
- A trend is «σημαντική» when its Mann-Kendall p < 0.05; changes are shown per 5 years (Sen slope per decade / 2).
- Never invent or fill in data. Every scientific value needs its source in `docs/science_values.json`.
- Weights and function parameters live in `docs/esi_parameters.json`. After changing them, rerun the pipeline.
- No secrets in the repo.
- Production deploys happen only from the owner's Vercel account.
