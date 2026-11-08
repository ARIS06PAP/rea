"""Vercel Python entry point: the same FastAPI app as api/main.py (the frontend is served
as static files from web/dist by Vercel itself)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from api.main import app  # noqa: E402,F401
