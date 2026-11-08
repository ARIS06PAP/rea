# TigerWatch Ελλάδα

Hackathon app (NASA Space Apps 2026): environmental suitability (ESI, 0–100) of the tiger mosquito *Aedes albopictus* for all of Greece. It uses NASA POWER data from 1981 (T2M, PRECTOTCORR, RH2M, WS10M), MODIS NDVI from 2000, and CMIP6 projections (NEX-GDDP, 8 models, SSP2-4.5 and SSP5-8.5) to 2050.
Live: https://rea-tau-seven.vercel.app. Full method: `README.md` (Greek). Team workflow: `TEAM_GUIDE.md`.

## Architecture
- `pipeline/` (Python): fetch → build_dataset → esi → abundance → calibrate → analysis → projections → validate → export.
  - `run_all.py` runs the whole chain; `--no-fetch` skips downloads.
  - Raw data live in `data/raw/`, which is not in git (release `data-2026-11`).
- `data/tiger.duckdb`: the database built by `export.py`. The API opens it read-only.
- `api/main.py`: FastAPI. Every number the UI shows comes from here. It also serves `web/dist`. Vercel entry: `api/index.py` plus `vercel.json`.
- `web/`: React 19, TypeScript, Tailwind 4, MapLibre, Recharts. Seven pages in `web/src/pages/`.

## Commands
- API and app: `python -m uvicorn api.main:app --port 8010`, then open http://localhost:8010.
- Frontend dev: `cd web && npm run dev` (port 5180, proxies `/api` to 8010).
- Check before any commit: `cd web && npm run build` (tsc plus vite) must pass.

## Rules
- UI text is Greek; English only for technical terms.
- The ESI is suitability, never mosquito counts or disease risk. Never claim causality from correlations.
- Projections are always labelled as projections: hatch, «ΠΡΟΒΛΕΨΗ» badge, model spread.
- The current year is partial. Never present it as a complete year.
- Never invent or fill in data. Every scientific value needs its source in `docs/science_values.json`.
- Weights and function parameters live in `docs/esi_parameters.json`. After changing them, rerun the pipeline.
- No secrets in the repo.
- Production deploys happen only from the owner's Vercel account.
