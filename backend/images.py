"""Product photo clean-up (Problem 9 usability improvement).

The catalogue photos in data/products/ are a mix of studio cut-outs flattened onto black,
photos on white, tall or off-center shots, and one on-model photo. We never edit those files.
Instead each photo is cleaned once, cached in data/.image_cache/, and served by main.py:

1. An AI background-removal model (ISNet "isnet-general-use", the model behind the open-source
   rembg tool, run locally with onnxruntime) finds the garment.
2. Black backgrounds become white, including the gaps between sleeves and body, with smooth edges
   and no dark fringe. Real fabric is never faded: on black-background photos the AI only decides
   which pure-black areas are background and where the edges are.
3. Stray hairlines and specks are wiped, but solid areas (even ivory fabric on white) are kept.
4. The garment is centered on a square white canvas with an even margin. A real photo whose
   subject runs off the frame (a model cropped at the chin) stays flush with that edge.

If the model can't be loaded (offline, or onnxruntime missing), a simpler Pillow-only clean-up
is used instead, so the site always works.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import ssl
import threading
import urllib.request
from pathlib import Path

import certifi
from PIL import Image, ImageChops, ImageDraw, ImageFilter

try:  # optional: the AI cut-out needs numpy + onnxruntime
    import numpy as np
    import onnxruntime as ort
except ImportError:  # pragma: no cover - fallback path
    np = None
    ort = None

OUTPUT_SIZE = 800
MARGIN = 0.07
MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx"
MODEL_MD5 = "fc16ebd8b0c10d971d3513d564d01e29"  # published by the rembg project

_session = None
_session_lock = threading.Lock()
_session_failed = False


# ---------------------------------------------------------------- AI model


def model_path(data_dir: Path) -> Path:
    return data_dir / ".models" / "isnet-general-use.onnx"


def _md5(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_model(data_dir: Path) -> Path | None:
    """Download the ISNet model once (~179 MB) if it's missing. Set CAMPUS_IMAGE_AI=0 to skip."""
    path = model_path(data_dir)
    if path.exists():
        return path
    if os.getenv("CAMPUS_IMAGE_AI", "1") == "0":
        return None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        part = path.with_suffix(".part")
        print("Downloading the photo clean-up model (isnet-general-use.onnx, ~179 MB)…")
        # certifi's certificates: python.org's macOS Python has none of its own until
        # "Install Certificates.command" is run, so a plain download fails there.
        context = ssl.create_default_context(cafile=certifi.where())
        with urllib.request.urlopen(MODEL_URL, context=context, timeout=120) as response, part.open("wb") as out:
            shutil.copyfileobj(response, out)
        if _md5(part) != MODEL_MD5:
            part.unlink(missing_ok=True)
            print("Photo model download failed its checksum; using the simple clean-up.")
            return None
        part.replace(path)
        return path
    except Exception as error:
        print(f"Photo model unavailable ({type(error).__name__}: {error}); using the simple clean-up.")
        return None


def ai_available(data_dir: Path) -> bool:
    return np is not None and ort is not None and model_path(data_dir).exists() and not _session_failed


def _get_session(data_dir: Path):
    global _session, _session_failed
    with _session_lock:
        if _session is None and not _session_failed:
            try:
                opts = ort.SessionOptions()
                opts.log_severity_level = 3
                _session = ort.InferenceSession(str(model_path(data_dir)), opts, providers=["CPUExecutionProvider"])
            except Exception:
                _session_failed = True
        return _session


def _ai_mask(im: Image.Image, data_dir: Path):
    """Foreground probability 0..1 per pixel. Pre-processing matches rembg's isnet-general-use."""
    session = _get_session(data_dir)
    x = np.asarray(im.resize((1024, 1024), Image.LANCZOS), dtype=np.float32)
    x = (x / max(float(x.max()), 1e-6) - 0.5).transpose(2, 0, 1)[None]
    pred = session.run(None, {session.get_inputs()[0].name: x})[0][0, 0]
    pred = (pred - pred.min()) / max(float(pred.max() - pred.min()), 1e-6)
    mask = Image.fromarray((pred * 255).astype(np.uint8)).resize(im.size, Image.LANCZOS)
    return np.asarray(mask).astype(np.float32) / 255.0


# ---------------------------------------------------------------- AI clean-up


def _on_black(rgb) -> bool:
    s = rgb.sum(axis=2)
    border = np.concatenate([s[0], s[-1], s[:, 0], s[:, -1]])
    return float((border <= 12).mean()) > 0.5


def _border_connected(mask) -> "np.ndarray":
    """Pixels of `mask` connected to the image border (4-neighbour flood fill)."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    stack = [(y, x) for x in range(w) for y in (0, h - 1) if mask[y, x]]
    stack += [(y, x) for y in range(h) for x in (0, w - 1) if mask[y, x]]
    while stack:
        y, x = stack.pop()
        if seen[y, x] or not mask[y, x]:
            continue
        seen[y, x] = True
        if y > 0: stack.append((y - 1, x))
        if y < h - 1: stack.append((y + 1, x))
        if x > 0: stack.append((y, x - 1))
        if x < w - 1: stack.append((y, x + 1))
    return seen


def _components(mask) -> list:
    """Connected regions of `mask` (4-neighbour) as arrays of (ys, xs)."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    regions = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        ys, xs, stack = [], [], [(y0, x0)]
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            ys.append(y)
            xs.append(x)
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        regions.append((np.array(ys), np.array(xs)))
    return regions


