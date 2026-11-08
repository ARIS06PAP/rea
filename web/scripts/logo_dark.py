"""Turns the R.E.A. logo (navy + green/teal on a light background) into versions for the dark app.
usage (from tiger/): .venv/Scripts/python.exe web/scripts/logo_dark.py web/scripts/rea-logo-source.png web/public
Writes:
  rea-logo-dark.png   whole logo, navy turned light, background transparent
  rea-icon-dark.png   mosquito + globe only (same colours)
  favicon.png         64 px, the icon on the app's dark colour
How: a pixel that lies on the line background -> navy is navy blended with the background, so it becomes the light
colour with alpha = its position on that line (no halo). Any other pixel is green/teal ink; its alpha is its distance
from the background over the distance of the solid ink near it, and its colour is un-blended from the background.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import maximum_filter

LIGHT = np.array([230, 235, 243], float)   # --color-fg of the app
INK = (10, 14, 21)                          # --color-ink of the app

src, out = Path(sys.argv[1]), Path(sys.argv[2])
im = np.asarray(Image.open(src).convert("RGB")).astype(float)
h, w, _ = im.shape
corners = np.concatenate([im[:6, :6].reshape(-1, 3), im[:6, -6:].reshape(-1, 3), im[-6:, :6].reshape(-1, 3), im[-6:, -6:].reshape(-1, 3)])
bg = np.median(corners, axis=0)
v = im - bg
d = np.sqrt((v ** 2).sum(axis=2))
lum = 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]
navy = np.median(im[(d > 300) & (lum < 80)], axis=0)
u = navy - bg
t = (v @ u) / (u @ u)
perp = np.sqrt(((v - t[..., None] * u) ** 2).sum(axis=2))
is_navy = (perp < 12 + 30 * t) & (t > 0.02)

chroma = ~is_navy & (d > 8)
core = np.where(chroma & (d > 120), d, 0)
dloc = maximum_filter(core, size=9)
alpha = np.where(dloc > 0, d / np.maximum(dloc, 1), (d - 10) / 120)
alpha = np.where(is_navy, t, alpha)
alpha = np.clip(np.where(d <= 8, 0, alpha), 0, 1)
a = np.maximum(alpha, 1e-3)[..., None]
col = np.clip(bg + v / a, 0, 255)
col[is_navy] = LIGHT


def save(name, box=None):
    rgba = np.dstack([col, alpha * 255]).round().astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")
    if box:
        img = img.crop(box)
    img = img.crop(img.getbbox())
    img.save(out / name)
    print(name, img.size)
    return img


save("rea-logo-dark.png")
cols = alpha.max(axis=0)
icon_right = next(x for x in range(int(w * 0.25), w) if cols[x:x + 4].max() < 0.05)
icon = save("rea-icon-dark.png", (0, 0, icon_right, h))

S = 256
fav = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(fav).rounded_rectangle((0, 0, S - 1, S - 1), radius=56, fill=INK + (255,))
pad = 22
scale = min((S - 2 * pad) / icon.width, (S - 2 * pad) / icon.height)
ic = icon.resize((round(icon.width * scale), round(icon.height * scale)), Image.LANCZOS)
fav.alpha_composite(ic, ((S - ic.width) // 2, (S - ic.height) // 2))
fav.resize((64, 64), Image.LANCZOS).save(out / "favicon.png")
print("favicon.png (64, 64)")