def _dilate(mask, size: int):
    return np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(size))) > 0


def _remove_black(rgb, ai):
    """Black background (flattened transparency) → white.

    Background = pure black touching the border, plus enclosed pure-black patches that look like the
    gaps between sleeves and body (big enough, truly pure black, and below the shoulders, so a dark
    hood lining at the top is kept). The gaps are then grown along connected near-black pixels to
    catch their thin ends. Dark JPEG fringe right next to the background is trimmed only where the
    AI agrees, so the middle of navy fabric is never touched.
    """
    gray = rgb.mean(axis=2)
    total = rgb.sum(axis=2)
    pure_black = total <= 12
    outside = _border_connected(pure_black)
    h, w = gray.shape
    ys_in, xs_in = np.nonzero(~outside)
    top, bottom = (ys_in.min(), ys_in.max()) if ys_in.size else (0, h - 1)
    xs_in = np.nonzero(~outside)[1]
    left, right = (xs_in.min(), xs_in.max()) if xs_in.size else (0, w - 1)
    gaps = np.zeros_like(pure_black)
    min_area = max(60, int(0.0004 * h * w))
    for ys, xs in _components(pure_black & ~outside):
        if ys.size < 8 or total[ys, xs].mean() > 4.5:
            continue
        # Measured on the catalogue: sleeve gaps sit below the shoulders, at the sides of the garment
        # (about 18-20% and 81-83% across), and are tall and narrow. A dark hood lining sits at the top.
        rel_y = (ys.mean() - top) / max(bottom - top, 1)
        rel_x = (xs.mean() - left) / max(right - left, 1)
        tall = (ys.max() - ys.min() + 1) >= 1.8 * (xs.max() - xs.min() + 1)
        at_side = rel_x <= 0.32 or rel_x >= 0.68
        if rel_y >= 0.3 and at_side and (tall or ys.size < min_area):
            gaps[ys, xs] = True
    # Follow each gap into its thin, slightly-less-black tips (JPEG blur), never into fabric.
    near_black = total <= 45
    for _ in range(15):
        grown = _dilate(gaps, 3) & near_black
        if (grown == gaps).all():
            break
        gaps = grown | gaps
    core = outside | gaps

    fabric = gray[~pure_black]
    fabric_level = float(np.median(fabric)) if fabric.size else 60.0
    cutoff = max(12.0, min(110.0, fabric_level * 0.55))
    near_core = _dilate(core, 7)
    background = core | (near_core & (ai < 0.6) & (gray <= cutoff))
    background |= near_core & pure_black  # leftover black specks at underarm corners and edges
    near_gaps = _dilate(gaps, 9)
    background |= near_gaps & (gray <= max(cutoff, 0.65 * fabric_level))

    fg = Image.fromarray(np.where(background, 0, 255).astype(np.uint8))
    fg = fg.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))  # drop 1-2 px specks
    fg = fg.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))  # fill 1-2 px nicks
    # Smooth the outline itself: blur the mask and cut it again at the halfway mark. Jagged notches
    # and stair-steps round off into a clean contour, then trim 1 px of dark fringe.
    fg = fg.filter(ImageFilter.GaussianBlur(2.0)).point(lambda v: 255 if v >= 128 else 0)
    fg = fg.filter(ImageFilter.MinFilter(3))
    # Anti-aliased edge: soften the clean mask slightly, then re-sharpen it.
    soft = np.asarray(fg.filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32) / 255.0
    alpha = np.clip((soft - 0.5) * 1.8 + 0.5, 0.0, 1.0)[..., None]
    return rgb * alpha + (1.0 - alpha) * 255.0


def _filled(mask_img: Image.Image) -> "np.ndarray":
    """The mask with its interior holes filled (computed at 1/4 size for speed)."""
    small = mask_img.resize((max(1, mask_img.width // 4), max(1, mask_img.height // 4)), Image.NEAREST)
    holes_or_outside = np.asarray(small) == 0
    outside = _border_connected(holes_or_outside)
    filled = Image.fromarray((~outside).astype(np.uint8) * 255).resize(mask_img.size, Image.NEAREST)
    return np.asarray(filled.filter(ImageFilter.MaxFilter(5))) > 0


def _main_subject(solid: Image.Image) -> Image.Image:
    """Keep only the garment's main shape(s) (≥ 3% of the largest), dropping stray specks."""
    small = solid.resize((max(1, solid.width // 4), max(1, solid.height // 4)), Image.NEAREST)
    regions = _components(np.asarray(small) > 0)
    if not regions:
        return solid
    biggest = max(r[0].size for r in regions)
    keep = np.zeros((small.height, small.width), dtype=bool)
    for ys, xs in regions:
        if ys.size >= 0.03 * biggest:
            keep[ys, xs] = True
    mask = Image.fromarray(keep.astype(np.uint8) * 255).resize(solid.size, Image.NEAREST)
    return ImageChops.multiply(solid, mask.filter(ImageFilter.MaxFilter(9)))


def _clean_ai(im: Image.Image, data_dir: Path) -> tuple[Image.Image, Image.Image, bool]:
    rgb = np.asarray(im).astype(np.float32)
    ai = _ai_mask(im, data_dir)
    cutout = _on_black(rgb)
    if cutout:
        rgb = _remove_black(rgb, ai)
    # Paper-white clean-up: faint near-white lines and JPEG haze (≥ 247) become pure white.
    rgb = np.where((rgb.min(axis=2) >= 247)[..., None], 255.0, rgb)
    # Wipe thin stray marks (hairlines, specks) that the AI also calls background; keep solid areas.
    nonwhite = (255.0 - rgb.min(axis=2)) > 8  # ivory/cream fabric still counts
    nw = Image.fromarray(np.where(nonwhite, 255, 0).astype(np.uint8))
    solid = nw.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    solid_near = np.asarray(solid.filter(ImageFilter.MaxFilter(5))) > 0
    ai_near = np.asarray(Image.fromarray((ai * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 13
    subject = _main_subject(solid)
    # The garment's filled silhouette: everything inside its outline, including big white areas of a
    # print (a bulldog's face, a crest). Speck clean-up never touches anything inside it.
    inside = _filled(subject)
    rgb = np.where((nonwhite & ~solid_near & ~ai_near & ~inside)[..., None], 255.0, rgb)
    # Anything far outside the main garment (a lone speck in a corner) is wiped too.
    far = ~_dilate(inside, 31)
    rgb = np.where(far[..., None], 255.0, rgb)
    out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    return out, subject, cutout


# ---------------------------------------------------------------- simple fallback (Pillow only)

_MAGENTA = (255, 0, 255)


def _clean_simple(im: Image.Image) -> tuple[Image.Image, Image.Image, bool]:
    """Flood-fill the black background from the edges to white (no AI)."""
    im = im.copy()
    w, h = im.size
    px = im.load()
    border = [(x, 0) for x in range(0, w, 3)] + [(x, h - 1) for x in range(0, w, 3)]
    border += [(0, y) for y in range(0, h, 3)] + [(w - 1, y) for y in range(0, h, 3)]
    cutout = sum(sum(px[xy]) <= 12 for xy in border) > len(border) / 2
    for xy in border:
        if sum(px[xy]) <= 4:
            ImageDraw.floodfill(im, xy, _MAGENTA, thresh=4)
    bg = ImageChops.difference(im, Image.new("RGB", im.size, _MAGENTA)).convert("L").point(lambda v: 255 if v < 8 else 0)
    if bg.getbbox():
        dark = im.convert("L").point(lambda v: 255 if v <= 40 else 0)
        for _ in range(2):
            bg = ImageChops.lighter(bg, ImageChops.multiply(bg.filter(ImageFilter.MaxFilter(3)), dark))
        im.paste((255, 255, 255), mask=bg)
    content = ImageChops.difference(im, Image.new("RGB", im.size, (255, 255, 255))).convert("L")
    solid = content.point(lambda v: 255 if v > 8 else 0).filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    return im, solid, cutout


# ---------------------------------------------------------------- framing


# Photos of a person wearing the item. The photographer cropped the model at the chin, so these
# keep that edge flush with the frame instead of showing a floating, headless figure.
ON_MODEL_PHOTOS = {"the-forest-school-hoodie"}


def _frame(img: Image.Image, subject: Image.Image, on_model: bool, edge_tol: int = 3) -> Image.Image:
    """Center the subject on a square white canvas with an even margin. On-model photos whose
    subject runs off the frame keep those sides flush."""
    box = subject.getbbox() or (0, 0, *img.size)
    w, h = img.size
    cut_l = cut_t = cut_r = cut_b = False
    if on_model:
        cut_l, cut_t = box[0] <= edge_tol, box[1] <= edge_tol
        cut_r, cut_b = box[2] >= w - edge_tol, box[3] >= h - edge_tol
    crop = img.crop(box)
    cw, ch = crop.size
    mx = 0 if (cut_l or cut_r) else MARGIN
    my = 0 if (cut_t or cut_b) else MARGIN
    side = int(max(cw * (1 + 2 * mx), ch * (1 + 2 * my)))
    x = 0 if cut_l and not cut_r else side - cw if cut_r and not cut_l else (side - cw) // 2
    y = 0 if cut_t and not cut_b else side - ch if cut_b and not cut_t else (side - ch) // 2
    canvas = Image.new("RGB", (side, side), (255, 255, 255))
    canvas.paste(crop, (x, y))
    return canvas.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.LANCZOS)


def clean_photo(source: Path, data_dir: Path, use_ai: bool) -> Image.Image:
    with Image.open(source) as raw:
        im = raw.convert("RGB")
    out, subject, _ = _clean_ai(im, data_dir) if use_ai else _clean_simple(im)
    return _frame(out, subject, on_model=source.stem in ON_MODEL_PHOTOS)
